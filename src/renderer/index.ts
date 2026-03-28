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
import { ICompetition } from "../common/data";
import * as pageCommon from "./page_common";
import { generatePrepSheets, generateAllResultPDFs } from "./competition_pdfs";
import { Collapse, Modal } from "bootstrap";
import { exportDB, importInto } from "dexie-export-import";
import { logger } from "./logger";
import { buildCompetitionExport } from "./exportCompetition";
import { importCompetition } from "./importCompetition";

declare const api: typeof import("../common/api").default;

logger.info("Renderer index loaded");

const COMPETITION_ID_ATTR = "competitionId";

//TODO: move this to a data place; maybe gymscoredb.ts?
// Looks like we get full persistent access to all available storage but this is worth reporting
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(function(persistent) {
    if (persistent) {
      logger.info("Storage persistence granted; data will not be cleared except by explicit user action");
    } else {
      logger.warn("Storage persistence denied; data may be cleared by the browser under storage pressure");
    }
  });
}
navigator.storage.estimate().then(estimation =>{
  logger.debug("Storage estimate", {
    quotaMB: (estimation.quota / 1024 / 1024).toFixed(1),
    usageMB: (estimation.usage / 1024 / 1024).toFixed(3),
  });
});

type CompetitionCallback = (competition: ICompetition) => void;
type SortCol = "name" | "date" | "location";

let allArchived: ICompetition[] = [];
let archivedSortCol: SortCol = "date";
let archivedSortAsc = false;

pageCommon.setup();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

async function onLoaded() {
  const deleteModal = document.getElementById("deleteCompetitionModal");

  deleteModal.addEventListener("hide.bs.modal", () => {
    deleteModal.removeAttribute(COMPETITION_ID_ATTR);
  });

  document.getElementById("deleteCompetitionModalYes").addEventListener("click", () => {
    const id = parseInt(deleteModal.getAttribute(COMPETITION_ID_ATTR));
    doDeleteCompetition(id);
    Modal.getOrCreateInstance(deleteModal).hide();
  });

  document.getElementById("delete-database-button").addEventListener("click", () => {
    showDangerModal({
      operation: "Delete database",
      warningPrefix: "This will ",
      warningSuffix: "",
      showImportBullet: false,
      confirmText: "Yes, delete everything",
      onConfirm: async() => { await clearDB(); window.location.reload(); },
    });
  });

  document.getElementById("export-database-button").addEventListener("click", exportDatabase);

  document.getElementById("import-database-button").addEventListener("click", () => {
    showDangerModal({
      operation: "Import database",
      warningPrefix: "Importing will ",
      warningSuffix: " and replace it with the contents of the selected file",
      showImportBullet: true,
      confirmText: "Yes, wipe and import",
      onConfirm: doImportDatabase,
    });
  });

  document.getElementById("openLogsButton").addEventListener("click", () => {
    api.sendAsync("open-log-window", null);
  });

  document.getElementById("import-competition-button").addEventListener("click", doImportCompetition);

  setupAccordion("archivedAccordionButton", "archivedCollapse");
  setupAccordion("recordsAccordionButton", "recordsCollapse");
  setupAccordion("databaseAccordionButton", "databaseCollapse");

  document.querySelectorAll("#archivedCompetitions thead th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-col") as SortCol;
      if (archivedSortCol === col) {
        archivedSortAsc = !archivedSortAsc;
      } else {
        archivedSortCol = col;
        archivedSortAsc = true;
      }
      updateArchivedSortIcons();
      renderArchivedTable();
    });
  });

  document.getElementById("filterArchivedName").addEventListener("input", renderArchivedTable);
  document.getElementById("filterArchivedDate").addEventListener("input", renderArchivedTable);
  document.getElementById("filterArchivedLocation").addEventListener("input", renderArchivedTable);

  const all = await db.competitions.toArray();
  const active = all.filter(c => !c.archived);
  allArchived = all.filter(c => !!c.archived);

  displayActiveCompetitions(active);
  updateArchivedSortIcons();
  renderArchivedTable();
}

