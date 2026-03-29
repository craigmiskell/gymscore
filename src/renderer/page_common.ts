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

import { GymscoreVersion } from "./data/version";
import { logger } from "./logger";
import { hasDivisions } from "../common/data/division";
import { ICompetition } from "../common/data";
import "./common.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";

function displayVersion() {
  document.title = `GymScore (v${GymscoreVersion})`;
}

export class BaseElements {
  // Filthy hack; convinces 'keyof' that it knows what types fields will be in classes that derive from this
  // We don't use (nor care) about the placeholder, but it *must* exist.
  _: HTMLElement = null;
}

export function setup() {
  window.addEventListener("DOMContentLoaded", () => {
    displayVersion();
  });
}

export function findElements<T extends BaseElements>(els: T) {
  for (const field of Object.keys(els)) {
    els[field as keyof BaseElements] = document.getElementById(field);
  }
}

export class TableSorter<T extends string = string> {
  private sortColumn: T | null = null;
  private sortDirection: "asc" | "desc" = "asc";
  private table: HTMLTableElement = null;

  setup(table: HTMLTableElement, onSortChange: () => void) {
    this.table = table;
    table.querySelectorAll<HTMLTableCellElement>("thead th[data-col]").forEach((th) => {
      th.addEventListener("click", () => this.onHeaderClick(th.dataset.col as T, onSortChange));
    });
    const firstRow = table.tHead.rows[0] as HTMLTableRowElement;
    table.style.setProperty("--filter-row-top", `${firstRow.offsetHeight}px`);
    this.updateSortIndicators();
  }

  private onHeaderClick(col: T, onSortChange: () => void) {
    if (this.sortColumn === col) {
      if (this.sortDirection === "asc") {
        this.sortDirection = "desc";
      } else {
        this.sortColumn = null;
        this.sortDirection = "asc";
      }
    } else {
      this.sortColumn = col;
      this.sortDirection = "asc";
    }
    this.updateSortIndicators();
    onSortChange();
  }

  updateSortIndicators() {
    this.table.querySelectorAll<HTMLTableCellElement>("thead th[data-col]").forEach((th) => {
      const col = th.dataset.col;
      const icon = th.querySelector("i");
      if (this.sortColumn === null) {
        icon.className = "bi bi-arrow-up text-muted";
      } else if (col === this.sortColumn) {
        icon.className = `bi ${this.sortDirection === "asc" ? "bi-arrow-up" : "bi-arrow-down"}`;
      } else {
        icon.className = "bi bi-arrow-down-up text-muted";
      }
    });
  }

  get column(): T | null { return this.sortColumn; }
  get direction(): "asc" | "desc" { return this.sortDirection; }
}

export function setupFilterInputs(inputs: HTMLInputElement[], onFilter: () => void) {
  inputs.forEach((input) => {
    input.addEventListener("input", onFilter);
  });
}

export function updateTableBody<T>(
  body: HTMLTableSectionElement,
  items: T[],
  createRow: (body: HTMLTableSectionElement) => HTMLTableRowElement,
  displayRow: (row: HTMLTableRowElement, item: T, index: number) => void
): void {
  while (body.rows.length > items.length) {
    body.deleteRow(-1);
  }
  items.forEach((item, i) => {
    const row = body.rows[i] ?? createRow(body);
    displayRow(row, item, i);
  });
}

export function populateStepSelect(select: HTMLSelectElement): void {
  for (let i = 1; i <= 10; i++) {
    select.add(new Option(i.toString(), i.toString()));
  }
}

export function applyNarrowFilterStyle(input: HTMLInputElement): void {
  input.style.width = "13ch";
  input.style.minWidth = "0";
}

export function updateDivisionVisibility(stepSelect: HTMLSelectElement, labelId: string, colId: string): void {
  const show = hasDivisions(parseInt(stepSelect.value, 10));
  document.getElementById(labelId).classList.toggle("d-none", !show);
  document.getElementById(colId).classList.toggle("d-none", !show);
}

export function competitionFields(comp: ICompetition) {
  const { name, date, location, vault, bar, beam, floor } = comp;
  return { name, date, location, vault, bar, beam, floor };
}

export function getCompetitionIdFromUrl(): number | undefined {
  const param = new URLSearchParams(window.location.search).get("compId");
  const id = parseInt(param, 10);
  return isNaN(id) ? undefined : id;
}

window.addEventListener("error", (event) => {
  logger.error("Uncaught error: {message}", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    stack: event.error?.stack ?? "",
  });
  alert("Caught unexpected exception: " + event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  logger.error("Unhandled promise rejection: {message}", {
    message: event.reason?.message ?? String(event.reason),
    name: event.reason?.name ?? "",
    stack: event.reason?._e ?? event.reason?.stack ?? "",
  });
  alert(`Unexpected error: ${event.reason?.name ?? "Error"} : ${event.reason?.message ?? event.reason}`);
});
