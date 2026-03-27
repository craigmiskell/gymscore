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

declare const api: typeof import("../common/api").default;

import { db } from "./data/gymscoredb";
import { ICompetition, Competition, CompetitionState,
  Division, ICompetitor, Competitor, Club, IClub} from "../common/data";
import * as pageCommon from "./page_common";
import { Autocomplete } from "./autocomplete";
import { Collapse, Modal } from "bootstrap";
import { CompetitionCompetitorDetails, Team } from "../common/data/competition";
import { logger } from "./logger";

const COMPETITOR_ID_ATTR_NAME = "competitorId";
const CLUB_ID_ATTR_NAME = "clubId";
const TEAM_INDEX_ATTR_NAME = "teamId";

const selectedCompetitorIds = new Set<number>();

pageCommon.setup();

let competition: ICompetition = undefined;
let clubAutoComplete :Autocomplete = undefined;
let competitorAutoComplete :Autocomplete = undefined;
let teamAutoComplete :Autocomplete = undefined;
let editingCompetitorId: number | null = null;
let lastUsedStep: number | null = null;
let lastUsedDivision: number | null = null;

type SortColumn = "name" | "nationalId" | "step" | "club" | "team" | "group";
const tableSorter = new pageCommon.TableSorter<SortColumn>();

class Elements extends pageCommon.BaseElements {
  detailsEditable: HTMLDivElement = null;
  detailsCollapsedText: HTMLSpanElement = null;
  detailsEditButton: HTMLButtonElement = null;
  detailsForm: HTMLFormElement = null;
  // TODO: make these types more specific.
  competitionName: HTMLElement = null;
  competitionDate: HTMLElement = null;
  competitionLocation: HTMLElement = null;
  enableVault: HTMLElement = null;
  enableBar: HTMLElement = null;
  enableBeam: HTMLElement = null;
  enableFloor: HTMLElement = null;
  competitorName: HTMLInputElement = null;
  competitors: HTMLTableElement = null;
  addCompetitorModal: HTMLElement = null;
  competitorNameModal: HTMLInputElement = null;
  competitorIdModal: HTMLInputElement = null;
  competitorStepSelectModal: HTMLSelectElement = null;
  competitorDivisionSelectModal: HTMLSelectElement = null;
  competitorClubModal: HTMLInputElement = null;
  competitorTeamModal: HTMLInputElement = null;
  addCompetitorButton: HTMLButtonElement = null;
  competitorDetailsForm: HTMLFormElement = null;
  groupSelectTemplate: HTMLSelectElement = null;
  createRecorderSheetsButton: HTMLButtonElement = null;
  createProgrammeButton: HTMLButtonElement = null;
  filterName: HTMLInputElement = null;
  filterNationalId: HTMLInputElement = null;
  filterStep: HTMLInputElement = null;
  filterClub: HTMLInputElement = null;
  filterTeam: HTMLInputElement = null;
  duplicateCompetitorError: HTMLDivElement = null;
  competitorAlreadyAddedWarning: HTMLDivElement = null;
  nationalIdDuplicateWarning: HTMLDivElement = null;
  selectAllCheckbox: HTMLInputElement = null;
  groupAssignToolbar: HTMLDivElement = null;
  groupAssignGuidance: HTMLSpanElement = null;
  groupAssignCount: HTMLSpanElement = null;

}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  pageCommon.findElements(elements);

  const urlParams = new URLSearchParams(window.location.search);
  const compId = urlParams.get("compId");
  logger.debug("prepare_competition loaded", { compId });

  await loadCompetition(parseInt(compId));

  elements.detailsEditButton.addEventListener("click", onDetailsButtonClick);
  elements.detailsEditable.addEventListener("show.bs.collapse", onDetailsExpanding);
  elements.detailsEditable.addEventListener("hidden.bs.collapse", onDetailsHidden);
  elements.competitionName.addEventListener("input", autoSave);
  elements.competitionDate.addEventListener("input", autoSave);
  elements.competitionLocation.addEventListener("input", autoSave);
  elements.enableVault.addEventListener("change", autoSave);
  elements.enableBar.addEventListener("change", autoSave);
  elements.enableBeam.addEventListener("change", autoSave);
  elements.enableFloor.addEventListener("change", autoSave);
  document.getElementById("addCompetitorButton").addEventListener("click", openAddCompetitorModal);
  elements.addCompetitorModal.addEventListener("hidden.bs.modal", () => {
    elements.competitorName.focus();
  });
  document.getElementById("create-fake-competitors-button").addEventListener("click", populateFakeCompetitors);
  document.getElementById("addCompetitorModalYes").addEventListener("click", addCompetitor);
  elements.competitorIdModal.addEventListener("input", () => {
    clearTimeout(nationalIdCheckTimer);
    nationalIdCheckTimer = setTimeout(() => { void checkNationalIdDuplicate(); }, 300);
  });
  elements.competitorIdModal.addEventListener("blur", () => {
    clearTimeout(nationalIdCheckTimer);
    void checkNationalIdDuplicate();
  });
  elements.competitorTeamModal.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void addCompetitor();
    }
  });
  elements.createRecorderSheetsButton.addEventListener("click", createRecorderSheets);
  elements.createProgrammeButton.addEventListener("click", createProgramme);

  await setupCompetitorAutoComplete();
  await setupClubAutoComplete();
  await setupTeamAutoComplete();
  tableSorter.setup(elements.competitors, updateCompetitorsTable);
  elements.selectAllCheckbox.addEventListener("change", selectAllChanged);
  setupGroupAssignToolbar();
  pageCommon.setupFilterInputs(
    [elements.filterName, elements.filterNationalId, elements.filterStep, elements.filterClub, elements.filterTeam],
    updateCompetitorsTable
  );
  // Bootstrap's form-control sets width: 100%, which causes the table layout algorithm to size
  // this column by its header text ("National ID") rather than its content. CSS overrides on the
  // th are ignored for the same reason. Setting directly on the input here is the reliable fix.
  elements.filterNationalId.style.width = "13ch";
  elements.filterNationalId.style.minWidth = "0";
  elements.filterStep.style.width = "13ch";
  elements.filterStep.style.minWidth = "0";
  updateCompetitorsTable();
  populateStepSelectModal();

  if (competition == undefined) {
    elements.detailsEditable.addEventListener("shown.bs.collapse", () => {
      (<HTMLInputElement>elements.competitionName).focus();
    }, { once: true });
    Collapse.getOrCreateInstance(elements.detailsEditable, { toggle: false }).show();
  } else {
    setFormFieldsEnabled(false);
  }
}

