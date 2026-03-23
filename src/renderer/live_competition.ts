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
import { ICompetition, CompetitionState, IGym, ICompetitor } from "../common/data";
import { CompetitionCompetitorDetails, CompetitorScore } from "../common/data/competition";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";

pageCommon.setup();

let competition: ICompetition = undefined;

const GROUP_ID_ATTR_NAME = "groupId";
const APPARATUS_ATTR_NAME = "apparatus";
const COMPETITOR_ID_ATTR_NAME = "competitorId";
const HAS_CHANGES_ATTR_NAME = "hasChanges";

class Elements extends pageCommon.BaseElements {
  competitionTitle: HTMLElement = null;
  competitionLocation: HTMLElement = null;
  compResultsTable: HTMLTableElement = null;
  compResultsTableHeaderRow: HTMLTableRowElement = null;
  groupApparatusResultsModal: HTMLElement = null;
  groupApparatusResultsModalForm: HTMLFormElement = null;
  groupApparatusResultsModalTitle: HTMLHeadingElement = null;
  groupApparatusResultsModalTable: HTMLTableElement = null;
  groupApparatusResultsModalDismiss: HTMLButtonElement = null;
  pauseCompetitionLink: HTMLLinkElement = null;
  finishCompetitionButton: HTMLButtonElement = null;
  saveScores: HTMLButtonElement = null;
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

  elements.pauseCompetitionLink.addEventListener("click", pauseCompetiton);
  elements.finishCompetitionButton.addEventListener("click", finishCompetition);
  elements.groupApparatusResultsModalDismiss.addEventListener("click", dismissResultsModal);
  elements.groupApparatusResultsModal.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      dismissResultsModal(event);
    }
  });
  populateCompetitionResultsTable();
  elements.saveScores.addEventListener("click", saveScores);
}

function dismissResultsModal(event: Event) {
  event.preventDefault();
  const modalElement = elements.groupApparatusResultsModal;
  const modal = Modal.getOrCreateInstance(modalElement);
  if(modalElement.getAttribute(HAS_CHANGES_ATTR_NAME) != "true") {
    modal.hide();
  } else {
    if(confirm("You have unsaved changes.  Do you really want to close without saving?")) {
      modal.hide();
    }
  }
}

async function pauseCompetiton() {
  competition.state = CompetitionState.Preparing;
  await db.competitions.put(competition);
}

function allResultsRecorded(): boolean {
  for (const apparatus of ["bar", "beam", "floor", "vault"]) {
    if (!competition[apparatus as keyof typeof competition]) {
      continue;
    }
    for (const group of getGroupsForCompetition()) {
      const { recorded, total } = getGroupRecordedCount(group, apparatus);
      if (recorded < total) {
        return false;
      }
    }
  }
  return true;
}

function finishCompetition(event: Event) {
  event.preventDefault();
  if (!allResultsRecorded()) {
    if (!confirm("Not all results have been recorded. Do you still want to finish the competition?")) {
      return;
    }
  }
  // TODO: mark competition as complete and navigate away
  console.log("Finish competition");
}

async function loadCompetition(compId: number) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      elements.competitionTitle.textContent = `${competition.name} - ${competition.date}`;
      elements.competitionLocation.textContent = competition.location;
    }
  }
}
function getGroupsForCompetition(): Array<number>{
  const groups: Array<number> = <Array<number>>Array.from(competition.competitors.reduce((
    set, competitorDetails) => set.add(competitorDetails.groupNumber),
  new Set()
  ));
  groups.sort((a, b) => { return (<number>a - <number>b); });
  return groups;
}

// Simple ascii upper-casing only; unicode is... something else.  Do not use for names or other similar user input.
function asciiCapitalizeFirstLetter(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}
function getGroupRecordedCount(groupId: number, apparatus: string): { recorded: number; total: number } {
  const groupCompetitors = competition.competitors.filter(c => c.groupNumber === groupId);
  const recorded = groupCompetitors.filter(c => c.scores[apparatus] !== undefined).length;
  return { recorded, total: groupCompetitors.length };
}

function statusDotColor(recorded: number, total: number): string {
  if (recorded === 0) {
    return "var(--bs-secondary)";
  }
  if (recorded === total) {
    return "var(--bs-success)";
  }
  return "var(--bs-warning)";
}

