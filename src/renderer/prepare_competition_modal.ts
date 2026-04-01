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
import { Division, ICompetitor, Competitor, Club, IClub } from "../common/data";
import * as pageCommon from "./page_common";
import { Autocomplete } from "./autocomplete";
import { Modal } from "bootstrap";
import { CompetitionCompetitorDetails, CompetitionData, Team } from "../common/data/competition";
import { logger } from "./logger";
import {
  elements, competition,
  COMPETITOR_ID_ATTR_NAME, CLUB_ID_ATTR_NAME, TEAM_INDEX_ATTR_NAME,
} from "./prepare_competition_state";

type AutoCompleteData = { label: string, value: number }[];
type AutoCompleteCallbackOnInputFunc = () => void;

let clubAutoComplete: Autocomplete = undefined;
let competitorAutoComplete: Autocomplete = undefined;
let teamAutoComplete: Autocomplete = undefined;

let editingCompetitorId: number | null = null;
let lastUsedStep: number | null = null;
let lastUsedDivision: number | null = null;

let nationalIdIsDuplicate = false;
let nationalIdCheckTimer: ReturnType<typeof setTimeout> = null;

// Set during setupCompetitorSection; called after any operation that changes the competitor list.
let onCompetitorListChanged: () => void;

export async function setupCompetitorSection(onListChanged: () => void) {
  onCompetitorListChanged = onListChanged;

  elements.addCompetitorButton.addEventListener("click", openAddCompetitorModal);
  elements.addCompetitorModal.addEventListener("hidden.bs.modal", () => {
    elements.competitorName.focus();
  });
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
  await setupCompetitorAutoComplete();
  await setupClubAutoComplete();
  await setupTeamAutoComplete();
  populateStepSelectModal();
}

function populateStepSelectModal() {
  const select = elements.competitorStepSelectModal;
  pageCommon.populateStepSelect(select);
  select.addEventListener("change", () => {
    pageCommon.updateDivisionVisibility(
      elements.competitorStepSelectModal, "competitorDivisionLabelModal", "competitorDivisionColModal"
    );
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
      onInput: () => {
        // If the user types, clear the selection
        field.removeAttribute(attribute);
        if (typeof callbackOnInput !== "undefined") {
          callbackOnInput();
        }
      }
    }
  );
}

