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
import { ICompetition, Competition, CompetitionState } from "./data";
import * as pageCommon from "./page_common";
pageCommon.setup();

let competition: ICompetition = undefined;

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

class Elements extends pageCommon.BaseElements {
  detailsSaveButton: HTMLElement = null;
  detailsEditButton: HTMLElement = null;
  detailsForm: HTMLElement = null;
  competitionName: HTMLElement = null;
  competitionDate: HTMLElement = null;
  competitionLocation: HTMLElement = null;
}

const elements = new Elements();
pageCommon.findElements(elements);

async function onLoaded() {
  const urlParams = new URLSearchParams(window.location.search);
  const compId = urlParams.get("compId");
  console.log(`Competition ID from query string: ${compId}`);

  await loadCompetition(parseInt(compId));

  elements.detailsSaveButton.addEventListener("click", saveCompetitionDetails);
  elements.detailsEditButton.addEventListener("click", startEditing);
  setDetailsEditing(competition == undefined);
}

async function loadCompetition(compId: number) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      (<HTMLInputElement>elements.competitionName).value = competition.name;
      (<HTMLInputElement>elements.competitionDate).value = competition.date;
      (<HTMLInputElement>elements.competitionLocation).value = competition.location;
    }
  }
}

async function saveCompetitionDetails() {
  if(competition) {
    competition.name =(<HTMLInputElement>elements.competitionName).value;
    competition.date = (<HTMLInputElement>elements.competitionDate).value;
    competition.location = (<HTMLInputElement>elements.competitionLocation).value;
    competition.state = CompetitionState.Preparing;
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
    CompetitionState.Preparing
  );
  await db.competitions.add(competition);
}

function setDetailsEditing(editing: boolean) {
  const enabledWhenEditing = [
    elements.detailsSaveButton, elements.competitionName, elements.competitionDate,
    elements.competitionLocation
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
}
