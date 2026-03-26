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

import { LogEntry, LogLevel, LOG_LEVEL_NAMES } from "../common/logger-types";
import * as pageCommon from "./page_common";

declare const api: typeof import("../common/api").default;

pageCommon.setup();

const BADGE_CLASSES: Record<number, string> = {
  [LogLevel.TRACE]: "bg-secondary",
  [LogLevel.DEBUG]: "bg-info text-dark",
  [LogLevel.INFO]: "bg-success",
  [LogLevel.WARN]: "bg-warning text-dark",
  [LogLevel.ERROR]: "bg-danger",
  [LogLevel.FATAL]: "bg-danger fw-bold",
};

let allEntries: LogEntry[] = [];
let viewMinLevel = -1;

function makeRow(entry: LogEntry): HTMLTableRowElement {
  const tr = document.createElement("tr");

  const tsCell = tr.insertCell();
  tsCell.textContent = new Date(entry.timestamp).toLocaleString();
  tsCell.style.whiteSpace = "nowrap";

  const levelCell = tr.insertCell();
  const badge = document.createElement("span");
  badge.className = `badge ${BADGE_CLASSES[entry.level] ?? "bg-secondary"}`;
  badge.textContent = LOG_LEVEL_NAMES[entry.level] ?? String(entry.level);
  levelCell.appendChild(badge);

  const msgCell = tr.insertCell();
  msgCell.textContent = entry.message;

  const fieldsCell = tr.insertCell();
  if (Object.keys(entry.fields).length > 0) {
    const pre = document.createElement("pre");
    pre.className = "mb-0";
    pre.style.fontSize = "0.75em";
    pre.textContent = JSON.stringify(entry.fields);
    fieldsCell.appendChild(pre);
  }

  return tr;
}

function isVisible(entry: LogEntry): boolean {
  return viewMinLevel < 0 || entry.level >= viewMinLevel;
}

function scrollToBottom() {
  const container = document.getElementById("tableContainer");
  container.scrollTop = container.scrollHeight;
}

function isNearBottom(): boolean {
  const container = document.getElementById("tableContainer");
  return container.scrollHeight - container.scrollTop <= container.clientHeight + 60;
}

function appendEntry(entry: LogEntry) {
  if (!isVisible(entry)) {
    return;
  }
  const nearBottom = isNearBottom();
  document.getElementById("logsBody").appendChild(makeRow(entry));
  if (nearBottom) {
    scrollToBottom();
  }
}

function rebuildTable() {
  const tbody = document.getElementById("logsBody");
  tbody.innerHTML = "";
  for (const entry of allEntries) {
    if (isVisible(entry)) {
      tbody.appendChild(makeRow(entry));
    }
  }
  scrollToBottom();
}

window.addEventListener("DOMContentLoaded", async () => {
  document.title = "GymScore Logs";

  document.getElementById("viewLevelFilter").addEventListener("change", (e) => {
    viewMinLevel = parseInt((e.target as HTMLSelectElement).value);
    rebuildTable();
  });

  document.getElementById("exportButton").addEventListener("click", async () => {
    const minLevel = parseInt((document.getElementById("exportLevelFilter") as HTMLSelectElement).value);
    const result = await api.invoke("export-logs", minLevel);
    if (result && !result.success && !result.canceled) {
      alert("Export failed.");
    }
  });

  // Buffer entries that arrive before the session is loaded to avoid duplicates
  const pendingEntries: LogEntry[] = [];
  let sessionLoaded = false;

  api.receive("log-window-entry", (entry: LogEntry) => {
    if (sessionLoaded) {
      allEntries.push(entry);
      appendEntry(entry);
    } else {
      pendingEntries.push(entry);
    }
  });

  const sessionEntries: LogEntry[] = await api.invoke("get-log-session");
  sessionLoaded = true;

  allEntries = sessionEntries.slice();

  // Append any entries that arrived during the IPC roundtrip and aren't already in the session
  const sessionKeys = new Set(sessionEntries.map((e) => `${e.timestamp}:${e.template}`));
  for (const entry of pendingEntries) {
    if (!sessionKeys.has(`${entry.timestamp}:${entry.template}`)) {
      allEntries.push(entry);
    }
  }

  rebuildTable();
});