function populateStepSelectModal() {
  const select = elements.competitorStepSelectModal;
  for (let i=1; i <= 10; i++) {
    select.add(new Option(i.toString(), i.toString()));
  }
}

async function removeCompetitor(event: Event) {
  // Do this *first* so we get a chance to catch errors and not immediately reload the page
  event.preventDefault();

  const competitorId = parseInt((<HTMLAnchorElement>event.currentTarget).getAttribute(COMPETITOR_ID_ATTR_NAME));
  logger.info("Removing competitor from competition", { competitorId, competitionId: competition.id });
  selectedCompetitorIds.delete(competitorId);
  competition.removeCompetitorById(competitorId);
  await db.competitions.update(competition.id, competition);
  updateGroupAssignToolbar();
  updateCompetitorsTable();
}

function displayCompetitorInRow(row: HTMLTableRowElement, competitor: CompetitionCompetitorDetails) {
  const competitorIdString = competitor.competitorId.toString();

  const checkbox = <HTMLInputElement>row.cells[0].firstChild;
  checkbox.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
  checkbox.checked = selectedCompetitorIds.has(competitor.competitorId);

  row.cells[1].textContent = competitor.competitorName;
  row.cells[2].textContent = competitor.competitorIdentifier;
  row.cells[3].textContent = competitor.step + " " + Division[competitor.division];
  row.cells[4].textContent = competitor.clubName;
  row.cells[5].textContent = competition.teams[competitor.teamIndex]?.name ?? "";

  const groupSelect = <HTMLSelectElement>row.cells[6].firstChild;
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
  const newGroupSelect = <HTMLSelectElement>document.createElement("select");
  newGroupSelect.classList.add("form-select","form-select-sm");
  newGroupSelect.add(new Option("None", "0"));
  for (let i=1; i < 10; i++) {
    newGroupSelect.add(new Option(i.toString(), i.toString()));
  }
  newGroupSelect.id = `groupSelect-${index}`;
  newGroupSelect.addEventListener("click", groupSelectChanged);
  return newGroupSelect;
}

