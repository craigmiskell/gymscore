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
  ICompetitor, Competitor, Division,
  Gym, IGym} from "./data";
import * as pageCommon from "./page_common";
import { Autocomplete } from "./autocomplete";
import { Modal } from "bootstrap";
import { CompetitionCompetitorDetails, Team } from "./data/competition";

const COMPETITOR_ID_ATTR_NAME = "competitorId";
const GYM_ID_ATTR_NAME = "gymId";
const TEAM_INDEX_ATTR_NAME = "teamId";

pageCommon.setup();

let competition: ICompetition = undefined;
let gymAutoComplete :Autocomplete = undefined;
let competitorAutoComplete :Autocomplete = undefined;
let teamAutoComplete :Autocomplete = undefined;

class Elements extends pageCommon.BaseElements {
  // TODO: make these types more specific.
  detailsSaveButton: HTMLElement = null;
  detailsEditButton: HTMLElement = null;
  detailsForm: HTMLElement = null;
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
  competitorGymModal: HTMLInputElement = null;
  competitorTeamModal: HTMLInputElement = null;
  addCompetitorButton: HTMLButtonElement = null;
  competitorDetailsForm: HTMLFormElement = null;
  groupSelectTemplate: HTMLSelectElement = null;
  createRecorderSheetsButton: HTMLButtonElement = null;
  createProgrammeButton: HTMLButtonElement = null;
}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  pageCommon.findElements(elements);

  const urlParams = new URLSearchParams(window.location.search);
  const compId = urlParams.get("compId");
  console.log(`Competition ID from query string: ${compId}`);

  await loadCompetition(parseInt(compId));

  elements.detailsSaveButton.addEventListener("click", saveCompetitionDetails);
  elements.detailsEditButton.addEventListener("click", startEditing);
  document.getElementById("addCompetitorButton").addEventListener("click", openAddCompetitorModal);
  document.getElementById("create-fake-competitors-button").addEventListener("click", populateFakeCompetitors);
  document.getElementById("addCompetitorModalYes").addEventListener("click", addCompetitor);
  elements.createRecorderSheetsButton.addEventListener("click", createRecorderSheets);
  elements.createProgrammeButton.addEventListener("click", createProgramme);

  await setupCompetitorAutoComplete();
  await setupGymAutoComplete();
  await setupTeamAutoComplete();
  updateCompetitorsTable();
  populateStepSelectModal();

  setDetailsEditing(competition == undefined);
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
  competition.removeCompetitorById(competitorId);
  await db.competitions.update(competition.id, competition);
  updateCompetitorsTable();
}

async function displayCompetitorInRow(row: HTMLTableRowElement, competitor: CompetitionCompetitorDetails) {
  const gym :IGym = await db.gyms.where(":id").equals(competitor.gymId).first();
  const competitorIdString =  competitor.competitorId.toString();
  row.cells[0].textContent = competitor.competitorName;
  row.cells[1].textContent = competitor.step + Division[competitor.division];
  row.cells[2].textContent = gym?.name;
  row.cells[3].textContent = competition.teams[competitor.teamIndex].name;

  const groupSelect = <HTMLSelectElement>row.cells[4].firstChild;
  groupSelect.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
  groupSelect.value = (competitor.groupNumber || 0).toString();

  row.cells[5].children[0].setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);
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

function createCompetitorRow(body: HTMLTableSectionElement, index: number): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for(let i=0; i < 6; i++) {
    row.insertCell();
  }
  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", removeCompetitor);

  row.cells[4].append(createNewGroupSelect(index));

  const icon = document.createElement("i");
  icon.classList.add("bi", "bi-trash");
  link.appendChild(icon);
  row.cells[5].appendChild(link);
  return row;
}

async function updateCompetitorsTable() {
  const body = elements.competitors.tBodies[0];

  if(competition == undefined) {
    return;
  }

  const competitors = competition.competitors;

  // If the table is too long, trim it; if it's short, we'll create more later
  while (body.rows.length > competitors.length) {
    body.deleteRow(-1);
  }

  competitors.forEach((competitor, i) => {
    let row = body.rows[i];
    if(row == undefined) {
      row = createCompetitorRow(body, i);
    }
    displayCompetitorInRow(row, competitor);
  });
}

