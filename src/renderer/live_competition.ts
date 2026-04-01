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
import { ICompetition, ICompetitor } from "../common/data";
import { CompetitionCompetitorDetails, CompetitionData, CompetitorScore } from "../common/data/competition";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";
import { logger } from "./logger";
import { formatScore, capitalise } from "../common/formatting";
import { parseScore, averageJudgeEScores } from "../common/scoring";

pageCommon.setup();

let competition: ICompetition = undefined;

const GROUP_ID_ATTR_NAME = "groupId";
const APPARATUS_ATTR_NAME = "apparatus";
const STEP_ATTR_NAME = "step";
const COMPETITOR_ID_ATTR_NAME = "competitorId";
const HAS_CHANGES_ATTR_NAME = "hasChanges";
const SCORES_DELETED_ATTR_NAME = "scoresDeleted";

class Elements extends pageCommon.BaseElements {
  competitionTitle: HTMLElement = null;
  competitionLocation: HTMLElement = null;
  stepsContainer: HTMLElement = null;
  groupApparatusResultsModal: HTMLElement = null;
  groupApparatusResultsModalForm: HTMLFormElement = null;
  groupApparatusResultsModalTitle: HTMLHeadingElement = null;
  groupApparatusResultsModalTable: HTMLTableElement = null;
  groupApparatusResultsModalDismiss: HTMLButtonElement = null;
  saveScores: HTMLButtonElement = null;
}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  pageCommon.findElements(elements);

  const compId = pageCommon.getCompetitionIdFromUrl();
  logger.debug("live_competition loaded", { compId });

  await loadCompetition(compId);

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
  if(modalElement.getAttribute(HAS_CHANGES_ATTR_NAME) !== "true") {
    modal.hide();
  } else {
    if(confirm("You have unsaved changes.  Do you really want to close without saving?")) {
      modal.hide();
    }
  }
}


async function loadCompetition(compId: number | undefined) {
  if(compId) {
    competition = await db.competitions.where(":id").equals(compId).first();
    if(competition) {
      logger.info("Competition loaded for live scoring", {
        compId,
        ...pageCommon.competitionFields(competition),
        competitorCount: competition.competitors.length,
      });
      elements.competitionTitle.textContent = `${competition.name} - ${competition.date}`;
      elements.competitionLocation.textContent = competition.location;
    } else {
      logger.warn("Competition not found in DB for live scoring", { compId });
    }
  } else {
    logger.warn("No competition ID in URL for live scoring page");
  }
}
function getStepsForCompetition(): number[] {
  const steps = Array.from(
    competition.competitors.reduce((set, c) => set.add(c.step), new Set<number>())
  );
  steps.sort((a, b) => a - b);
  return steps;
}

function getGroupsForStep(step: number): number[] {
  const groups = Array.from(
    competition.competitors
      .filter(c => c.step === step)
      .reduce((set, c) => set.add(c.groupNumber), new Set<number>())
  ).filter(g => g !== 0);
  groups.sort((a, b) => a - b);
  return groups;
}