function displayActiveCompetitions(competitions: ICompetition[]) {
  const tbody = document.querySelector("#activeCompetitions tbody") as HTMLTableSectionElement;
  for (const comp of competitions) {
    tbody.appendChild(buildCompetitionRow(comp, false));
  }
}

function renderArchivedTable() {
  const filterName = (document.getElementById("filterArchivedName") as HTMLInputElement).value.toLowerCase();
  const filterDate = (document.getElementById("filterArchivedDate") as HTMLInputElement).value.toLowerCase();
  const filterLocation = (document.getElementById("filterArchivedLocation") as HTMLInputElement).value.toLowerCase();

  const filtered = allArchived.filter(c =>
    c.name.toLowerCase().includes(filterName) &&
    c.date.toLowerCase().includes(filterDate) &&
    c.location.toLowerCase().includes(filterLocation)
  );

  filtered.sort((a, b) => {
    const valA = a[archivedSortCol].toLowerCase();
    const valB = b[archivedSortCol].toLowerCase();
    const cmp = valA.localeCompare(valB);
    return archivedSortAsc ? cmp : -cmp;
  });

  const tbody = document.querySelector("#archivedCompetitions tbody") as HTMLTableSectionElement;
  tbody.innerHTML = "";
  for (const comp of filtered) {
    tbody.appendChild(buildCompetitionRow(comp, true));
  }
}

function buildCompetitionRow(competition: ICompetition, isArchived: boolean): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.setAttribute(COMPETITION_ID_ATTR, competition.id.toString());
  addTextCell(row, competition.name);
  addTextCell(row, competition.date);
  addTextCell(row, competition.location);
  const actionsCell = row.insertCell();
  actionsCell.appendChild(buildActionsDiv(competition, isArchived));
  return row;
}

function buildActionsDiv(competition: ICompetition, isArchived: boolean): HTMLDivElement {
  const div = document.createElement("div");
  div.classList.add("d-flex", "gap-2", "flex-wrap");
  div.appendChild(makePageLink(competition, "prepare_competition", "Prepare", "pencil"));
  div.appendChild(makeJSLink(competition, promptAndGeneratePrepSheets, "Rec/Programme PDFs", "file-earmark-text"));
  div.appendChild(makePageLink(competition, "live_competition", "Record Scores", "pencil-square"));
  div.appendChild(makeJSLink(competition, promptAndGenerateResultPDFs, "Result PDFs", "file-earmark-pdf"));
  div.appendChild(makeJSLink(competition, doExportCompetition, "Export", "box-arrow-up"));
  if (isArchived) {
    div.appendChild(makeJSLink(competition, promptDeleteCompetition, "Delete", "trash"));
  } else {
    div.appendChild(makeJSLink(competition, doArchiveCompetition, "Archive", "archive"));
  }
  return div;
}

function allCompetitorsGrouped(competition: ICompetition): boolean {
  return competition.competitors.every(c => c.groupNumber !== 0);
}

function promptAndGeneratePrepSheets(competition: ICompetition) {
  if (!allCompetitorsGrouped(competition)) {
    logger.warn("Generating prep sheets with ungrouped competitors", {
      competitionId: competition.id,
      competitionName: competition.name,
      ungroupedCount: competition.competitors.filter(c => c.groupNumber === 0).length,
    });
    if (!confirm("Not all competitors have been assigned to a group. Generate anyway?")) {
      logger.info("User cancelled prep sheet generation due to ungrouped competitors");
      return;
    }
  }
  generatePrepSheets(competition);
}

function allResultsRecorded(competition: ICompetition): boolean {
  for (const apparatus of ["bar", "beam", "floor", "vault"]) {
    if (!competition[apparatus as keyof ICompetition]) {
      continue;
    }
    const groups = Array.from(
      competition.competitors.reduce((set, c) => set.add(c.groupNumber), new Set<number>())
    );
    for (const group of groups) {
      const groupCompetitors = competition.competitors.filter(c => c.groupNumber === group);
      const recorded = groupCompetitors.filter(c => c.scores[apparatus] !== undefined).length;
      if (recorded < groupCompetitors.length) {
        return false;
      }
    }
  }
  return true;
}