function setupAutocomplete(
  data: AutoCompleteData,
  field: HTMLInputElement,
  attribute: string,
  callbackOnInput?: AutoCompleteCallbackOnInputFunc,
) {

  return new Autocomplete(
    field,
    {
      data: data,
      threshold: 1,
      maximumItems: 8,
      onSelectItem: (selected: {label: string, value: string}) => {
        console.log("Found by autocomplete:", selected.label, selected.value);
        field.setAttribute(attribute, selected.value);
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
        console.log("Competitor found by autocomplete:", selected.label, selected.value);
        competitorNameField.setAttribute(COMPETITOR_ID_ATTR_NAME, selected.value);
      },
      onInput:() => {
        // If the user types, clear the selection
        competitorNameField.removeAttribute(COMPETITOR_ID_ATTR_NAME);
        elements.addCompetitorButton.disabled = (competitorNameField.value == "");
      }
    }
  );
}

//TODO: convert to 'setupAutocomplete'
async function setupGymAutoComplete() {
  const gyms = await fetchGymsForAutocomplete();

  const gymField = elements.competitorGymModal;
  gymAutoComplete = new Autocomplete(
    gymField,
    {
      data: gyms,
      threshold: 1,
      maximumItems: 8,
      onSelectItem: async (selected: {label: string, value: string}) => {
        const gymId = selected.value;
        console.log("Gym found by autocomplete:", selected.label, gymId);
        gymField.setAttribute(GYM_ID_ATTR_NAME, gymId);
        teamAutoComplete.setData(await fetchTeamsForGymForAutoComplete(parseInt(gymId)));
      },
      onInput:() => {
        // If the user types, clear the selection
        gymField.removeAttribute(GYM_ID_ATTR_NAME);
        teamAutoComplete.setData([]);
      }
    }
  );
}

async function setupTeamAutoComplete() {
  teamAutoComplete = setupAutocomplete(
    [], // Can't do anything until we have a gym, in the competitor modal
    elements.competitorTeamModal,
    TEAM_INDEX_ATTR_NAME
  );
}

async function openAddCompetitorModal() {
  const competitorIdString = elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME);
  const competitorId = parseInt(competitorIdString);
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);

  elements.addCompetitorModal.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorIdString);

  let competitor: ICompetitor;
  if(isNaN(competitorId)) {
    // Just a placeholder; we'll create a new one on save.  No ID, no gym
    competitor = new Competitor("", elements.competitorName.value, 1, Division.Under, -1);
    elements.competitorNameModal.disabled = false;
  } else {
    competitor = await db.competitors.where(":id").equals(competitorId).first();
    elements.competitorNameModal.disabled = true; //Cannot edit this here and now; autocomplete found it
    elements.competitorGymModal.setAttribute(GYM_ID_ATTR_NAME, competitor.gymId.toString());
  }

  // Populate modal fields
  elements.competitorNameModal.value = competitor.name;
  elements.competitorIdModal.value = competitor.identifier;
  elements.competitorStepSelectModal.selectedIndex = competitor.step - 1;
  const gym = await gymForCompetitor(competitor);
  if(gym) {
    elements.competitorGymModal.value = gym.name;
    teamAutoComplete.setData(await fetchTeamsForGymForAutoComplete(gym.id));
  } else {
    elements.competitorGymModal.value = "";
    teamAutoComplete.setData([]);
  }

  elements.competitorDetailsForm.classList.remove("was-validated");
  modal.show();
}

async function gymIdWhenAddingCompetitor() : Promise<number> {
  const gymField = elements.competitorGymModal;

  if(gymField.hasAttribute(GYM_ID_ATTR_NAME)) {
    return parseInt(gymField.getAttribute(GYM_ID_ATTR_NAME));
  }
  const existingGym = await db.gyms.where("name").equalsIgnoreCase(gymField.value).first();
  if (existingGym != undefined) {
    console.log(`Gym named "${gymField.value}" already exists; not creating a new ones`);
    gymField.setAttribute(GYM_ID_ATTR_NAME, existingGym.id.toString());
    return existingGym.id;
  }
  console.log("Creating a new gym with name " + gymField.value);
  const gymId = await db.gyms.put(new Gym(gymField.value));
  gymField.setAttribute(GYM_ID_ATTR_NAME, gymId.toString());
  gymAutoComplete.setData(await fetchGymsForAutocomplete());
  return gymId;
}