function getGroupRecordedCount(groupId: number, apparatus: string, step: number): { recorded: number; total: number } {
  const groupCompetitors = competition.competitors.filter(
    c => c.groupNumber === groupId && c.step === step
  );
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
  const step = parseInt(link.getAttribute(STEP_ATTR_NAME));
  const { recorded, total } = getGroupRecordedCount(groupId, apparatus, step);

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
  const apparatuses: string[] = [];
  for (const apparatus of ["bar", "beam", "floor", "vault"]) {
    if (competition[apparatus as keyof typeof competition]) {
      apparatuses.push(apparatus);
    }
  }

  for (const step of getStepsForCompetition()) {
    const card = document.createElement("div");
    card.classList.add("card");

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("card-header", "fw-bold");
    cardHeader.textContent = `Step ${step}`;
    card.appendChild(cardHeader);

    const cardBody = document.createElement("div");
    cardBody.classList.add("card-body", "p-1");

    const table = document.createElement("table");
    table.classList.add("table", "table-sm", "table-striped", "table-bordered", "w-auto", "mb-0");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const groupTh = document.createElement("th");
    groupTh.textContent = "Group";
    headerRow.appendChild(groupTh);
    for (const apparatus of apparatuses) {
      const th = document.createElement("th");
      th.textContent = capitalise(apparatus);
      th.classList.add("col-2");
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const group of getGroupsForStep(step)) {
      const row = tbody.insertRow();
      const groupCell = row.insertCell();
      groupCell.textContent = group.toString();
      for (const apparatus of apparatuses) {
        const aCell = row.insertCell();
        const modalLink = document.createElement("a");
        modalLink.href = "";
        modalLink.addEventListener("click", editGroupApparatusResults);
        modalLink.setAttribute(GROUP_ID_ATTR_NAME, group.toString());
        modalLink.setAttribute(APPARATUS_ATTR_NAME, apparatus);
        modalLink.setAttribute(STEP_ATTR_NAME, step.toString());
        const icon = document.createElement("i");
        icon.classList.add("bi", "bi-pencil");
        modalLink.appendChild(icon);
        updateCellStatus(modalLink);
        aCell.appendChild(modalLink);
      }
    }
    table.appendChild(tbody);

    cardBody.appendChild(table);
    card.appendChild(cardBody);
    elements.stepsContainer.appendChild(card);
  }
}

function editGroupApparatusResults(event: Event) {
  event.preventDefault();

  const modalElement = elements.groupApparatusResultsModal;
  const modal = Modal.getOrCreateInstance(modalElement);

  const link = event.currentTarget as HTMLAnchorElement;

  const groupId = link.getAttribute(GROUP_ID_ATTR_NAME);
  const apparatus = link.getAttribute(APPARATUS_ATTR_NAME);
  const step = link.getAttribute(STEP_ATTR_NAME);
  logger.debug("Opening group/apparatus results modal", { groupId, apparatus, step });

  modalElement.setAttribute(GROUP_ID_ATTR_NAME, groupId);
  modalElement.setAttribute(APPARATUS_ATTR_NAME, apparatus);
  modalElement.setAttribute(STEP_ATTR_NAME, step);

  elements.groupApparatusResultsModalTitle.textContent = `Step ${step} - Group ${groupId} - ${capitalise(apparatus)}`;

  populateApparatusGroupResultsTable(parseInt(groupId), apparatus, parseInt(step));
  modalElement.removeAttribute(HAS_CHANGES_ATTR_NAME);
  elements.groupApparatusResultsModalForm.classList.remove("was-validated");

  modalElement.addEventListener("shown.bs.modal", () => {
    const body = elements.groupApparatusResultsModalTable.tBodies[0];
    const firstEmptyRow = Array.from(body.rows).find(row => {
      if (row.getAttribute("data-step-header")) { return false; }
      return fieldForCol(row, D_SCORE_COLUMN).value === "";
    });
    if (firstEmptyRow) {
      fieldForCol(firstEmptyRow, D_SCORE_COLUMN).focus();
    }
  }, { once: true });

  modal.show();
}


function valueOfCell(row: HTMLTableRowElement, index: number) {
  return (row.cells[index].firstChild as HTMLInputElement).value;
}

// Dedn1-4, Average, E Score, D Score, Total, Neutral Deductions, Score
const FIRST_E_COLUMN = 1;
const LAST_E_COLUMN = 4;
const AVERAGE_E_COLUMN = 5;
const E_SCORE_COLUMN = 6;
const D_SCORE_COLUMN = 7;
const TOTAL_COLUMN = 8;
const NEUTRAL_DEDUCTIONS_COLUMN = 10;
const FINAL_SCORE_COLUMN = 11;

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

  if (!dValue || dValue === "" || eScoreCount < 2) {
    return false;
    // Default 0 for neutral deductions is fine
  }
  return true;
}