function updateCellStatus(link: HTMLAnchorElement) {
  const groupId = parseInt(link.getAttribute(GROUP_ID_ATTR_NAME));
  const apparatus = link.getAttribute(APPARATUS_ATTR_NAME);
  const { recorded, total } = getGroupRecordedCount(groupId, apparatus);

  const existing = link.querySelector(".cell-status");
  if (existing) {
    existing.remove();
  }

  const container = document.createElement("div");
  container.classList.add("cell-status", "d-flex", "align-items-center", "gap-1", "justify-content-center");
  container.style.marginTop = "2px";

  const dot = document.createElement("i");
  dot.classList.add("bi", "bi-circle-fill");
  dot.style.fontSize = "0.5em";
  dot.style.color = statusDotColor(recorded, total);

  const count = document.createElement("span");
  count.style.fontSize = "0.8em";
  count.style.opacity = "0.95";
  count.textContent = `${recorded}/${total}`;

  container.appendChild(dot);
  container.appendChild(count);
  link.appendChild(container);
}

function populateCompetitionResultsTable() {
  const table = elements.compResultsTable;
  const headerRow = elements.compResultsTableHeaderRow;
  const apparatuses = [];

  for(const apparatus of ["bar", "beam", "floor", "vault"]) {
    if (competition[apparatus as keyof typeof competition]) {
      const cell = headerRow.insertCell();
      cell.textContent = asciiCapitalizeFirstLetter(apparatus);
      cell.classList.add("col-2");
      apparatuses.push(apparatus);
    }
  }

  for(const group of getGroupsForCompetition()) {
    const row = table.insertRow();
    const groupCell = row.insertCell();
    groupCell.textContent = group.toString();
    for(const apparatus of apparatuses) {
      const aCell = row.insertCell();
      const modalLink = document.createElement("a");
      modalLink.href = "";
      modalLink.addEventListener("click", editGroupApparatusResults);
      modalLink.setAttribute(GROUP_ID_ATTR_NAME, group.toString());
      modalLink.setAttribute(APPARATUS_ATTR_NAME, apparatus);
      const icon = document.createElement("i");
      icon.classList.add("bi", "bi-pencil");
      modalLink.appendChild(icon);
      updateCellStatus(modalLink);
      aCell.appendChild(modalLink);
    }
  }
}

function editGroupApparatusResults(event: Event) {
  event.preventDefault();

  const modalElement = elements.groupApparatusResultsModal;
  const modal = Modal.getOrCreateInstance(modalElement);

  const link = <HTMLAnchorElement>event.currentTarget;

  const groupId = link.getAttribute(GROUP_ID_ATTR_NAME);
  const apparatus = link.getAttribute(APPARATUS_ATTR_NAME);

  modalElement.setAttribute(GROUP_ID_ATTR_NAME, groupId);
  modalElement.setAttribute(APPARATUS_ATTR_NAME, apparatus);

  elements.groupApparatusResultsModalTitle.textContent = ` Group ${groupId} - ${asciiCapitalizeFirstLetter(apparatus)}`;

  populateApparatusGroupResultsTable(parseInt(groupId), apparatus);
  modalElement.removeAttribute(HAS_CHANGES_ATTR_NAME);
  elements.groupApparatusResultsModalForm.classList.remove("was-validated");

  modalElement.addEventListener("shown.bs.modal", () => {
    const body = elements.groupApparatusResultsModalTable.tBodies[0];
    const firstEmptyRow = Array.from(body.rows).find(row => fieldForCol(row, D_SCORE_COLUMN).value === "");
    if (firstEmptyRow) {
      fieldForCol(firstEmptyRow, D_SCORE_COLUMN).focus();
    }
  }, { once: true });

  modal.show();
}

// Parse a score; zero if it doesn't parse.  Original number * 1000 as an integer if it does
// So we can do maths in whole numbers and divide at the end for presentation, avoiding floating point
// malarkey.
function parseScore(score: string, nanAllowed=false) {
  const res = parseFloat(score);
  if (isNaN(res)) {
    return nanAllowed ? res : 0;
  }
  return Math.round(res * 1000);
}

// Inputs are per-judge deductions.  There may be 2, 3, or 4 values (null or empty string if none).
// When there are 2 or 3 judges, average all available values
// When there are 4, drop the lowest + highest, average the other 2.