function createCompetitorRow(tableSection: HTMLTableSectionElement, index: number): HTMLTableRowElement {
  const row = tableSection.insertRow(-1);
  for(let i=0; i < 9; i++) {
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
      case "step": primary = (a.step - b.step) || Division[a.division].localeCompare(Division[b.division]); break;
      case "club": primary = clubA.localeCompare(clubB); break;
      case "team": primary = teamA.localeCompare(teamB); break;
      case "group": primary = (a.groupNumber || 0) - (b.groupNumber || 0); break;
      }
      return (primary !== 0 ? (tableSorter.direction === "asc" ? primary : -primary) : defaultOrder);
    })
    .filter((competitor) => {
      const stepStr = `${competitor.step} ${Division[competitor.division]}`.toLowerCase();
      const teamName = (competition.teams[competitor.teamIndex]?.name ?? "").toLowerCase();
      return (
        competitor.competitorName.toLowerCase().includes(nameFilter) &&
        (competitor.competitorIdentifier ?? "").toLowerCase().includes(nationalIdFilter) &&
        stepStr.includes(stepFilter) &&
        (competitor.clubName ?? "").toLowerCase().includes(clubFilter) &&
        teamName.includes(teamFilter)
      );
    });

  while (tableBody.rows.length > filtered.length) {
    tableBody.deleteRow(-1);
  }

  filtered.forEach((competitor, rowIndex) => {
    let row = tableBody.rows[rowIndex];
    if (row == undefined) {
      row = createCompetitorRow(tableBody, rowIndex);
    }
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

function setupAutocomplete(
  data: AutoCompleteData,
  field: HTMLInputElement,
  attribute: string,
  callbackOnInput?: AutoCompleteCallbackOnInputFunc,
  showOnFocus?: boolean,
  callbackOnSelect?: () => void,
) {

  return new Autocomplete(
    field,
    {
      data: data,
      threshold: 1,
      maximumItems: 8,
      showOnFocus: showOnFocus ?? false,
      onSelectItem: (selected: {label: string, value: string}) => {
        logger.debug("Item selected by autocomplete", { label: selected.label, value: selected.value, attribute });
        field.setAttribute(attribute, selected.value);
        if (typeof callbackOnSelect !== "undefined") {
          callbackOnSelect();
        }
      },
      onInput:() => {
        // If the user types, clear the selection
        field.removeAttribute(attribute);
        if (typeof callbackOnInput !== "undefined") {
          callbackOnInput();
        }
      }
    }
  );
}

//TODO: convert to 'setupAutocomplete'
async function setupCompetitorAutoComplete() {
  const competitors = await fetchCompetitorsForAutocomplete();

  const competitorNameField = elements.competitorName;
  competitorAutoComplete = new Autocomplete(
    competitorNameField,
    {
      data: competitors,
      threshold: 1,
      maximumItems: 8,
      onSelectItem: (selected: {label: string, value: string}) => {
        logger.debug("Competitor selected by autocomplete", { label: selected.label, competitorId: selected.value });
        competitorNameField.setAttribute(COMPETITOR_ID_ATTR_NAME, selected.value);
        const alreadyAdded = competition?.competitors.some((c) => c.competitorId === parseInt(selected.value));
        if (alreadyAdded) {
          logger.debug("Autocomplete-selected competitor already in competition", { competitorId: selected.value });
          elements.competitorAlreadyAddedWarning.classList.remove("d-none");
          return;
        }
        void openAddCompetitorModal();
      },
      onInput:() => {
        // If the user types, clear the selection
        competitorNameField.removeAttribute(COMPETITOR_ID_ATTR_NAME);
        elements.addCompetitorButton.disabled = (competitorNameField.value == "");
        elements.competitorAlreadyAddedWarning.classList.add("d-none");
      }
    }
  );

  competitorNameField.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter" || competitorNameField.value === "") {
      return;
    }
    e.preventDefault();

    if (!competitorNameField.hasAttribute(COMPETITOR_ID_ATTR_NAME)) {
      const dropdownMenu = competitorNameField.nextSibling as HTMLElement;
      const items = dropdownMenu.querySelectorAll(".dropdown-item");
      if (items.length === 1) {
        (items[0] as HTMLElement).click();
      }
    }

    void openAddCompetitorModal();
  });
}

//TODO: convert to 'setupAutocomplete'
async function setupClubAutoComplete() {
  const clubs = await fetchClubsForAutocomplete();

  const clubField = elements.competitorClubModal;
  clubAutoComplete = new Autocomplete(
    clubField,
    {
      data: clubs,
      threshold: 1,
      maximumItems: 8,
      onSelectItem: async (selected: {label: string, value: string}) => {
        const clubId = selected.value;
        logger.debug("Club selected by autocomplete", { label: selected.label, clubId });
        clubField.setAttribute(CLUB_ID_ATTR_NAME, clubId);
        teamAutoComplete.setData(await fetchTeamsForClubForAutoComplete(parseInt(clubId)));
        elements.competitorTeamModal.focus();
      },
      onInput:() => {
        // If the user types, clear the selection
        clubField.removeAttribute(CLUB_ID_ATTR_NAME);
        teamAutoComplete.setData([]);
      },
      showOnFocus: true,
    }
  );

  clubField.addEventListener("blur", async () => {
    if (clubField.hasAttribute(CLUB_ID_ATTR_NAME)) {
      return; // Already set by autocomplete selection
    }
    const existingClub = await db.clubs.where("name").equalsIgnoreCase(clubField.value).first();
    if (existingClub) {
      clubField.setAttribute(CLUB_ID_ATTR_NAME, existingClub.id.toString());
      teamAutoComplete.setData(await fetchTeamsForClubForAutoComplete(existingClub.id));
    }
  });
}