// See https://www.gymnasticsnz.com/wp-content/uploads/2021/02/2021-WAG-Programme-Manual-2021-02-05.pdf
// Section 3.4  (page 13) for scoring definition
function updateScoreRow(row: HTMLTableRowElement) {
  if(!rowCanCalculateScore(row)) {
    row.cells[AVERAGE_E_COLUMN].textContent = "";
    row.cells[E_SCORE_COLUMN].textContent = "";
    row.cells[TOTAL_COLUMN].textContent = "";
    row.cells[FINAL_SCORE_COLUMN].textContent = "";
    return;
  }
  const dScore = parseScore(valueOfCell(row, D_SCORE_COLUMN));
  const judgeEScores = E_COLUMNS.map(index => valueOfCell(row, index));
  const avg = averageJudgeEScores(judgeEScores);
  row.cells[AVERAGE_E_COLUMN].textContent = formatScore(avg);

  const eScore = 10000 - avg;
  row.cells[E_SCORE_COLUMN].textContent = formatScore(eScore);

  const total = dScore + eScore;
  row.cells[TOTAL_COLUMN].textContent = formatScore(total);

  const neutralDeductions = parseScore(valueOfCell(row, NEUTRAL_DEDUCTIONS_COLUMN));

  row.cells[FINAL_SCORE_COLUMN].textContent = formatScore(total - neutralDeductions);
}

function scoreInputFieldChanged(event: Event) {
  const inputField = event.currentTarget as HTMLInputElement;
  const row: HTMLTableRowElement = inputField.parentElement.parentElement as HTMLTableRowElement;
  row.removeAttribute(SCORES_DELETED_ATTR_NAME);
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

function deleteScores(event: Event) {
  event.preventDefault();
  const button = event.currentTarget as HTMLButtonElement;
  const row = button.closest("tr") as HTMLTableRowElement;
  for (const i of COLS_WITH_INPUT_FIELDS) {
    fieldForCol(row, i).value = "";
  }
  row.cells[AVERAGE_E_COLUMN].textContent = "";
  row.cells[E_SCORE_COLUMN].textContent = "";
  row.cells[TOTAL_COLUMN].textContent = "";
  row.cells[FINAL_SCORE_COLUMN].textContent = "";
  row.setAttribute(SCORES_DELETED_ATTR_NAME, "true");
  elements.groupApparatusResultsModal.setAttribute(HAS_CHANGES_ATTR_NAME, "true");
}

function createCompetitorRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for(let i=0; i < 12; i++) {
    row.insertCell();
  }

  // ND's are always negative (to be subtracted); make it part of the UI
  row.cells[NEUTRAL_DEDUCTIONS_COLUMN-1].textContent = "-";

  for (const i of COLS_WITH_INPUT_FIELDS) {
    addInputFieldToCell(row, i);
  }

  const deleteCell = row.insertCell();
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.classList.add("btn", "btn-outline-secondary", "btn-sm", "py-0", "opacity-50");
  const trashIcon = document.createElement("i");
  trashIcon.classList.add("bi", "bi-trash");
  deleteButton.appendChild(trashIcon);
  deleteButton.addEventListener("click", deleteScores);
  deleteCell.appendChild(deleteButton);

  return row;
}

function fieldForCol(row: HTMLTableRowElement, columnNumber: number) :HTMLInputElement {
  return row.cells[columnNumber].firstChild as HTMLInputElement;
}

function populateScoreInField(row: HTMLTableRowElement, columnNumber: number, rawScore: number, decimals: number) {
  if(!isNaN(rawScore)) {
    fieldForCol(row, columnNumber).value = (Math.floor(rawScore) / 1000).toFixed(decimals);
  }
}