function averageJudgeEScores(rawScores: string[]) : number {
  const scores = rawScores
    .map(score => { return parseScore(score, true); })
    .filter(score => {return !isNaN(score);});
  const totalScores = scores.reduce((prev, curr) => prev + curr, 0);

  if(scores.length == 0 ) {
    return 0.0;
  } else if(scores.length == 4) {
    // 4 judge scores; drop the min + max.
    return (totalScores - Math.min(...scores) - Math.max(...scores)) / 2;
  } else {
    return totalScores / scores.length;
  }
}

// Per scoring definition: 3dp, but truncated (floored), not rounded.
function formatScore(score: number): string{
  return (Math.floor(score)/1000).toFixed(3);
}

function valueOfCell(row: HTMLTableRowElement, index: number) {
  return (<HTMLInputElement>row.cells[index].firstChild).value;
}

// D-score, E1-E4, Neutral Deductions
const D_SCORE_COLUMN = 1;
const FIRST_E_COLUMN = 2;
const LAST_E_COLUMN = 5;
const AVERAGE_E_COLUMN = 6;
const E_SCORE_COLUMN = 7;
const NEUTRAL_DEDUCTIONS_COLUMN = 9;
const FINAL_SCORE_COLUMN = 10;

const E_COLUMNS = (function() {
  const result: number[] = [];
  for(let i=FIRST_E_COLUMN; i <= LAST_E_COLUMN; i++) {
    result.push(i);
  }
  return result;
}());

const COLS_WITH_INPUT_FIELDS = E_COLUMNS.concat([D_SCORE_COLUMN, NEUTRAL_DEDUCTIONS_COLUMN]);

function rowCanCalculateScore(row: HTMLTableRowElement) {
  const dValue = valueOfCell(row, D_SCORE_COLUMN);
  const eScoreCount = E_COLUMNS.map(
    index => parseScore(valueOfCell(row, index), true)
  ).reduce(countNonNaN, 0);

  if (!dValue || dValue == "" || eScoreCount < 2) {
    return false;
    // Default 0 for neutral deductions is fine
  }
  return true;
}

// See https://www.gymnasticsnz.com/wp-content/uploads/2021/02/2021-WAG-Programme-Manual-2021-02-05.pdf
// Section 3.4  (page 13) for scoring definition
function updateScoreRow(row: HTMLTableRowElement) {
  if(!rowCanCalculateScore(row)) {
    return;
  }
  const dScore = parseScore(valueOfCell(row, D_SCORE_COLUMN));
  const judgeEScores = E_COLUMNS.map(index => valueOfCell(row, index));
  const avg = averageJudgeEScores(judgeEScores);
  row.cells[AVERAGE_E_COLUMN].textContent = formatScore(avg);

  const eScore = 10000 - avg;
  row.cells[E_SCORE_COLUMN].textContent = formatScore(eScore);

  const neutralDeductions = parseScore(valueOfCell(row, NEUTRAL_DEDUCTIONS_COLUMN));

  row.cells[FINAL_SCORE_COLUMN].textContent = formatScore(dScore + eScore - neutralDeductions);
}

function scoreInputFieldChanged(event: Event) {
  const inputField = <HTMLInputElement>event.currentTarget;
  const row: HTMLTableRowElement = <HTMLTableRowElement>inputField.parentElement.parentElement;
  elements.groupApparatusResultsModal.setAttribute(HAS_CHANGES_ATTR_NAME, "true");
  updateScoreRow(row);
}

function addInputFieldToCell(row: HTMLTableRowElement, cellIndex: number) {
  const inputField = document.createElement("input");
  // Creates a spinner that we don't care for, but also excludes non-numeric input
  // which is stronger than "inputtype=numeric", which just does validation.
  inputField.type = "number";
  inputField.min = "0.0";
  inputField.step = "0.1";
  inputField.classList.add("form-control");
  row.cells[cellIndex].appendChild(inputField);

  inputField.addEventListener("change", scoreInputFieldChanged);
}

function createCompetitorRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for(let i=0; i < 11; i++) {
    row.insertCell();
  }

  // ND's are always negative (to be subtracted); make it part of the UI
  row.cells[NEUTRAL_DEDUCTIONS_COLUMN-1].textContent = "-";

  for (const i of COLS_WITH_INPUT_FIELDS) {
    addInputFieldToCell(row, i);
  }

  return row;
}

function fieldForCol(row: HTMLTableRowElement, columnNumber: number) :HTMLInputElement {
  return <HTMLInputElement>row.cells[columnNumber].firstChild;
}