async function setupTeamAutoComplete() {
  teamAutoComplete = setupAutocomplete(
    [], // Can't do anything until we have a club, in the competitor modal
    elements.competitorTeamModal,
    TEAM_INDEX_ATTR_NAME,
    undefined,
    true,
    () => { elements.competitorTeamModal.focus(); },
  );
}

async function openAddCompetitorModal() {
  editingCompetitorId = null;
  const competitorIdString = elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME);
  const competitorId = parseInt(competitorIdString);
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);

  document.getElementById("addCompetitorModalTitle").textContent = "Adding competitor";
  document.getElementById("addCompetitorModalYes").textContent = "Add to competition";

  elements.addCompetitorModal.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);

  let competitor: ICompetitor;
  if(isNaN(competitorId)) {
    // Just a placeholder; we'll create a new one on save.  No ID, no club
    competitor = new Competitor("", elements.competitorName.value, 1, Division.Under, -1);
    elements.competitorNameModal.disabled = false;
    elements.competitorIdModal.disabled = false;
  } else {
    competitor = await db.competitors.where(":id").equals(competitorId).first();
    elements.competitorNameModal.disabled = true; //Cannot edit this here and now; autocomplete found it
    elements.competitorIdModal.disabled = true;
    elements.competitorClubModal.setAttribute(CLUB_ID_ATTR_NAME, competitor.clubId.toString());
  }

  // Populate modal fields
  elements.competitorNameModal.value = competitor.name;
  elements.competitorIdModal.value = competitor.identifier;
  elements.competitorStepSelectModal.selectedIndex = competitor.step - 1;
  elements.competitorTeamModal.value = "";
  elements.competitorTeamModal.removeAttribute(TEAM_INDEX_ATTR_NAME);

  const club = await clubForCompetitor(competitor);
  if(club) {
    elements.competitorClubModal.value = club.name;
    teamAutoComplete.setData(await fetchTeamsForClubForAutoComplete(club.id));
  } else {
    elements.competitorClubModal.value = "";
    elements.competitorClubModal.removeAttribute(CLUB_ID_ATTR_NAME);
    teamAutoComplete.setData([]);
  }

  if (lastUsedStep !== null) {
    elements.competitorStepSelectModal.value = lastUsedStep.toString();
    elements.competitorDivisionSelectModal.value = lastUsedDivision.toString();
  }

  elements.competitorDetailsForm.classList.remove("was-validated");
  elements.duplicateCompetitorError.classList.add("d-none");
  nationalIdIsDuplicate = false;
  elements.nationalIdDuplicateWarning.classList.add("d-none");

  elements.addCompetitorModal.addEventListener("shown.bs.modal", () => {
    const fields: HTMLInputElement[] = [
      elements.competitorNameModal,
      elements.competitorIdModal,
      elements.competitorClubModal,
      elements.competitorTeamModal,
    ];
    const firstEmpty = fields.find((f) => !f.disabled && f.value === "");
    firstEmpty?.focus();
  }, { once: true });

  modal.show();
}

function editCompetitor(event: Event) {
  event.preventDefault();
  const competitorId = parseInt((<HTMLAnchorElement>event.currentTarget).getAttribute(COMPETITOR_ID_ATTR_NAME));
  void openEditCompetitorModal(competitorId);
}

