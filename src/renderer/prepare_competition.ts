// Copyright 2022 Craig Miskell (craig@stroppykitten.com)
//
// This file is part of gymscore
//
// Gymscore is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
// License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
// version.
//
// Gymscore is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
// implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
// details.
//
// You should have received a copy of the GNU General Public License along with this program. If not,
// see <https://www.gnu.org/licenses/>.

import { db } from "./data/gymscoredb";
import { Division, hasDivisions } from "../common/data";
import * as pageCommon from "./page_common";
import { CompetitionCompetitorDetails } from "../common/data/competition";
import { logger } from "./logger";
import { elements, competition, COMPETITOR_ID_ATTR_NAME } from "./prepare_competition_state";
import { setupDetailsPanel, loadCompetition, showInitialState } from "./prepare_competition_details";
import { setupCompetitorSection, editCompetitor } from "./prepare_competition_modal";

pageCommon.setup();

const selectedCompetitorIds = new Set<number>();

type SortColumn = "name" | "nationalId" | "step" | "club" | "team" | "group";
const tableSorter = new pageCommon.TableSorter<SortColumn>();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  pageCommon.findElements(elements);

  const compId = pageCommon.getCompetitionIdFromUrl();
  logger.debug("prepare_competition loaded", { compId });

  await loadCompetition(compId);

  setupDetailsPanel();
  await setupCompetitorSection(updateCompetitorsTable);
  setupCompetitorsTable();
  showInitialState();
}

function setupCompetitorsTable() {
  tableSorter.setup(elements.competitors, updateCompetitorsTable);
  elements.selectAllCheckbox.addEventListener("change", selectAllChanged);
  setupGroupAssignToolbar();
  pageCommon.setupFilterInputs(
    [elements.filterName, elements.filterNationalId, elements.filterStep,
      elements.filterClub, elements.filterTeam, elements.filterGroup],
    updateCompetitorsTable
  );
  // Bootstrap's form-control sets width: 100%, which causes the table layout algorithm to size
  // this column by its header text ("National ID") rather than its content. CSS overrides on the
  // th are ignored for the same reason. Setting directly on the input here is the reliable fix.
  pageCommon.applyNarrowFilterStyle(elements.filterNationalId);
  pageCommon.applyNarrowFilterStyle(elements.filterStep);
  pageCommon.applyNarrowFilterStyle(elements.filterGroup);
  updateCompetitorsTable();
}

async function removeCompetitor(event: Event) {
  // Do this *first* so we get a chance to catch errors and not immediately reload the page
  event.preventDefault();

  const competitorId = parseInt((event.currentTarget as HTMLAnchorElement).getAttribute(COMPETITOR_ID_ATTR_NAME));
  logger.info("Removing competitor from competition", { competitorId, competitionId: competition.id });
  selectedCompetitorIds.delete(competitorId);
  competition.removeCompetitorById(competitorId);
  await db.competitions.update(competition.id, competition);
  updateGroupAssignToolbar();
  updateCompetitorsTable();
}

function displayCompetitorInRow(row: HTMLTableRowElement, competitor: CompetitionCompetitorDetails) {
  const competitorIdString = competitor.competitorId.toString();

  const checkbox = row.cells[0].firstChild as HTMLInputElement;
  checkbox.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
  checkbox.checked = selectedCompetitorIds.has(competitor.competitorId);

  row.cells[1].textContent = competitor.competitorName;
  row.cells[2].textContent = competitor.competitorIdentifier;
  row.cells[3].textContent = hasDivisions(competitor.step)
    ? competitor.step + " " + Division[competitor.division]
    : competitor.step.toString();
  row.cells[4].textContent = competitor.clubName;
  row.cells[5].textContent = competition.teams[competitor.teamIndex]?.name ?? "";

  const groupSelect = row.cells[6].firstChild as HTMLSelectElement;
  groupSelect.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
  const groupNumber = competitor.groupNumber || 0;
  groupSelect.value = groupNumber.toString();

  if (groupNumber > 0) {
    row.dataset.group = groupNumber.toString();
  } else {
    delete row.dataset.group;
  }

  row.cells[7].children[0].setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
  row.cells[8].children[0].setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
}

function createNewGroupSelect(index: number): HTMLSelectElement {
  const newGroupSelect = document.createElement("select") as HTMLSelectElement;
  newGroupSelect.classList.add("form-select", "form-select-sm");
  newGroupSelect.add(new Option("None", "0"));
  for (let i = 1; i < 10; i++) {
    newGroupSelect.add(new Option(i.toString(), i.toString()));
  }
  newGroupSelect.id = `groupSelect-${index}`;
  newGroupSelect.addEventListener("click", groupSelectChanged);
  return newGroupSelect;
}