async function setupCompetitorAutoComplete() {
  const competitorNameField = elements.competitorName;
  competitorAutoComplete = setupAutocomplete(
    await fetchCompetitorsForAutocomplete(),
    competitorNameField,
    COMPETITOR_ID_ATTR_NAME,
    () => {
      elements.addCompetitorButton.disabled = (competitorNameField.value === "");
      elements.competitorAlreadyAddedWarning.classList.add("d-none");
    },
    false,
    () => {
      const competitorId = competitorNameField.getAttribute(COMPETITOR_ID_ATTR_NAME);
      const alreadyAdded = competition?.competitors.some((c) => c.competitorId === parseInt(competitorId ?? ""));
      if (alreadyAdded) {
        logger.debug("Autocomplete-selected competitor already in competition", { competitorId });
        elements.competitorAlreadyAddedWarning.classList.remove("d-none");
        return;
      }
      void openAddCompetitorModal();
    },
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

async function setupClubAutoComplete() {
  const clubField = elements.competitorClubModal;
  clubAutoComplete = setupAutocomplete(
    await fetchClubsForAutocomplete(),
    clubField,
    CLUB_ID_ATTR_NAME,
    () => { updateTeamSuggestion(clubField.value, []); },
    true,
    () => {
      const clubId = clubField.getAttribute(CLUB_ID_ATTR_NAME);
      void fetchTeamsForClubForAutoComplete(parseInt(clubId ?? "")).then((data) => {
        updateTeamSuggestion(clubField.value, data);
        elements.competitorTeamModal.focus();
      });
    },
  );

  clubField.addEventListener("blur", async () => {
    if (clubField.hasAttribute(CLUB_ID_ATTR_NAME)) {
      return; // Already set by autocomplete selection
    }
    const existingClub = await db.clubs.where("name").equalsIgnoreCase(clubField.value).first();
    if (existingClub) {
      clubField.setAttribute(CLUB_ID_ATTR_NAME, existingClub.id.toString());
      updateTeamSuggestion(existingClub.name, await fetchTeamsForClubForAutoComplete(existingClub.id));
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
    () => {
      // Sentinel value -1 means the suggestion item (team doesn't exist yet); remove the attribute
      // so teamIndexWhenAddingCompetitor creates a new team from the text value.
      if (elements.competitorTeamModal.getAttribute(TEAM_INDEX_ATTR_NAME) === "-1") {
        elements.competitorTeamModal.removeAttribute(TEAM_INDEX_ATTR_NAME);
      }
      elements.competitorTeamModal.focus();
    },
  );
}

function updateTeamSuggestion(clubName: string, teamsData: AutoCompleteData) {
  const trimmed = clubName.trim();
  if (teamsData.length === 0 && trimmed !== "") {
    const suggested = `${trimmed} 1`;
    elements.competitorTeamModal.placeholder = suggested;
    teamAutoComplete.setData([{ label: suggested, value: -1 }]);
  } else {
    elements.competitorTeamModal.placeholder = "";
    teamAutoComplete.setData(teamsData);
  }
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
  if (isNaN(competitorId)) {
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

  const club = await clubById(competitor.clubId);
  if (club) {
    elements.competitorClubModal.value = club.name;
    updateTeamSuggestion(club.name, await fetchTeamsForClubForAutoComplete(club.id));
  } else {
    elements.competitorClubModal.value = "";
    elements.competitorClubModal.removeAttribute(CLUB_ID_ATTR_NAME);
    updateTeamSuggestion("", []);
  }

  if (lastUsedStep !== null) {
    elements.competitorStepSelectModal.value = lastUsedStep.toString();
    elements.competitorDivisionSelectModal.value = lastUsedDivision.toString();
  }
  pageCommon.updateDivisionVisibility(
    elements.competitorStepSelectModal, "competitorDivisionLabelModal", "competitorDivisionColModal"
  );

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

export function editCompetitor(event: Event) {
  event.preventDefault();
  const competitorId = parseInt((event.currentTarget as HTMLAnchorElement).getAttribute(COMPETITOR_ID_ATTR_NAME));
  void openEditCompetitorModal(competitorId);
}

export async function openEditCompetitorModal(competitorId: number) {
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
  pageCommon.updateDivisionVisibility(
    elements.competitorStepSelectModal, "competitorDivisionLabelModal", "competitorDivisionColModal"
  );

  // Clear team value before setData so the autocomplete dropdown doesn't appear
  elements.competitorTeamModal.value = "";
  elements.competitorTeamModal.removeAttribute(TEAM_INDEX_ATTR_NAME);

  const club = await clubById(competitorDetails.clubId);
  if (club) {
    elements.competitorClubModal.value = club.name;
    elements.competitorClubModal.setAttribute(CLUB_ID_ATTR_NAME, club.id.toString());
    updateTeamSuggestion(club.name, await fetchTeamsForClubForAutoComplete(club.id));
  } else {
    elements.competitorClubModal.value = "";
    elements.competitorClubModal.removeAttribute(CLUB_ID_ATTR_NAME);
    updateTeamSuggestion("", []);
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

  await db.competitions.update(competition.id, competition as CompetitionData);
  logger.info("Competitor edit saved", {
    competitorId: editingCompetitorId,
    step: competitorDetails.step,
    division: competitorDetails.division,
    clubId,
    clubName: club.name,
  });
  competitorAutoComplete.setData(await fetchCompetitorsForAutocomplete());
  onCompetitorListChanged();
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

async function clubIdWhenAddingCompetitor(): Promise<number> {
  const clubField = elements.competitorClubModal;

  if (clubField.hasAttribute(CLUB_ID_ATTR_NAME)) {
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

async function teamIndexWhenAddingCompetitor(club: IClub): Promise<number | null> {
  const teamField = elements.competitorTeamModal;

  if (teamField.value.trim() === "") {
    return null;
  }

  if (teamField.hasAttribute(TEAM_INDEX_ATTR_NAME)) {
    return parseInt(teamField.getAttribute(TEAM_INDEX_ATTR_NAME));
  }

  const existingTeamIndex = competition.teams.findIndex((team) =>
    team.name.toLowerCase() === teamField.value.toLowerCase() && team.clubId === club.id
  );

  if (existingTeamIndex !== -1) {
    logger.debug("Team matched by name; reusing existing", {
      teamName: teamField.value, clubName: club.name, teamIndex: existingTeamIndex,
    });
    return existingTeamIndex;
  }

  logger.info("Creating new team", { teamName: teamField.value, clubName: club.name, clubId: club.id });
  const team = new Team(teamField.value, club.id);
  const teamIndex = competition.teams.push(team) - 1;
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

  // Capture and immediately clear before any awaits, to prevent the main field being visible
  // with stale state after hidden.bs.modal fires focus back to it during our async operations.
  const existingCompetitorIdAttr = elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME);
  elements.competitorName.value = "";
  elements.competitorName.removeAttribute(COMPETITOR_ID_ATTR_NAME);
  elements.addCompetitorButton.disabled = true;
  elements.competitorAlreadyAddedWarning.classList.add("d-none");

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

  if (existingCompetitorIdAttr !== null) {
    competitorId = existingCompetitorIdAttr;
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
    await db.competitors.put(competitor);
  }

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
  await db.competitions.update(competition.id, competition as CompetitionData);
  const { name, identifier } = competitor;
  logger.info("Competitor added to competition", {
    competitorId: competitor.id, name, identifier,
    clubName: club.name, competitionId: competition.id,
    totalCompetitors: competition.competitors.length,
  });
  onCompetitorListChanged();
  elements.competitorTeamModal.value = "";
}

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

async function clubById(id: number): Promise<IClub> {
  if (isNaN(id)) {
    return undefined;
  }
  return db.clubs.where(":id").equals(id).first();
}

async function fetchCompetitorsForAutocomplete() {
  const competitors = await db.competitors.toArray();
  return await Promise.all(competitors.map(async (c: ICompetitor) => {
    const club = await clubById(c.clubId);
    return {
      label: `${c.name} (${c.identifier}) - ${club?.name}`,
      value: c.id
    };
  }));
}

async function fetchClubsForAutocomplete() {
  const clubs = await db.clubs.toArray();
  return clubs.map((g: IClub) => ({ label: g.name, value: g.id }));
}

async function fetchTeamsForClubForAutoComplete(clubId: number) {
  if (competition == undefined) {
    return [];
  }

  return competition.teams.map((team: Team, index: number) => {
    return {
      label: team.name,
      value: index,
      clubId: team.clubId,
    };
  }).filter(team => {
    return team.clubId === clubId;
  }).sort((a, b) => a.label.localeCompare(b.label));
}
