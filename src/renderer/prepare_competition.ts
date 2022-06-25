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

console.log("Preparing competition");

import { db } from "./data/gymscoredb";
import { ICompetition, Competition, CompetitionState,
  ICompetitor, Competitor, Step, UnderOver,
  Gym, IGym} from "./data";
import * as pageCommon from "./page_common";
import { Autocomplete } from "./autocomplete";

const COMPETITOR_ID_ATTR_NAME = "competitorId";

pageCommon.setup();

let competition: ICompetition = undefined;

class Elements extends pageCommon.BaseElements {
  detailsSaveButton: HTMLElement = null;
  detailsEditButton: HTMLElement = null;
  detailsForm: HTMLElement = null;
  competitionName: HTMLElement = null;
  competitionDate: HTMLElement = null;
  competitionLocation: HTMLElement = null;
  enableVault: HTMLElement = null;
  enableBars: HTMLElement = null;
  enableBeam: HTMLElement = null;
  enableFloor: HTMLElement = null;
  competitorName: HTMLElement = null;
  competitors: HTMLTableElement = null;
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
  document.getElementById("addCompetitorButton").addEventListener("click", addCompetitor);
  document.getElementById("create-fake-competitors-button").addEventListener("click", populateFakeCompetitors);

  await setupCompetitorAutoComplete();
  updateCompetitorsTable();

  setDetailsEditing(competition == undefined);
}

async function removeCompetitor(event: Event) {
  // Do this *first* so we get a chance to catch errors and not immediately reload the page
  event.preventDefault();

  const competitorId = parseInt((<HTMLAnchorElement>event.currentTarget).getAttribute(COMPETITOR_ID_ATTR_NAME));
  delete competition.competitorIds[competitorId];
  await db.competitions.update(competition.id, competition);
  updateCompetitorsTable();
}

async function displayCompetitorInRow(row: HTMLTableRowElement, competitor: ICompetitor) {
  const gym :IGym = await db.gyms.where("id").equals(competitor.gymId).first();
  row.cells[0].textContent = competitor.name;
  row.cells[1].textContent = competitor.step.humanString();
  row.cells[2].textContent = gym.name;
  row.cells[3].textContent = "Unassigned";
  row.cells[4].children[0].setAttribute(COMPETITOR_ID_ATTR_NAME, competitor.id.toString());
}

function createCompetitorRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for(let i=0; i < 5; i++) {
    row.insertCell();
  }
  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", removeCompetitor);

  const icon = document.createElement("i");
  icon.classList.add("bi", "bi-trash");
  link.appendChild(icon);
  row.cells[4].appendChild(link);
  return row;
}

async function updateCompetitorsTable() {
  const body = elements.competitors.tBodies[0];

  if(competition == undefined) {
    return;
  }

  const competitors = await db.competitors
    .where("id")
    .anyOf(Object.keys(competition.competitorIds).map(i => parseInt(i)))
    .sortBy("name");

  // If the table is too long, trim it; if it's short, we'll create more later
  while (body.rows.length > competitors.length) {
    body.deleteRow(-1);
  }

  competitors.forEach((competitor, i) => {
    let row = body.rows[i];
    if(row == undefined) {
      row = createCompetitorRow(body);
    }
    displayCompetitorInRow(row, competitor);
  });
}

async function setupCompetitorAutoComplete() {
  const competitors = await fetchCompetitorsForAutocomplete();

  const competitorNameField = elements.competitorName;
  new Autocomplete(
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
      }
    }
  );
}

async function addCompetitor() {
  const competitorId = parseInt(elements.competitorName.getAttribute(COMPETITOR_ID_ATTR_NAME));
  if(isNaN(competitorId)) {
    console.log("No competitor found in autocomplete box: not adding");
    return;
  }
  competition.competitorIds[competitorId] = true;
  await db.competitions.update(competition.id, competition);
  updateCompetitorsTable();
  (<HTMLInputElement>elements.competitorName).value = "";
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
      new Step(BigInt(Math.floor(Math.random() * 9)+1), Math.random() < 0.5 ? UnderOver.Under : UnderOver.Over),
      gym.id
    ));
  }
}

async function fetchCompetitorsForAutocomplete() {
  const competitors = await db.competitors.toArray();
  return await Promise.all(competitors.map(async (c: ICompetitor) => {
    const gym = await db.gyms.where(":id").equals(c.gymId).first();
    return {
      label: `${c.name} - ${gym.name}`,
      value: c.id
    };
  }));
}

async function loadCompetition(compId: number) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      (<HTMLInputElement>elements.competitionName).value = competition.name;
      (<HTMLInputElement>elements.competitionDate).value = competition.date;
      (<HTMLInputElement>elements.competitionLocation).value = competition.location;
      (<HTMLInputElement>elements.enableBars).checked = competition.bars;
      (<HTMLInputElement>elements.enableBeam).checked = competition.beam;
      (<HTMLInputElement>elements.enableFloor).checked = competition.floor;
      (<HTMLInputElement>elements.enableVault).checked = competition.vault;
    }
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
  competition.bars = (<HTMLInputElement>elements.enableBars).checked;
  competition.beam = (<HTMLInputElement>elements.enableBeam).checked;
  competition.floor = (<HTMLInputElement>elements.enableFloor).checked;
}

function setDetailsEditing(editing: boolean) {
  const enabledWhenEditing = [
    elements.detailsSaveButton, elements.competitionName, elements.competitionDate,
    elements.competitionLocation, elements.enableBars, elements.enableBeam, elements.enableFloor,
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