function createCompetitorRow(tableSection: HTMLTableSectionElement): HTMLTableRowElement {
  const index = tableSection.rows.length;
  const row = tableSection.insertRow(-1);
  for (let i = 0; i < 9; i++) {
    row.insertCell();
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.classList.add("form-check-input");
  checkbox.addEventListener("change", competitorCheckboxChanged);
  row.cells[0].appendChild(checkbox);

  row.cells[6].append(createNewGroupSelect(index));

  const editLink = document.createElement("a");
  editLink.href = "";
  editLink.addEventListener("click", editCompetitor);
  const editIcon = document.createElement("i");
  editIcon.classList.add("bi", "bi-pencil");
  editLink.appendChild(editIcon);
  row.cells[7].appendChild(editLink);

  const removeLink = document.createElement("a");
  removeLink.href = "";
  removeLink.addEventListener("click", removeCompetitor);
  const removeIcon = document.createElement("i");
  removeIcon.classList.add("bi", "bi-trash");
  removeLink.appendChild(removeIcon);
  row.cells[8].appendChild(removeLink);

  return row;
}

function updateCompetitorsTable() {
  const tableBody = elements.competitors.tBodies[0];

  if (competition == undefined) {
    return;
  }

  const nameFilter = elements.filterName.value.toLowerCase();
  const nationalIdFilter = elements.filterNationalId.value.toLowerCase();
  const stepFilter = elements.filterStep.value.toLowerCase();
  const clubFilter = elements.filterClub.value.toLowerCase();
  const teamFilter = elements.filterTeam.value.toLowerCase();
  const groupFilter = elements.filterGroup.value.toLowerCase();

  const filtered = [...competition.competitors]
    .sort((a, b) => {
      const clubA = a.clubName ?? "";
      const clubB = b.clubName ?? "";
      const teamA = competition.teams[a.teamIndex]?.name ?? "";
      const teamB = competition.teams[b.teamIndex]?.name ?? "";
      const defaultOrder =
        clubA.localeCompare(clubB) ||
        teamA.localeCompare(teamB) ||
        (a.step - b.step) ||
        a.competitorName.localeCompare(b.competitorName);

      if (tableSorter.column === null) {
        return defaultOrder;
      }

      let primary: number;
      switch (tableSorter.column) {
      case "name": primary = a.competitorName.localeCompare(b.competitorName); break;
      case "nationalId": primary = (a.competitorIdentifier ?? "").localeCompare(b.competitorIdentifier ?? ""); break;
      case "step": primary = (a.step - b.step) ||
        (hasDivisions(a.step) ? Division[a.division].localeCompare(Division[b.division]) : 0); break;
      case "club": primary = clubA.localeCompare(clubB); break;
      case "team": primary = teamA.localeCompare(teamB); break;
      case "group": primary = (a.groupNumber || 0) - (b.groupNumber || 0); break;
      }
      return (primary !== 0 ? (tableSorter.direction === "asc" ? primary : -primary) : defaultOrder);
    })
    .filter((competitor) => {
      const stepStr = hasDivisions(competitor.step)
        ? `${competitor.step} ${Division[competitor.division]}`.toLowerCase()
        : `${competitor.step}`;
      const teamName = (competition.teams[competitor.teamIndex]?.name ?? "").toLowerCase();
      const groupNum = competitor.groupNumber || 0;
      const groupStr = groupNum === 0 ? "none" : groupNum.toString();
      return (
        competitor.competitorName.toLowerCase().includes(nameFilter) &&
        (competitor.competitorIdentifier ?? "").toLowerCase().includes(nationalIdFilter) &&
        stepStr.includes(stepFilter) &&
        (competitor.clubName ?? "").toLowerCase().includes(clubFilter) &&
        teamName.includes(teamFilter) &&
        groupStr.includes(groupFilter)
      );
    });

  pageCommon.updateTableBody(tableBody, filtered, createCompetitorRow, (row, competitor) => {
    displayCompetitorInRow(row, competitor);
  });
  updateSelectAllCheckbox();
  updateGroupButtonCounts();
}

function updateGroupButtonCounts() {
  const counts = new Map<number, number>();
  for (const competitor of competition.competitors) {
    const g = competitor.groupNumber || 0;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  elements.groupAssignToolbar.querySelectorAll<HTMLButtonElement>(".group-assign-btn").forEach((btn) => {
    const g = parseInt(btn.dataset.group);
    const label = g === 0 ? "None" : g.toString();
    const count = counts.get(g) ?? 0;
    btn.innerHTML = `<span class="group-btn-label">${label}</span><span class="group-btn-count">(${count})</span>`;
  });
}

async function groupSelectChanged(event: Event) {
  const select = event.target as HTMLSelectElement;
  const competitorId = parseInt(select.getAttribute(COMPETITOR_ID_ATTR_NAME));

  const competitor: CompetitionCompetitorDetails = competition.getCompetitorById(competitorId);
  const oldGroup = competitor.groupNumber;
  competitor.groupNumber = parseInt(select.value);
  logger.debug("Competitor group changed via select", {
    competitorId,
    oldGroup,
    newGroup: competitor.groupNumber,
  });
  await db.competitions.update(competition.id, competition);

  const row = select.closest("tr") as HTMLTableRowElement;
  if (competitor.groupNumber > 0) {
    row.dataset.group = competitor.groupNumber.toString();
  } else {
    delete row.dataset.group;
  }
  updateGroupButtonCounts();
}

function competitorCheckboxChanged(event: Event) {
  const checkbox = event.target as HTMLInputElement;
  const competitorId = parseInt(checkbox.getAttribute(COMPETITOR_ID_ATTR_NAME));
  if (checkbox.checked) {
    selectedCompetitorIds.add(competitorId);
  } else {
    selectedCompetitorIds.delete(competitorId);
  }
  updateGroupAssignToolbar();
  updateSelectAllCheckbox();
}

function selectAllChanged(event: Event) {
  const selectAll = event.target as HTMLInputElement;
  const tableBody = elements.competitors.tBodies[0];
  for (const row of tableBody.rows) {
    const checkbox = row.cells[0].firstChild as HTMLInputElement;
    const competitorId = parseInt(checkbox.getAttribute(COMPETITOR_ID_ATTR_NAME));
    if (selectAll.checked) {
      selectedCompetitorIds.add(competitorId);
    } else {
      selectedCompetitorIds.delete(competitorId);
    }
    checkbox.checked = selectAll.checked;
  }
  updateGroupAssignToolbar();
}

function updateGroupAssignToolbar() {
  const count = selectedCompetitorIds.size;
  const hasSelection = count > 0;

  elements.groupAssignCount.textContent = `${count} competitors selected — Assign to group:`;
  elements.groupAssignGuidance.style.visibility = hasSelection ? "hidden" : "visible";
  elements.groupAssignCount.style.visibility = hasSelection ? "visible" : "hidden";
  elements.groupAssignToolbar.classList.toggle("opacity-50", !hasSelection);

  elements.groupAssignToolbar.querySelectorAll<HTMLButtonElement>(".group-assign-btn").forEach((btn) => {
    btn.disabled = !hasSelection;
  });
}

function updateSelectAllCheckbox() {
  const tableBody = elements.competitors.tBodies[0];
  const visibleRows = [...tableBody.rows];
  const allChecked = visibleRows.length > 0 && visibleRows.every((row) => {
    const checkbox = row.cells[0].firstChild as HTMLInputElement;
    return checkbox.checked;
  });
  elements.selectAllCheckbox.checked = allChecked;
  elements.selectAllCheckbox.indeterminate = !allChecked && selectedCompetitorIds.size > 0;
}

async function assignGroupToSelected(groupNumber: number) {
  logger.info("Assigning group to selected competitors", {
    groupNumber,
    competitorCount: selectedCompetitorIds.size,
    competitorIds: [...selectedCompetitorIds],
  });
  for (const competitorId of selectedCompetitorIds) {
    const competitor = competition.getCompetitorById(competitorId);
    if (competitor) {
      competitor.groupNumber = groupNumber;
    }
  }
  await db.competitions.update(competition.id, competition);
  updateCompetitorsTable();
}

function setupGroupAssignToolbar() {
  const container = document.getElementById("groupAssignButtons");
  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("btn", "btn-sm", "group-assign-btn");
    btn.dataset.group = i.toString();
    btn.textContent = i.toString();
    container.appendChild(btn);
  }
  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.classList.add("btn", "btn-sm", "group-assign-btn");
  noneBtn.dataset.group = "0";
  noneBtn.textContent = "None";
  container.appendChild(noneBtn);

  container.addEventListener("click", (e: Event) => {
    const btn = (e.target as HTMLElement).closest(".group-assign-btn") as HTMLElement;
    if (btn) {
      void assignGroupToSelected(parseInt(btn.dataset.group));
    }
  });

  updateGroupAssignToolbar();
}