async function openEditCompetitorModal(competitorId: number) {
  editingCompetitorId = competitorId;
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);

  document.getElementById("addCompetitorModalTitle").textContent = "Editing competitor";
  document.getElementById("addCompetitorModalYes").textContent = "Save changes";

  const competitorDetails = competition.getCompetitorById(competitorId);
  const competitor = await db.competitors.where(":id").equals(competitorId).first();

  elements.competitorNameModal.value = competitor.name;
  elements.competitorNameModal.disabled = true;
  elements.competitorIdModal.value = competitor.identifier;
  elements.competitorIdModal.disabled = true;
  elements.competitorStepSelectModal.selectedIndex = competitorDetails.step - 1;
  elements.competitorDivisionSelectModal.value = competitorDetails.division.toString();

  // Clear team value before setData so the autocomplete dropdown doesn't appear
  elements.competitorTeamModal.value = "";
  elements.competitorTeamModal.removeAttribute(TEAM_INDEX_ATTR_NAME);

  const club = await clubById(competitorDetails.clubId);
  if (club) {
    elements.competitorClubModal.value = club.name;
    elements.competitorClubModal.setAttribute(CLUB_ID_ATTR_NAME, club.id.toString());
    teamAutoComplete.setData(await fetchTeamsForClubForAutoComplete(club.id));
  } else {
    elements.competitorClubModal.value = "";
    elements.competitorClubModal.removeAttribute(CLUB_ID_ATTR_NAME);
    teamAutoComplete.setData([]);
  }

  elements.competitorTeamModal.value = competition.teams[competitorDetails.teamIndex]?.name ?? "";

  elements.competitorDetailsForm.classList.remove("was-validated");
  elements.duplicateCompetitorError.classList.add("d-none");
  nationalIdIsDuplicate = false;
  elements.nationalIdDuplicateWarning.classList.add("d-none");

  elements.addCompetitorModal.addEventListener("shown.bs.modal", () => {
    elements.competitorStepSelectModal.focus();
  }, { once: true });

  modal.show();
}

async function saveEditedCompetitor() {
  logger.info("Saving edited competitor", { editingCompetitorId, competitionId: competition.id });
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);
  modal.hide();

  const clubId = await clubIdWhenAddingCompetitor();
  const club = await clubById(clubId);
  const competitorDetails = competition.getCompetitorById(editingCompetitorId);

  const oldClubId = competitorDetails.clubId;
  const newTeamIndex = await teamIndexWhenAddingCompetitor(club);

  const competitor = await db.competitors.where(":id").equals(editingCompetitorId).first();
  competitor.step = parseInt(elements.competitorStepSelectModal.value);
  competitor.division = parseInt(elements.competitorDivisionSelectModal.value);
  competitor.clubId = clubId;
  await db.competitors.put(competitor);

  competitorDetails.step = parseInt(elements.competitorStepSelectModal.value);
  competitorDetails.division = parseInt(elements.competitorDivisionSelectModal.value);
  competitorDetails.clubId = clubId;
  competitorDetails.clubName = club.name;
  competitorDetails.teamIndex = newTeamIndex;

  pruneEmptyTeams(oldClubId);
  if (clubId !== oldClubId) {
    pruneEmptyTeams(clubId);
  }

  await db.competitions.update(competition.id, competition);
  logger.info("Competitor edit saved", {
    competitorId: editingCompetitorId,
    step: competitorDetails.step,
    division: competitorDetails.division,
    clubId,
    clubName: club.name,
  });
  competitorAutoComplete.setData(await fetchCompetitorsForAutocomplete());
  updateCompetitorsTable();
  editingCompetitorId = null;
}

function pruneEmptyTeams(clubId: number) {
  const indicesToRemove = competition.teams
    .map((team, index) => ({ team, index }))
    .filter(({ team, index }) =>
      team.clubId === clubId && !competition.competitors.some((c) => c.teamIndex === index)
    )
    .map(({ index }) => index)
    .sort((a, b) => b - a);

  for (const removeIndex of indicesToRemove) {
    competition.teams.splice(removeIndex, 1);
    for (const c of competition.competitors) {
      if (c.teamIndex !== null && c.teamIndex > removeIndex) {
        c.teamIndex--;
      }
    }
  }
}

async function clubIdWhenAddingCompetitor() : Promise<number> {
  const clubField = elements.competitorClubModal;

  if(clubField.hasAttribute(CLUB_ID_ATTR_NAME)) {
    return parseInt(clubField.getAttribute(CLUB_ID_ATTR_NAME));
  }
  const existingClub = await db.clubs.where("name").equalsIgnoreCase(clubField.value).first();
  if (existingClub != undefined) {
    logger.debug("Club matched by name; reusing existing", { clubName: clubField.value, clubId: existingClub.id });
    clubField.setAttribute(CLUB_ID_ATTR_NAME, existingClub.id.toString());
    return existingClub.id;
  }
  logger.info("Creating new club", { clubName: clubField.value });
  const clubId = await db.clubs.put(new Club(clubField.value));
  clubField.setAttribute(CLUB_ID_ATTR_NAME, clubId.toString());
  clubAutoComplete.setData(await fetchClubsForAutocomplete());
  return clubId;
}