async function teamIndexWhenAddingCompetitor(gym: IGym) : Promise<number> {
  const teamField = elements.competitorTeamModal;

  if(teamField.hasAttribute(TEAM_INDEX_ATTR_NAME)) {
    return parseInt(teamField.getAttribute(TEAM_INDEX_ATTR_NAME));
  }

  const existingTeamIndex = competition.teams.findIndex((team) => {
    (team.name.toLowerCase() == teamField.value.toLowerCase()) && (team.gymId == gym.id);
  });

  if(existingTeamIndex != -1) {
    console.log(`Team named "${teamField.value}" already exists for gym ${gym.name}; not creating a new ones`);
    return existingTeamIndex;
  }

  console.log("Creating a new team with name " + teamField.value);
  const team = new Team(teamField.value, gym.id);
  const teamIndex = competition.teams.push(team) - 1; //
  teamField.setAttribute(TEAM_INDEX_ATTR_NAME, teamIndex.toString());

  return teamIndex;
}

async function addCompetitor() {
  console.log("Adding competitor");

  const form = elements.competitorDetailsForm;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  let competitorId;
  const modal = Modal.getOrCreateInstance(elements.addCompetitorModal);
  // Hide early, so any failures the modal will be gone and the user can continue.
  modal.hide();

  const gymId = await gymIdWhenAddingCompetitor();
  const gym = await gymById(gymId);
  const teamId = await teamIndexWhenAddingCompetitor(gym);
  let competitor;

  if(elements.competitorName.hasAttribute(COMPETITOR_ID_ATTR_NAME)) {
    competitorId = elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME);
    // Update competitor with current step + gym (for future)
    competitor = await db.competitors.where(":id").equals(parseInt(competitorId)).first();
    competitor.step = parseInt(elements.competitorStepSelectModal.value);
    competitor.division = parseInt(elements.competitorDivisionSelectModal.value);
    competitor.gymId = gymId;
    await db.competitors.put(competitor);
  } else {
    // No auto-completed competitor; create a new one
    competitor = new Competitor(
      elements.competitorIdModal.value,
      elements.competitorNameModal.value,
      parseInt(elements.competitorStepSelectModal.value),
      parseInt(elements.competitorDivisionSelectModal.value),
      gymId);
    competitorId = await db.competitors.put(competitor);
  }
  // Always update; for new competitor, or if the gym has changed on an existing competitor
  competitorAutoComplete.setData(await fetchCompetitorsForAutocomplete());

  competition.competitors.push(new CompetitionCompetitorDetails(
    competitor,
    parseInt(elements.competitorStepSelectModal.value),
    parseInt(elements.competitorDivisionSelectModal.value),
    gymId,
    gym.name, // A convenience, because we need it in the main process and won't be able to look things up in the DB.
    teamId,
    0, // Default is "no group", index 0
  ));
  await db.competitions.update(competition.id, competition);
  updateCompetitorsTable();
  elements.competitorName.value = "";
  elements.competitorTeamModal.value = "";
  elements.addCompetitorButton.disabled = true;
}

async function groupSelectChanged(event: Event) {
  const select = <HTMLSelectElement>event.target;
  const competitorId = parseInt(select.getAttribute(COMPETITOR_ID_ATTR_NAME));

  const competitor: CompetitionCompetitorDetails = competition.getCompetitorById(competitorId);
  competitor.groupNumber = parseInt(select.value);
  await db.competitions.update(competition.id, competition);
}

async function gymById(id: number) : Promise<IGym> {
  // TODO: cache (local, or in a DAO layer)
  if(isNaN(id)) {
    return undefined; // Mostly belt'n'braces for old bugs.
  }
  const gyms = db.gyms.where(":id").equals(id);
  if (await gyms.count() == 0) {
    return undefined;
  }
  return gyms.first();
}

async function gymForCompetitor(competitor: ICompetitor) : Promise<IGym> {
  return await gymById(competitor.gymId);
}

async function fetchCompetitorsForAutocomplete() {
  const competitors = await db.competitors.toArray();
  return await Promise.all(competitors.map(async (c: ICompetitor) => {
    const gym = await gymForCompetitor(c);
    return {
      label: `${c.name} - ${gym?.name}`,
      value: c.id
    };
  }));
}

async function fetchGymsForAutocomplete() {
  const gyms = await db.gyms.toArray();
  return await Promise.all(gyms.map(async (g: IGym) => {
    return {
      label: g.name,
      value: g.id
    };
  }));
}

