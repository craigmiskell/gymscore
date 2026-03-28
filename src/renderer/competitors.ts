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
import { ICompetitor, Division, hasDivisions } from "../common/data";
import { Competitor } from "../common/data";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";
import { logger } from "./logger";

const COMPETITOR_ID_ATTR = "competitorId";

type SortColumn = "nationalId" | "name" | "step" | "club";
const tableSorter = new pageCommon.TableSorter<SortColumn>();

class Elements extends pageCommon.BaseElements {
  competitors: HTMLTableElement = null;
  filterNationalId: HTMLInputElement = null;
  filterName: HTMLInputElement = null;
  filterStep: HTMLInputElement = null;
  filterClub: HTMLInputElement = null;
  editCompetitorModal: HTMLElement = null;
  editCompetitorForm: HTMLFormElement = null;
  editNationalId: HTMLInputElement = null;
  editName: HTMLInputElement = null;
  editStep: HTMLSelectElement = null;
  editDivision: HTMLSelectElement = null;
  editClub: HTMLInputElement = null;
  editCompetitorSave: HTMLButtonElement = null;
  deleteConfirmationModal: HTMLElement = null;
  deleteConfirmationNo: HTMLButtonElement = null;
  deleteConfirmationYes: HTMLButtonElement = null;
}
const elements = new Elements();

pageCommon.setup();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

interface CompetitorDisplay {
  competitor: ICompetitor;
  clubName: string;
}


async function onLoaded() {
  pageCommon.findElements(elements);

  pageCommon.populateStepSelect(elements.editStep);
  elements.editStep.addEventListener("change", () => {
    pageCommon.updateDivisionVisibility(elements.editStep, "editDivisionLabel", "editDivisionCol");
  });

  elements.deleteConfirmationModal.addEventListener("hide.bs.modal", () => {
    elements.deleteConfirmationModal.removeAttribute(COMPETITOR_ID_ATTR);
  });

  elements.deleteConfirmationYes.addEventListener("click", async () => {
    const competitorId = parseInt(elements.deleteConfirmationModal.getAttribute(COMPETITOR_ID_ATTR));
    logger.info("Deleting competitor", { competitorId });
    await db.competitors.delete(competitorId);
    Modal.getOrCreateInstance(elements.deleteConfirmationModal).hide();
    await updateCompetitorsTable();
  });

  elements.editCompetitorSave.addEventListener("click", async () => {
    await saveEdit();
  });

  tableSorter.setup(elements.competitors, () => { void updateCompetitorsTable(); });
  pageCommon.setupFilterInputs(
    [elements.filterName, elements.filterNationalId, elements.filterStep, elements.filterClub],
    () => { void updateCompetitorsTable(); }
  );
  pageCommon.applyNarrowFilterStyle(elements.filterNationalId);
  pageCommon.applyNarrowFilterStyle(elements.filterStep);

  await updateCompetitorsTable();
  elements.filterName.focus();
}

async function loadCompetitorDisplays(): Promise<CompetitorDisplay[]> {
  const competitors = await db.competitors.toCollection().sortBy("name");
  const clubIds = [...new Set(competitors.map(c => c.clubId))];
  const clubs = await db.clubs.where(":id").anyOf(clubIds).toArray();
  const clubMap = new Map<number, string>(clubs.map(g => [g.id, g.name]));
  logger.debug("Loaded competitors for display", { competitorCount: competitors.length, clubCount: clubs.length });
  return competitors.map(c => ({
    competitor: c,
    clubName: clubMap.get(c.clubId) ?? "",
  }));
}

async function updateCompetitorsTable() {
  const nationalIdFilter = elements.filterNationalId.value.toLowerCase();
  const nameFilter = elements.filterName.value.toLowerCase();
  const stepFilter = elements.filterStep.value.toLowerCase();
  const clubFilter = elements.filterClub.value.toLowerCase();

  const allDisplays = await loadCompetitorDisplays();

  const filtered = allDisplays
    .sort((a, b) => {
      const defaultOrder = a.competitor.name.localeCompare(b.competitor.name);
      if (tableSorter.column === null) {
        return defaultOrder;
      }
      let primary: number;
      switch (tableSorter.column) {
      case "nationalId": primary = a.competitor.identifier.localeCompare(b.competitor.identifier); break;
      case "name": primary = a.competitor.name.localeCompare(b.competitor.name); break;
      case "step":
        primary = (a.competitor.step - b.competitor.step) ||
          (hasDivisions(a.competitor.step)
            ? Division[a.competitor.division].localeCompare(Division[b.competitor.division])
            : 0);
        break;
      case "club": primary = (a.clubName ?? "").localeCompare(b.clubName ?? ""); break;
      }
      return primary !== 0 ? (tableSorter.direction === "asc" ? primary : -primary) : defaultOrder;
    })
    .filter((d) => {
      const stepStr = hasDivisions(d.competitor.step)
        ? `${d.competitor.step} ${Division[d.competitor.division]}`.toLowerCase()
        : `${d.competitor.step}`;
      return (
        d.competitor.identifier.toLowerCase().includes(nationalIdFilter) &&
        d.competitor.name.toLowerCase().includes(nameFilter) &&
        stepStr.includes(stepFilter) &&
        (d.clubName ?? "").toLowerCase().includes(clubFilter)
      );
    });

  const body = elements.competitors.tBodies[0];
  pageCommon.updateTableBody(body, filtered, createCompetitorRow, (row, display) => {
    displayCompetitorInRow(row, display);
  });
}

function createCompetitorRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for (let i = 0; i < 4; i++) {
    row.insertCell();
  }

  const editCell = row.insertCell();
  const editLink = document.createElement("a");
  editLink.href = "";
  editLink.addEventListener("click", (event) => {
    event.preventDefault();
    openEditModal(parseInt(row.getAttribute(COMPETITOR_ID_ATTR)));
  });
  const editIcon = document.createElement("i");
  editIcon.classList.add("bi", "bi-pencil-square");
  editLink.appendChild(editIcon);
  editLink.appendChild(new Text(" Edit"));
  editCell.appendChild(editLink);

  const deleteCell = row.insertCell();
  const deleteLink = document.createElement("a");
  deleteLink.href = "";
  deleteLink.addEventListener("click", (event) => {
    event.preventDefault();
    promptDelete(parseInt(row.getAttribute(COMPETITOR_ID_ATTR)));
  });
  const deleteIcon = document.createElement("i");
  deleteIcon.classList.add("bi", "bi-trash");
  deleteLink.appendChild(deleteIcon);
  deleteLink.appendChild(new Text(" Delete"));
  deleteCell.appendChild(deleteLink);

  return row;
}

function displayCompetitorInRow(row: HTMLTableRowElement, display: CompetitorDisplay) {
  const c = display.competitor;
  row.setAttribute(COMPETITOR_ID_ATTR, c.id.toString());
  row.cells[0].textContent = c.name;
  row.cells[1].textContent = c.identifier;
  row.cells[2].textContent = hasDivisions(c.step) ? `${c.step} ${Division[c.division]}` : `${c.step}`;
  row.cells[3].textContent = display.clubName;
}

async function openEditModal(competitorId: number) {
  logger.debug("Opening competitor edit modal", { competitorId });
  const competitor = await db.competitors.get(competitorId);
  if (!competitor) {
    logger.warn("Competitor not found when opening edit modal", { competitorId });
    return;
  }
  const club = await db.clubs.get(competitor.clubId);

  elements.editCompetitorModal.setAttribute(COMPETITOR_ID_ATTR, competitorId.toString());
  elements.editNationalId.value = competitor.identifier;
  elements.editName.value = competitor.name;
  elements.editStep.selectedIndex = competitor.step - 1;
  elements.editDivision.selectedIndex = competitor.division;
  pageCommon.updateDivisionVisibility(elements.editStep, "editDivisionLabel", "editDivisionCol");
  elements.editClub.value = club ? club.name : "";
  elements.editCompetitorForm.classList.remove("was-validated");

  Modal.getOrCreateInstance(elements.editCompetitorModal).show();
}

async function resolveClubId(clubName: string, existingClubId: number): Promise<number> {
  const existing = await db.clubs.get(existingClubId);
  if (existing && existing.name.toLowerCase() === clubName.toLowerCase()) {
    return existingClubId;
  }
  const found = await db.clubs.where("name").equalsIgnoreCase(clubName).first();
  if (found) {
    logger.debug("Resolved club by name match", { clubName, clubId: found.id });
    return found.id;
  }
  const newId = await db.clubs.add({ name: clubName });
  logger.info("Created new club from competitor edit", { clubName, clubId: newId });
  return newId;
}

async function saveEdit() {
  elements.editCompetitorForm.classList.add("was-validated");
  if (!elements.editCompetitorForm.checkValidity()) {
    logger.debug("Competitor edit save rejected: form invalid");
    return;
  }

  const competitorId = parseInt(elements.editCompetitorModal.getAttribute(COMPETITOR_ID_ATTR));
  const existing = await db.competitors.get(competitorId);
  if (!existing) {
    logger.warn("Competitor not found when saving edit", { competitorId });
    return;
  }

  const clubId = await resolveClubId(elements.editClub.value.trim(), existing.clubId);
  const updated = new Competitor(
    elements.editNationalId.value.trim(),
    elements.editName.value.trim(),
    parseInt(elements.editStep.value),
    parseInt(elements.editDivision.value),
    clubId,
    competitorId
  );

  logger.info("Saving competitor edit", {
    competitorId,
    name: updated.name,
    identifier: updated.identifier,
    step: updated.step,
    division: updated.division,
    clubId,
  });
  await db.competitors.put(updated);
  Modal.getOrCreateInstance(elements.editCompetitorModal).hide();
  await updateCompetitorsTable();
}

function promptDelete(competitorId: number) {
  elements.deleteConfirmationModal.setAttribute(COMPETITOR_ID_ATTR, competitorId.toString());
  Modal.getOrCreateInstance(elements.deleteConfirmationModal).show();
}