async function teamIndexWhenAddingCompetitor(club: IClub) : Promise<number | null> {
  const teamField = elements.competitorTeamModal;

  if (teamField.value.trim() === "") {
    return null;
  }

  if(teamField.hasAttribute(TEAM_INDEX_ATTR_NAME)) {
    return parseInt(teamField.getAttribute(TEAM_INDEX_ATTR_NAME));
  }

  const existingTeamIndex = competition.teams.findIndex((team) =>
    team.name.toLowerCase() == teamField.value.toLowerCase() && team.clubId == club.id
  );

  if(existingTeamIndex != -1) {
    logger.debug("Team matched by name; reusing existing", {
      teamName: teamField.value, clubName: club.name, teamIndex: existingTeamIndex,
    });
    return existingTeamIndex;
  }

  logger.info("Creating new team", { teamName: teamField.value, clubName: club.name, clubId: club.id });
  const team = new Team(teamField.value, club.id);
  const teamIndex = competition.teams.push(team) - 1; //
  teamField.setAttribute(TEAM_INDEX_ATTR_NAME, teamIndex.toString());

  return teamIndex;
}

async function addCompetitor() {
  const form = elements.competitorDetailsForm;
  if (!form.checkValidity()) {
    logger.debug("Add competitor rejected: form invalid");
    form.classList.add("was-validated");
    return;
  }

  if (editingCompetitorId !== null) {
    logger.debug("Delegating to saveEditedCompetitor", { editingCompetitorId });
    await saveEditedCompetitor();
    return;
  }

  const nameToAdd = elements.competitorNameModal.value;
  const identifierToAdd = elements.competitorIdModal.value;
  const isDuplicate = competition.competitors.some((c) =>
    c.competitorName === nameToAdd && c.competitorIdentifier === identifierToAdd
  );
  if (isDuplicate) {
    logger.warn("Duplicate competitor rejected", { name: nameToAdd, identifier: identifierToAdd });
    elements.duplicateCompetitorError.classList.remove("d-none");
    return;
  }
  if (nationalIdIsDuplicate) {
    logger.warn("Competitor add rejected: national ID duplicate", { identifier: identifierToAdd });
    return;
  }
  logger.debug("Adding competitor to competition", {
    name: nameToAdd,
    identifier: identifierToAdd,
    step: elements.competitorStepSelectModal.value,
    division: elements.competitorDivisionSelectModal.value,
    competitionId: competition.id,
  });

  let competitorId;
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);
  // Hide early, so any failures the modal will be gone and the user can continue.
  modal.hide();

  lastUsedStep = parseInt(elements.competitorStepSelectModal.value);
  lastUsedDivision = parseInt(elements.competitorDivisionSelectModal.value);

  const clubId = await clubIdWhenAddingCompetitor();
  const club = await clubById(clubId);
  const teamId = await teamIndexWhenAddingCompetitor(club);
  let competitor;

  if(elements.competitorName.hasAttribute(COMPETITOR_ID_ATTR_NAME)) {
    competitorId = elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME);
    // Update competitor with current step + club (for future)
    competitor = await db.competitors.where(":id").equals(parseInt(competitorId)).first();
    competitor.step = parseInt(elements.competitorStepSelectModal.value);
    competitor.division = parseInt(elements.competitorDivisionSelectModal.value);
    competitor.clubId = clubId;
    await db.competitors.put(competitor);
  } else {
    // No auto-completed competitor; create a new one
    competitor = new Competitor(
      elements.competitorIdModal.value,
      elements.competitorNameModal.value,
      parseInt(elements.competitorStepSelectModal.value),
      parseInt(elements.competitorDivisionSelectModal.value),
      clubId);
    competitorId = await db.competitors.put(competitor);
  }
  // Clear the name field before setData so the autocomplete dropdown doesn't reappear
  elements.competitorName.value = "";
  elements.competitorName.removeAttribute(COMPETITOR_ID_ATTR_NAME);
  elements.addCompetitorButton.disabled = true;
  elements.competitorAlreadyAddedWarning.classList.add("d-none");

  // Always update; for new competitor, or if the club has changed on an existing competitor
  competitorAutoComplete.setData(await fetchCompetitorsForAutocomplete());

  competition.competitors.push(new CompetitionCompetitorDetails(
    competitor,
    parseInt(elements.competitorStepSelectModal.value),
    parseInt(elements.competitorDivisionSelectModal.value),
    clubId,
    club.name, // A convenience, because we need it in the main process and won't be able to look things up in the DB.
    teamId,
    0, // Default is "no group", index 0
  ));
  await db.competitions.update(competition.id, competition);
  logger.info("Competitor added to competition", {
    competitorId: competitor.id,
    name: competitor.name,
    identifier: competitor.identifier,
    clubName: club.name,
    competitionId: competition.id,
    totalCompetitors: competition.competitors.length,
  });
  updateCompetitorsTable();
  elements.competitorTeamModal.value = "";
}