function promptAndGenerateResultPDFs(competition: ICompetition) {
  if (!allResultsRecorded(competition)) {
    logger.warn("Generating result PDFs with unrecorded results", {
      competitionId: competition.id,
      competitionName: competition.name,
    });
    if (!confirm("Not all results have been recorded. Do you still want to generate result PDFs?")) {
      logger.info("User cancelled result PDF generation due to unrecorded results");
      return;
    }
  }
  generateAllResultPDFs(competition);
}

function addTextCell(row: HTMLTableRowElement, text: string) {
  const cell = row.insertCell();
  cell.textContent = text;
}

function updateArchivedSortIcons() {
  document.querySelectorAll("#archivedCompetitions thead th[data-col]").forEach(th => {
    const icon = th.querySelector(".sort-icon") as HTMLElement;
    const col = th.getAttribute("data-col");
    if (col === archivedSortCol) {
      icon.className = archivedSortAsc ? "bi bi-arrow-up sort-icon" : "bi bi-arrow-down sort-icon";
    } else {
      icon.className = "bi bi-arrow-down-up text-muted sort-icon";
    }
  });
}

function promptDeleteCompetition(competition: ICompetition) {
  const modal = document.getElementById("deleteCompetitionModal");
  modal.setAttribute(COMPETITION_ID_ATTR, competition.id.toString());
  document.getElementById("deleteCompetitionName").textContent =
    `${competition.name} (${competition.date}, ${competition.location})`;
  Modal.getOrCreateInstance(modal).show();
}

function doDeleteCompetition(competitionId: number) {
  logger.info("Deleting competition", { competitionId });
  db.competitions.delete(competitionId);
  allArchived = allArchived.filter(c => c.id !== competitionId);
  renderArchivedTable();
}

async function doArchiveCompetition(competition: ICompetition) {
  logger.info("Archiving competition", { competitionId: competition.id, competitionName: competition.name });
  competition.archived = true;
  await db.competitions.put(competition);
  allArchived = [...allArchived, competition];
  const tbody = document.querySelector("#activeCompetitions tbody") as HTMLTableSectionElement;
  const row = tbody.querySelector(`tr[${COMPETITION_ID_ATTR}="${competition.id}"]`);
  if (row) {
    row.remove();
  }
  renderArchivedTable();
}

function makePageLink(competition: ICompetition, pageName: string, text: string, iconName: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `${pageName}.html?compId=${competition.id}`;
  fillInLink(link, text, iconName);
  return link;
}