function populateScoreInField(row: HTMLTableRowElement, columnNumber: number, rawScore: number) {
  if(!isNaN(rawScore)) {
    fieldForCol(row, columnNumber).value = formatScore(rawScore);
  }
}

async function displayCompetitorInRow(
  row: HTMLTableRowElement,
  competitorDetails: CompetitionCompetitorDetails,
  apparatus: string
) {
  const competitor: ICompetitor = await db.competitors.where(":id").equals(competitorDetails.competitorId).first();
  const gym :IGym = await db.gyms.where(":id").equals(competitorDetails.gymId).first();
  row.cells[0].textContent = `${competitor.name} (${competitor.identifier} ${gym.name})`;

  row.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorDetails.competitorId.toString());

  if(competitorDetails.scores[apparatus]) {
    const scores = competitorDetails.scores[apparatus];

    populateScoreInField(row, D_SCORE_COLUMN, scores.difficulty);
    populateScoreInField(row, FIRST_E_COLUMN, scores.e1);
    populateScoreInField(row, FIRST_E_COLUMN + 1, scores.e2);
    populateScoreInField(row, FIRST_E_COLUMN + 2, scores.e3);
    populateScoreInField(row, FIRST_E_COLUMN + 3, scores.e4);
    populateScoreInField(row, NEUTRAL_DEDUCTIONS_COLUMN, scores.neutralDeductions);

    updateScoreRow(row);
  } else {
    for (const i of COLS_WITH_INPUT_FIELDS) {
      fieldForCol(row, i).value = "";
    }
    row.cells[AVERAGE_E_COLUMN].textContent = "";
    row.cells[E_SCORE_COLUMN].textContent = "";
    row.cells[FINAL_SCORE_COLUMN]. textContent = "";
  }
}

function populateApparatusGroupResultsTable(groupId: number, apparatus: string) {
  const groupCompetitors = competition.competitors.filter(competitor => {
    return competitor.groupNumber == groupId;
  });

  const body = elements.groupApparatusResultsModalTable.tBodies[0];

  // If the table is too long, trim it; if it's short, we'll create more later
  while (body.rows.length > groupCompetitors.length) {
    body.deleteRow(-1);
  }

  groupCompetitors.forEach((competitor, i) => {
    let row = body.rows[i];
    if(row == undefined) {
      row = createCompetitorRow(body);
    }
    displayCompetitorInRow(row, competitor, apparatus);
  });
}

function countNonNaN(prev: number, curr: number) {
  if (isNaN(curr)) {
    return prev;
  } else {
    return prev +1;
  }
}

async function saveScores(event: Event) {
  event.preventDefault();

  const modal = Modal.getOrCreateInstance(elements.groupApparatusResultsModal);
  const form = elements.groupApparatusResultsModalForm;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  for(const row of elements.groupApparatusResultsModalTable.rows) {
    const competitorId = parseInt(row.getAttribute(COMPETITOR_ID_ATTR_NAME));
    if(isNaN(competitorId)) {
      continue; // Probably the header row
    }
    const apparatus = elements.groupApparatusResultsModal.getAttribute(APPARATUS_ATTR_NAME);
    const competitor = competition.getCompetitorById(competitorId);

    if(!rowCanCalculateScore(row)) {
      continue;
    }

    competitor.scores[apparatus] = new CompetitorScore(
      parseScore(valueOfCell(row, D_SCORE_COLUMN)),
      parseScore(valueOfCell(row, FIRST_E_COLUMN), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 1), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 2), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 3), true),
      parseScore(valueOfCell(row, NEUTRAL_DEDUCTIONS_COLUMN)),
      parseScore(row.cells[FINAL_SCORE_COLUMN].textContent)
    );
  }
  await db.competitions.update(competition.id, competition);

  const savedGroupId = elements.groupApparatusResultsModal.getAttribute(GROUP_ID_ATTR_NAME);
  const savedApparatus = elements.groupApparatusResultsModal.getAttribute(APPARATUS_ATTR_NAME);
  const savedLink = <HTMLAnchorElement>document.querySelector(
    `a[${GROUP_ID_ATTR_NAME}="${savedGroupId}"][${APPARATUS_ATTR_NAME}="${savedApparatus}"]`
  );
  if (savedLink) {
    updateCellStatus(savedLink);
  }

  modal.hide();
}
