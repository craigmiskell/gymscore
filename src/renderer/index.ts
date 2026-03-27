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

import { db } from "./data/gymscoredb";
import { ICompetition, CompetitionState } from "../common/data";
import * as pageCommon from "./page_common";
import { generateCompetitionPDFs, generateCertificatePDFs } from "./competition_pdfs";
import { Collapse, Modal } from "bootstrap";
import { exportDB, importInto } from "dexie-export-import";
import { logger } from "./logger";

declare const api: typeof import("../common/api").default;

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

  document.getElementById("export-database-button").addEventListener(
    "click", exportDatabase
  );

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

  setupAccordion("recordsAccordionButton", "recordsCollapse");
  setupAccordion("databaseAccordionButton", "databaseCollapse");

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
  logger.info("Deleting competition", { competitionId });
  db.competitions.delete(competitionId);
  const table = <HTMLTableElement>document.getElementById("preparingCompetitions");

  const row = table.querySelector(`tr[${COMPETITION_ID_ATTR}="${competitionId}"]`);
  if (row == null) {
    logger.warn("Did not find table row for deleted competition", { competitionId });
    return;
  }
  row.remove();
}

async function startCompetition(competition: ICompetition) {
  const ungrouped = competition.competitors.filter((c) => c.groupNumber === 0);
  if (ungrouped.length > 0) {
    logger.warn("Cannot start competition: {count} ungrouped competitors", {
      count: ungrouped.length,
      competitionId: competition.id,
      competitionName: competition.name,
    });
    Modal.getOrCreateInstance(document.getElementById("ungroupedCompetitorsModal")).show();
    return;
  }
  logger.info("Starting competition", {
    competitionId: competition.id,
    competitionName: competition.name,
    competitorCount: competition.competitors.length,
  });
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
  displayCompetitionLink(row, getPageLink(competition, "prepare_competition", "Prepare", "pencil"));
  displayCompetitionLink(row, getPageLink(competition, "live_competition", "Scores", "pencil-square"));
  displayCompetitionLink(
    row,
    getJSLink(competition, generateCompetitionPDFs, "Results PDFs", "file-earmark-pdf")
  );
  displayCompetitionLink(
    row,
    getJSLink(competition, generateCertificatePDFs, "Certificates", "award")
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