function makeJSLink(
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

function setupAccordion(buttonId: string, collapseId: string) {
  const button = document.getElementById(buttonId);
  const collapseEl = document.getElementById(collapseId);
  button.addEventListener("click", () => {
    const instance = Collapse.getOrCreateInstance(collapseEl, { toggle: false });
    if (collapseEl.classList.contains("show")) {
      instance.hide();
    } else {
      instance.show();
    }
  });
  collapseEl.addEventListener("show.bs.collapse", () => {
    button.classList.remove("collapsed");
    button.setAttribute("aria-expanded", "true");
  });
  collapseEl.addEventListener("hidden.bs.collapse", () => {
    button.classList.add("collapsed");
    button.setAttribute("aria-expanded", "false");
  });
}

async function clearDB() {
  logger.warn("Clearing entire database at user request");
  await db.delete();
  await db.open();
  logger.info("Database cleared and reopened");
}

async function exportDatabase() {
  logger.info("Database export started");
  const blob = await exportDB(db);
  // The JSON string is serialized (Structured Clone) and copied across the process boundary into main.
  // For large databases this could cause a brief UI freeze and a peak of ~3x the export size in memory.
  // Alternatives if that becomes a problem:
  //   - Use blob.arrayBuffer() + ipcRenderer.postMessage(..., [buffer]) to transfer (not copy) the buffer
  //     out of the renderer heap, eliminating one JS allocation — the cross-process copy still occurs.
  //   - Run exportDB() in a Web Worker to keep the serialization off the main thread (best effort/reward).
  //   - Stream chunks via repeated IPC sends to a WriteStream in main, keeping memory bounded.
  const text = await blob.text();
  logger.debug("Database export serialized", { sizeBytes: text.length });
  const result = await api.invoke("export-db", text);
  if (result && !result.success && !result.canceled) {
    logger.error("Database export failed", { result });
    alert("Export failed.");
  } else if (result?.canceled) {
    logger.info("Database export cancelled by user");
  } else {
    logger.info("Database export completed successfully");
  }
}

interface DangerModalConfig {
  operation: string;
  warningPrefix: string;
  warningSuffix: string;
  showImportBullet: boolean;
  confirmText: string;
  onConfirm: () => void;
}

function showDangerModal(config: DangerModalConfig) {
  document.getElementById("dangerModalOperation").textContent = config.operation;
  document.getElementById("dangerModalWarningPrefix").textContent = config.warningPrefix;
  document.getElementById("dangerModalWarningSuffix").textContent = config.warningSuffix;
  document.getElementById("dangerModalImportBullet").classList.toggle("d-none", !config.showImportBullet);
  const oldBtn = document.getElementById("dangerConfirmationModalYes");
  oldBtn.textContent = config.confirmText;
  const newBtn = oldBtn.cloneNode(true) as HTMLElement;
  oldBtn.replaceWith(newBtn);
  newBtn.addEventListener("click", () => {
    Modal.getOrCreateInstance(document.getElementById("dangerConfirmationModal")).hide();
    config.onConfirm();
  });
  Modal.getOrCreateInstance(document.getElementById("dangerConfirmationModal")).show();
}

async function doExportCompetition(competition: ICompetition) {
  logger.info("Competition export started", { competitionId: competition.id, competitionName: competition.name });
  let jsonData: string;
  try {
    jsonData = await buildCompetitionExport(competition);
  } catch (err) {
    logger.error("Competition export build failed", { error: String(err) });
    alert("Export failed: could not read competition data.");
    return;
  }
  const result = await api.invoke("export-competition", { jsonData, competitionName: competition.name });
  if (result?.canceled) {
    logger.info("Competition export cancelled by user");
  } else if (!result?.success) {
    logger.error("Competition export failed", { result });
    alert("Export failed.");
  } else {
    logger.info("Competition export completed successfully");
  }
}

async function doImportCompetition() {
  logger.info("Competition import started");
  const result = await api.invoke("import-competition");
  if (!result || result.canceled || !result.success) {
    logger.info("Competition import cancelled or failed at file-read stage",
      { canceled: result?.canceled, success: result?.success });
    return;
  }
  logger.debug("Competition import file received", { sizeBytes: result.data?.length });
  const importResult = await importCompetition(result.data);
  if (importResult.canceled) {
    logger.info("Competition import cancelled by user during reconciliation");
    return;
  }
  if (!importResult.success) {
    logger.error("Competition import failed", { errorMessage: importResult.errorMessage });
    alert(`Import failed: ${importResult.errorMessage ?? "unknown error"}`);
    return;
  }
  logger.info("Competition import completed", { newCompetitionId: importResult.newCompetitionId });
  window.location.reload();
}

async function doImportDatabase() {
  logger.info("Database import started");
  const result = await api.invoke("import-db");
  if (!result || result.canceled || !result.success) {
    logger.info("Database import cancelled or failed", { canceled: result?.canceled, success: result?.success });
    return;
  }
  logger.debug("Database import file received", { sizeBytes: result.data?.length });
  const blob = new Blob([result.data], { type: "application/json" });
  logger.info("Clearing database before import");
  await db.delete();
  await db.open();
  await importInto(db, blob, { clearTablesBeforeImport: true });
  logger.info("Database import completed, reloading");
  window.location.reload();
}
