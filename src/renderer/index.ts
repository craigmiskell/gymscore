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

// import "bootstrap";
//Alternatively, more selective:
//import { Tooltip, Toast, Popover } from 'bootstrap';

console.log("Welcome to GymScore");

const COMPETITION_ID_ATTR = "competitionId";

//TODO: move this to a data place; maybe gymscoredb.ts?
// Looks like we get full persistent access to all available storage but this is worth reporting
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(function(persistent) {
    if (persistent) {
      console.log("Storage will not be cleared except by explicit user action");
    } else {
      // TODO: alert the user to tell me that this unexpected event has happened.
      console.log("Storage may be cleared by the UA under storage pressure.");
    }
  });
}
navigator.storage.estimate().then(estimation =>{
  console.log(`Quota: ${estimation.quota/1024/1024}MB`);
  console.log(`Usage: ${estimation.usage/1024/1024}MB`);
});

import { db } from "./data/gymscoredb";
import { ICompetition, CompetitionState } from "../common/data";
import * as pageCommon from "./page_common";
import { generateCompetitionPDFs } from "./competition_pdfs";
import { Modal } from "bootstrap";

type CompetitionRowDisplayFunc = (row: HTMLTableRowElement, competition: ICompetition) => void;
type CompetitionCallback = (competition: ICompetition) => void;

pageCommon.setup();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  const modal = document.getElementById("deleteConfirmationModal");

  modal.addEventListener("hide.bs.modal", () => {
    modal.removeAttribute(COMPETITION_ID_ATTR);
  });

  document.getElementById("deleteConfirmationModalYes").addEventListener(
    "click",
    function() {
      doDeleteCompetition(parseInt(modal.getAttribute(COMPETITION_ID_ATTR)));
      // Hide must happen *after* deleting, because a hook on hiding unsets the ID
      // we use to do the deletion.
      // If this causes trouble (e.g. we can't catch errors when failing to delete), we may
      // need to just remove the hide hook
      Modal.getOrCreateInstance(modal).hide();
    }
  );

  document.getElementById("delete-database-button").addEventListener(
    "click", clearDB
  );

  displayCompetitionTable("preparingCompetitions", CompetitionState.Preparing, displayPreparingCompetition);
  displayCompetitionTable("liveCompetitions", CompetitionState.Live, displayLiveCompetition);
  displayCompetitionTable("pastCompetitions", CompetitionState.Completed, displayCompletedCompetition);
}

function promptDeleteCompetition(competition: ICompetition) {
  const modal = document.getElementById("deleteConfirmationModal");
  modal.setAttribute(COMPETITION_ID_ATTR, competition.id.toString());
  Modal.getOrCreateInstance(modal).show();
}

function doDeleteCompetition(competitionId: number) {
  console.log(`Deleting: ${competitionId}`);
  db.competitions.delete(competitionId);
  const table = <HTMLTableElement>document.getElementById("preparingCompetitions");

  const row = table.querySelector(`tr[${COMPETITION_ID_ATTR}="${competitionId}"]`);
  if (row == null) {
    console.log(`Did not find row with competition ID ${competitionId}`);
    return;
  }
  row.remove();
}

async function startCompetition(competition: ICompetition) {
  const ungrouped = competition.competitors.filter((c) => c.groupNumber === 0);
  if (ungrouped.length > 0) {
    Modal.getOrCreateInstance(document.getElementById("ungroupedCompetitorsModal")).show();
    return;
  }
  competition.state = CompetitionState.Live;
  await db.competitions.put(competition);
  window.location.href = `live_competition.html?compId=${competition.id}`;
}

async function displayCompetitionTable(
  tableName: string,
  state: CompetitionState,
  displayFunc: CompetitionRowDisplayFunc) {

  const table = <HTMLTableElement>document.getElementById(tableName);
  db.transaction("r", db.competitions, async() => {
    db.competitions.where("state").equals(state).toArray().then((a) => {
      for (const competition of a) {
        const row = table.insertRow();
        row.setAttribute(COMPETITION_ID_ATTR, competition.id.toString());
        row.insertCell().textContent = `${competition.name} (${competition.location})`;
        displayFunc(row, competition);
      }
    });
  });
}

function displayPreparingCompetition(row: HTMLTableRowElement, competition: ICompetition) {
  displayCompetitionLink(row, getPageLink(competition, "prepare_competition", "Prepare", "pencil"));
  displayCompetitionLink(row, getJSLink(competition, startCompetition, "Start", "play"));
  displayCompetitionLink(row, getJSLink(competition, promptDeleteCompetition, "Delete", "trash"));
}

function displayLiveCompetition(row: HTMLTableRowElement, competition: ICompetition) {
  displayCompetitionLink(row, getPageLink(competition, "live_competition", "Continue", "play"));
}

function displayCompletedCompetition(row: HTMLTableRowElement, competition: ICompetition) {
  displayCompetitionLink(
    row,
    getJSLink(competition, generateCompetitionPDFs, "Generate result PDFs", "file-earmark-pdf")
  );
  displayCompetitionLink(row, getJSLink(competition, promptDeleteCompetition, "Delete", "trash"));
}

function displayCompetitionLink(row: HTMLTableRowElement, link: HTMLAnchorElement) {
  const cell = row.insertCell();
  cell.appendChild(link);
}

function getPageLink(competition: ICompetition, pageName: string, text: string, iconName: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `${pageName}.html?compId=${competition.id}`;
  fillInLink(link, text, iconName);
  return link;
}

function getJSLink(
  competition: ICompetition,
  callback: CompetitionCallback,
  text: string,
  iconName: string): HTMLAnchorElement {

  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", (event: Event) => {
    event.preventDefault();
    callback(competition);
  });
  fillInLink(link, text, iconName);
  return link;
}

function fillInLink(link: HTMLAnchorElement, text: string, iconName: string) {
  const icon = document.createElement("i");
  icon.classList.add("bi", `bi-${iconName}`);
  link.appendChild(icon);
  link.appendChild(new Text(` ${text}`));
}

async function clearDB() {
  await db.delete();
  await db.open();
}

// Leave this as an example for how to draw to a canvas and then save to disk
// via the main context.  We'll move it elsewhere and add actual useful drawing later.
// document.getElementById("printButton").addEventListener("click", async () => {
//   const offscreen = new OffscreenCanvas(256, 256);
//   const ctx = offscreen.getContext("2d");
//   ctx.fillStyle = "rgb(200, 0, 0)";
//   ctx.fillRect(10, 10, 50, 50);

//   const blob = await offscreen.convertToBlob();
//   const arrayBuffer = await blob.arrayBuffer();
//   api.sendAsync("save-png", {data: arrayBuffer, filenameHint: "foobar"});
// });