async function groupSelectChanged(event: Event) {
  const select = <HTMLSelectElement>event.target;
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

async function clubById(id: number) : Promise<IClub> {
  // TODO: cache (local, or in a DAO layer)
  if(isNaN(id)) {
    return undefined; // Mostly belt'n'braces for old bugs.
  }
  const clubs = db.clubs.where(":id").equals(id);
  if (await clubs.count() == 0) {
    return undefined;
  }
  return clubs.first();
}

async function clubForCompetitor(competitor: ICompetitor) : Promise<IClub> {
  return await clubById(competitor.clubId);
}

async function fetchCompetitorsForAutocomplete() {
  const competitors = await db.competitors.toArray();
  return await Promise.all(competitors.map(async (c: ICompetitor) => {
    const club = await clubForCompetitor(c);
    return {
      label: `${c.name} (${c.identifier}) - ${club?.name}`,
      value: c.id
    };
  }));
}

async function fetchClubsForAutocomplete() {
  const clubs = await db.clubs.toArray();
  return await Promise.all(clubs.map(async (g: IClub) => {
    return {
      label: g.name,
      value: g.id
    };
  }));
}

async function fetchTeamsForClubForAutoComplete(clubId: number) {
  if(competition == undefined ) {
    return [];
  }

  return competition.teams.map((team: Team, index: number) => {
    return {
      label: team.name,
      value: index,
      clubId: team.clubId,
    };
  }).filter(team => {
    return team.clubId == clubId;
  }).sort((a, b) => a.label.localeCompare(b.label));
}

function updateCollapsedText(competition: ICompetition) {
  elements.detailsCollapsedText.innerText = `${competition.name} - ${competition.date} - ${competition.location}`;
}

async function loadCompetition(compId: number) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      competition.teams = competition.teams ?? [];
      competition.competitors = competition.competitors ?? [];
      logger.info("Competition loaded", {
        compId,
        name: competition.name,
        date: competition.date,
        location: competition.location,
        competitorCount: competition.competitors.length,
        teamCount: competition.teams.length,
        vault: competition.vault,
        bar: competition.bar,
        beam: competition.beam,
        floor: competition.floor,
        state: competition.state,
      });
      (<HTMLInputElement>elements.competitionName).value = competition.name;
      (<HTMLInputElement>elements.competitionDate).value = competition.date;
      (<HTMLInputElement>elements.competitionLocation).value = competition.location;
      (<HTMLInputElement>elements.enableBar).checked = competition.bar;
      (<HTMLInputElement>elements.enableBeam).checked = competition.beam;
      (<HTMLInputElement>elements.enableFloor).checked = competition.floor;
      (<HTMLInputElement>elements.enableVault).checked = competition.vault;
      updateCollapsedText(competition);
    } else {
      logger.warn("Competition not found in DB", { compId });
    }
  } else {
    logger.info("No competition ID in URL; creating new competition");
    (<HTMLInputElement>elements.enableBar).checked =
    (<HTMLInputElement>elements.enableBeam).checked =
    (<HTMLInputElement>elements.enableFloor).checked =
    (<HTMLInputElement>elements.enableVault).checked = true;
  }
}

async function saveCompetitionDetails() {
  if (competition) {
    competition.name = (<HTMLInputElement>elements.competitionName).value;
    competition.date = (<HTMLInputElement>elements.competitionDate).value;
    competition.location = (<HTMLInputElement>elements.competitionLocation).value;
    competition.state = CompetitionState.Preparing;
    populateCompetitionDisciplines(competition);
    logger.debug("Auto-saving competition details", {
      competitionId: competition.id,
      name: competition.name,
      date: competition.date,
      location: competition.location,
      vault: competition.vault,
      bar: competition.bar,
      beam: competition.beam,
      floor: competition.floor,
    });
    db.competitions.put(competition);
  } else {
    competition = await createCompetition();
  }
  updateCollapsedText(competition);
}