async function fetchTeamsForGymForAutoComplete(gymId: number) {
  if(competition == undefined ) {
    return [];
  }

  return competition.teams.map((team: Team, index: number) => {
    return {
      label: team.name,
      value: index,
      gymId: team.gymId,
    };
  }).filter(team => {
    return team.gymId == gymId;
  });
}

async function loadCompetition(compId: number) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      (<HTMLInputElement>elements.competitionName).value = competition.name;
      (<HTMLInputElement>elements.competitionDate).value = competition.date;
      (<HTMLInputElement>elements.competitionLocation).value = competition.location;
      (<HTMLInputElement>elements.enableBar).checked = competition.bar;
      (<HTMLInputElement>elements.enableBeam).checked = competition.beam;
      (<HTMLInputElement>elements.enableFloor).checked = competition.floor;
      (<HTMLInputElement>elements.enableVault).checked = competition.vault;
    }
  } else {
    (<HTMLInputElement>elements.enableBar).checked =
    (<HTMLInputElement>elements.enableBeam).checked =
    (<HTMLInputElement>elements.enableFloor).checked =
    (<HTMLInputElement>elements.enableVault).checked = true;
  }
}

async function saveCompetitionDetails() {
  const form = <HTMLFormElement>elements.detailsForm;

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  if(competition) {
    competition.name =(<HTMLInputElement>elements.competitionName).value;
    competition.date = (<HTMLInputElement>elements.competitionDate).value;
    competition.location = (<HTMLInputElement>elements.competitionLocation).value;
    competition.state = CompetitionState.Preparing;
    populateCompetitionDisciplines(competition);
    db.competitions.put(competition);
  } else {
    await createCompetition();
  }
  setDetailsEditing(false);
  return false;
}

function startEditing() {
  setDetailsEditing(true);
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
}

function populateCompetitionDisciplines(competition: ICompetition) {
  competition.vault = (<HTMLInputElement>elements.enableVault).checked;
  competition.bar = (<HTMLInputElement>elements.enableBar).checked;
  competition.beam = (<HTMLInputElement>elements.enableBeam).checked;
  competition.floor = (<HTMLInputElement>elements.enableFloor).checked;
}

function setDetailsEditing(editing: boolean) {
  const enabledWhenEditing = [
    elements.detailsSaveButton, elements.competitionName, elements.competitionDate,
    elements.competitionLocation, elements.enableBar, elements.enableBeam, elements.enableFloor,
    elements.enableVault
  ];
  const enabledWhenNotEditing = [elements.detailsEditButton];

  const enabled = editing ? enabledWhenEditing : enabledWhenNotEditing;
  const disabled = editing ? enabledWhenNotEditing : enabledWhenEditing;

  for (const i of enabled) {
    i.classList.remove("disabled");
    (<HTMLInputElement>i).disabled = false;
  }
  for (const i of disabled) {
    i.classList.add("disabled");
    (<HTMLInputElement>i).disabled = true;
  }

  if(editing) {
    elements.detailsForm.classList.remove("was-validated");
  }
}

type AutoCompleteData = {
  label: string,
  value: number,
}[];

type AutoCompleteCallbackOnInputFunc = {
  (): void;
}

function createRecorderSheets() {
  api.sendAsync("generate-pdfs", {type: "recorder-sheets", competition: competition});
}

function createProgramme() {
  api.sendAsync("generate-pdfs", {type: "programme", competition: competition});
}

async function populateFakeCompetitors() {
  db.competitors.toCollection().delete();

  const firstNames = ["Amelia", "Barbara", "Collette", "Daphne", "Erin", "Francis", "Geri", "Harriet", "Isabelle",
    "Jeanette", "Karen", "Lisa", "Margaret", "Nancy", "Ophelia", "Paris", "Rosie", "Susan", "Teri", "Ursula", "Vivian",
    "Wendy", "Xavier", "Yvette", "Zorro"];
  const lastNames = ["White", "Green", "Black", "Brown", "Purple", "Red", "Yellow", "Pink", "Mauve", "Taupe", "Orange",
    "Indigo", "Violet", "Turquoise"];
  const gym = new Gym("St Bernadettes", 1);
  db.gyms.put(gym);
  for (let i=0; i < 20; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    db.competitors.put(new Competitor(
      `a${i}`,
      `${firstName} ${lastName}`,
      Math.floor(Math.random() * 9)+1,
      Math.random() < 0.5 ? Division.Under : Division.Over,
      gym.id
    ));
  }
}

// TODO: some sort of alert if not all competitors are in groups