async function displayCompetitorInRow(
  row: HTMLTableRowElement,
  competitorDetails: CompetitionCompetitorDetails,
  apparatus: string
) {
  const competitor: ICompetitor = await db.competitors.where(":id").equals(competitorDetails.competitorId).first();
  const club = await db.clubs.where(":id").equals(competitorDetails.clubId).first();
  row.cells[0].textContent = `${competitor.name} (${competitor.identifier} ${club.name})`;

  row.setAttribute(COMPETITOR_ID_ATTR_NAME, competitorDetails.competitorId.toString());
  row.removeAttribute(SCORES_DELETED_ATTR_NAME);

  if(competitorDetails.scores[apparatus]) {
    const scores = competitorDetails.scores[apparatus];

    populateScoreInField(row, D_SCORE_COLUMN, scores.difficulty, 1);
    populateScoreInField(row, FIRST_E_COLUMN, scores.e1, 1);
    populateScoreInField(row, FIRST_E_COLUMN + 1, scores.e2, 1);
    populateScoreInField(row, FIRST_E_COLUMN + 2, scores.e3, 1);
    populateScoreInField(row, FIRST_E_COLUMN + 3, scores.e4, 1);
    populateScoreInField(row, NEUTRAL_DEDUCTIONS_COLUMN, scores.neutralDeductions, 3);

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

function createStepHeaderRow(body: HTMLTableSectionElement, step: number): HTMLTableRowElement {
  const row = body.insertRow(-1);
  row.setAttribute("data-step-header", "true");
  const cell = row.insertCell();
  cell.colSpan = 12;
  cell.textContent = `Step ${step}`;
  cell.classList.add("fw-bold", "table-secondary", "py-1", "small");
  return row;
}

function populateApparatusGroupResultsTable(groupId: number, apparatus: string, step: number) {
  const groupCompetitors = competition.competitors
    .filter(competitor => competitor.groupNumber === groupId && competitor.step === step);

  const body = elements.groupApparatusResultsModalTable.tBodies[0];

  while (body.rows.length > 0) {
    body.deleteRow(-1);
  }

  for (const competitor of groupCompetitors) {
    const row = createCompetitorRow(body);
    displayCompetitorInRow(row, competitor, apparatus);
  }
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
    logger.debug("Save scores rejected: form invalid");
    return;
  }

  const groupId = elements.groupApparatusResultsModal.getAttribute(GROUP_ID_ATTR_NAME);
  const apparatus = elements.groupApparatusResultsModal.getAttribute(APPARATUS_ATTR_NAME);
  logger.info("Saving scores", {
    competitionId: competition.id,
    groupId,
    apparatus,
  });

  let savedCount = 0;
  for(const row of elements.groupApparatusResultsModalTable.rows) {
    const competitorId = parseInt(row.getAttribute(COMPETITOR_ID_ATTR_NAME));
    if(isNaN(competitorId)) {
      continue; // Probably the header row
    }
    const competitor = competition.getCompetitorById(competitorId);

    if(row.getAttribute(SCORES_DELETED_ATTR_NAME) === "true") {
      delete competitor.scores[apparatus];
      logger.debug("Deleted scores for competitor", { competitorId, apparatus });
      savedCount++;
      continue;
    }

    if(!rowCanCalculateScore(row)) {
      logger.debug("Skipping competitor row with insufficient scores", { competitorId, apparatus });
      continue;
    }

    const finalScore = parseScore(row.cells[FINAL_SCORE_COLUMN].textContent);
    competitor.scores[apparatus] = new CompetitorScore(
      parseScore(valueOfCell(row, D_SCORE_COLUMN)),
      parseScore(valueOfCell(row, FIRST_E_COLUMN), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 1), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 2), true),
      parseScore(valueOfCell(row, FIRST_E_COLUMN + 3), true),
      parseScore(valueOfCell(row, NEUTRAL_DEDUCTIONS_COLUMN)),
      finalScore
    );
    logger.debug("Score saved for competitor", {
      competitorId,
      apparatus,
      finalScore: finalScore / 1000,
      dScore: parseScore(valueOfCell(row, D_SCORE_COLUMN)) / 1000,
    });
    savedCount++;
  }
  logger.info("Scores saved", { competitionId: competition.id, groupId, apparatus, savedCount });
  await db.competitions.update(competition.id, competition as CompetitionData);

  const savedGroupId = elements.groupApparatusResultsModal.getAttribute(GROUP_ID_ATTR_NAME);
  const savedApparatus = elements.groupApparatusResultsModal.getAttribute(APPARATUS_ATTR_NAME);
  const savedLinks = document.querySelectorAll<HTMLAnchorElement>(
    `a[${GROUP_ID_ATTR_NAME}="${savedGroupId}"][${APPARATUS_ATTR_NAME}="${savedApparatus}"]`
  );
  for (const savedLink of savedLinks) {
    updateCellStatus(savedLink);
  }

  modal.hide();
}