// Called by the 'save' button when there is no pre-existing competition
async function createCompetition() {
  competition = new Competition(
    (<HTMLInputElement>elements.competitionName).value,
    (<HTMLInputElement>elements.competitionDate).value,
    (<HTMLInputElement>elements.competitionLocation).value,
  );
  populateCompetitionDisciplines(competition);
  await db.competitions.add(competition);
  logger.info("New competition created", {
    competitionId: competition.id,
    name: competition.name,
    date: competition.date,
    location: competition.location,
    vault: competition.vault,
    bar: competition.bar,
    beam: competition.beam,
    floor: competition.floor,
  });
  return competition;
}

function populateCompetitionDisciplines(competition: ICompetition) {
  competition.vault = (<HTMLInputElement>elements.enableVault).checked;
  competition.bar = (<HTMLInputElement>elements.enableBar).checked;
  competition.beam = (<HTMLInputElement>elements.enableBeam).checked;
  competition.floor = (<HTMLInputElement>elements.enableFloor).checked;
}

function setFormFieldsEnabled(enabled: boolean) {
  const fields = [
    elements.competitionName, elements.competitionDate,
    elements.competitionLocation, elements.enableBar, elements.enableBeam,
    elements.enableFloor, elements.enableVault
  ];
  for (const field of fields) {
    field.classList.toggle("disabled", !enabled);
    (<HTMLInputElement>field).disabled = !enabled;
  }
}

function onDetailsButtonClick() {
  const collapse = Collapse.getOrCreateInstance(elements.detailsEditable, { toggle: false });
  if (elements.detailsEditable.classList.contains("show")) {
    collapse.hide();
  } else {
    collapse.show();
  }
}

let nationalIdIsDuplicate = false;
let nationalIdCheckTimer: ReturnType<typeof setTimeout> = null;

async function checkNationalIdDuplicate() {
  const identifier = elements.competitorIdModal.value.trim();
  if (!identifier) {
    nationalIdIsDuplicate = false;
    elements.nationalIdDuplicateWarning.classList.add("d-none");
    return;
  }
  const existing = await db.competitors.where("identifier").equalsIgnoreCase(identifier).first();
  nationalIdIsDuplicate = existing != null;
  if (nationalIdIsDuplicate) {
    logger.debug("National ID duplicate detected", { identifier, existingCompetitorId: existing.id });
  }
  elements.nationalIdDuplicateWarning.classList.toggle("d-none", !nationalIdIsDuplicate);
}

let autoSaveTimer: ReturnType<typeof setTimeout> = null;

function autoSave() {
  if (!(<HTMLFormElement>elements.detailsForm).checkValidity()) {
    return;
  }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => { void saveCompetitionDetails(); }, 300);
}

function onDetailsExpanding() {
  elements.detailsForm.classList.remove("was-validated");
  setFormFieldsEnabled(true);
  elements.detailsEditButton.classList.remove("collapsed");
  elements.detailsEditButton.setAttribute("aria-expanded", "true");
}

function onDetailsHidden() {
  elements.detailsEditButton.classList.add("collapsed");
  elements.detailsEditButton.setAttribute("aria-expanded", "false");
}

type AutoCompleteData = {
  label: string,
  value: number,
}[];

type AutoCompleteCallbackOnInputFunc = {
  (): void;
}

function createRecorderSheets() {
  logger.info("Requesting recorder sheets PDF", { competitionId: competition.id, competitionName: competition.name });
  api.sendAsync("generate-pdfs", {type: "recorder-sheets", competition: competition});
}

function createProgramme() {
  logger.info("Requesting programme PDF", { competitionId: competition.id, competitionName: competition.name });
  api.sendAsync("generate-pdfs", {type: "programme", competition: competition});
}

async function populateFakeCompetitors() {
  db.competitors.toCollection().delete();

  const firstNames = ["Amelia", "Barbara", "Collette", "Daphne", "Erin", "Francis", "Geri", "Harriet", "Isabelle",
    "Jeanette", "Karen", "Lisa", "Margaret", "Nancy", "Ophelia", "Paris", "Rosie", "Susan", "Teri", "Ursula", "Vivian",
    "Wendy", "Xavier", "Yvette", "Zorro"];
  const lastNames = ["White", "Green", "Black", "Brown", "Purple", "Red", "Yellow", "Pink", "Mauve", "Taupe", "Orange",
    "Indigo", "Violet", "Turquoise"];
  const club = new Club("St Bernadettes", 1);
  db.clubs.put(club);
  for (let i=0; i < 20; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    db.competitors.put(new Competitor(
      `a${i}`,
      `${firstName} ${lastName}`,
      Math.floor(Math.random() * 9)+1,
      Math.random() < 0.5 ? Division.Under : Division.Over,
      club.id
    ));
  }
}

// TODO: some sort of alert if not all competitors are in groups
