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
import { ICompetitor, Division } from "../common/data";
import { Competitor } from "../common/data";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";
import { logger } from "./logger";

const COMPETITOR_ID_ATTR = "competitorId";

type SortColumn = "nationalId" | "name" | "step" | "gym";
const tableSorter = new pageCommon.TableSorter<SortColumn>();

class Elements extends pageCommon.BaseElements {
  competitors: HTMLTableElement = null;
  filterNationalId: HTMLInputElement = null;
  filterName: HTMLInputElement = null;
  filterStep: HTMLInputElement = null;
  filterGym: HTMLInputElement = null;
  editCompetitorModal: HTMLElement = null;
  editCompetitorForm: HTMLFormElement = null;
  editNationalId: HTMLInputElement = null;
  editName: HTMLInputElement = null;
  editStep: HTMLSelectElement = null;
  editDivision: HTMLSelectElement = null;
  editGym: HTMLInputElement = null;
  editCompetitorSave: HTMLButtonElement = null;
  deleteConfirmationModal: HTMLElement = null;
  deleteConfirmationNo: HTMLButtonElement = null;
  deleteConfirmationYes: HTMLButtonElement = null;
}
const elements = new Elements();

pageCommon.setup();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

interface CompetitorDisplay {
  competitor: ICompetitor;
  gymName: string;
}

async function onLoaded() {
  pageCommon.findElements(elements);

  for (let i = 1; i <= 10; i++) {
    const opt = document.createElement("option");
    opt.value = i.toString();
    opt.textContent = i.toString();
    elements.editStep.appendChild(opt);
  }

  elements.deleteConfirmationModal.addEventListener("hide.bs.modal", () => {
    elements.deleteConfirmationModal.removeAttribute(COMPETITOR_ID_ATTR);
  });

  elements.deleteConfirmationYes.addEventListener("click", async () => {
    const competitorId = parseInt(elements.deleteConfirmationModal.getAttribute(COMPETITOR_ID_ATTR));
    logger.info("Deleting competitor", { competitorId });
    await db.competitors.delete(competitorId);
    Modal.getOrCreateInstance(elements.deleteConfirmationModal).hide();
    await updateCompetitorsTable();
  });

  elements.editCompetitorSave.addEventListener("click", async () => {
    await saveEdit();
  });

  tableSorter.setup(elements.competitors, () => { void updateCompetitorsTable(); });
  pageCommon.setupFilterInputs(
    [elements.filterName, elements.filterNationalId, elements.filterStep, elements.filterGym],
    () => { void updateCompetitorsTable(); }
  );
  elements.filterNationalId.style.width = "13ch";
  elements.filterNationalId.style.minWidth = "0";
  elements.filterStep.style.width = "13ch";
  elements.filterStep.style.minWidth = "0";

  await updateCompetitorsTable();
}

async function loadCompetitorDisplays(): Promise<CompetitorDisplay[]> {
  const competitors = await db.competitors.toCollection().sortBy("name");
  const gymIds = [...new Set(competitors.map(c => c.gymId))];
  const gyms = await db.gyms.where(":id").anyOf(gymIds).toArray();
  const gymMap = new Map<number, string>(gyms.map(g => [g.id, g.name]));
  logger.debug("Loaded competitors for display", { competitorCount: competitors.length, gymCount: gyms.length });
  return competitors.map(c => ({
    competitor: c,
    gymName: gymMap.get(c.gymId) ?? "",
  }));
}

async function updateCompetitorsTable() {
  const nationalIdFilter = elements.filterNationalId.value.toLowerCase();
  const nameFilter = elements.filterName.value.toLowerCase();
  const stepFilter = elements.filterStep.value.toLowerCase();
  const gymFilter = elements.filterGym.value.toLowerCase();

  const allDisplays = await loadCompetitorDisplays();

  const filtered = allDisplays
    .sort((a, b) => {
      const defaultOrder = a.competitor.name.localeCompare(b.competitor.name);
      if (tableSorter.column === null) {
        return defaultOrder;
      }
      let primary: number;
      switch (tableSorter.column) {
      case "nationalId": primary = a.competitor.identifier.localeCompare(b.competitor.identifier); break;
      case "name": primary = a.competitor.name.localeCompare(b.competitor.name); break;
      case "step":
        primary = (a.competitor.step - b.competitor.step) ||
          Division[a.competitor.division].localeCompare(Division[b.competitor.division]);
        break;
      case "gym": primary = (a.gymName ?? "").localeCompare(b.gymName ?? ""); break;
      }
      return primary !== 0 ? (tableSorter.direction === "asc" ? primary : -primary) : defaultOrder;
    })
    .filter((d) => {
      const stepStr = `${d.competitor.step} ${Division[d.competitor.division]}`.toLowerCase();
      return (
        d.competitor.identifier.toLowerCase().includes(nationalIdFilter) &&
        d.competitor.name.toLowerCase().includes(nameFilter) &&
        stepStr.includes(stepFilter) &&
        (d.gymName ?? "").toLowerCase().includes(gymFilter)
      );
    });

  const body = elements.competitors.tBodies[0];
  while (body.rows.length > filtered.length) {
    body.deleteRow(-1);
  }

  filtered.forEach((display, i) => {
    let row = body.rows[i];
    if (row == undefined) {
      row = createCompetitorRow(body);
    }
    displayCompetitorInRow(row, display);
  });
}

function createCompetitorRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for (let i = 0; i < 4; i++) {
    row.insertCell();
  }

  const editCell = row.insertCell();
  const editLink = document.createElement("a");
  editLink.href = "";
  editLink.addEventListener("click", (event) => {
    event.preventDefault();
    openEditModal(parseInt(row.getAttribute(COMPETITOR_ID_ATTR)));
  });
  const editIcon = document.createElement("i");
  editIcon.classList.add("bi", "bi-pencil-square");
  editLink.appendChild(editIcon);
  editLink.appendChild(new Text(" Edit"));
  editCell.appendChild(editLink);

  const deleteCell = row.insertCell();
  const deleteLink = document.createElement("a");
  deleteLink.href = "";
  deleteLink.addEventListener("click", (event) => {
    event.preventDefault();
    promptDelete(parseInt(row.getAttribute(COMPETITOR_ID_ATTR)));
  });
  const deleteIcon = document.createElement("i");
  deleteIcon.classList.add("bi", "bi-trash");
  deleteLink.appendChild(deleteIcon);
  deleteLink.appendChild(new Text(" Delete"));
  deleteCell.appendChild(deleteLink);

  return row;
}

function displayCompetitorInRow(row: HTMLTableRowElement, display: CompetitorDisplay) {
  const c = display.competitor;
  row.setAttribute(COMPETITOR_ID_ATTR, c.id.toString());
  row.cells[0].textContent = c.name;
  row.cells[1].textContent = c.identifier;
  row.cells[2].textContent = `${c.step} ${Division[c.division]}`;
  row.cells[3].textContent = display.gymName;
}

async function openEditModal(competitorId: number) {
  logger.debug("Opening competitor edit modal", { competitorId });
  const competitor = await db.competitors.get(competitorId);
  if (!competitor) {
    logger.warn("Competitor not found when opening edit modal", { competitorId });
    return;
  }
  const gym = await db.gyms.get(competitor.gymId);

  elements.editCompetitorModal.setAttribute(COMPETITOR_ID_ATTR, competitorId.toString());
  elements.editNationalId.value = competitor.identifier;
  elements.editName.value = competitor.name;
  elements.editStep.selectedIndex = competitor.step - 1;
  elements.editDivision.selectedIndex = competitor.division;
  elements.editGym.value = gym ? gym.name : "";
  elements.editCompetitorForm.classList.remove("was-validated");

  Modal.getOrCreateInstance(elements.editCompetitorModal).show();
}

async function resolveGymId(gymName: string, existingGymId: number): Promise<number> {
  const existing = await db.gyms.get(existingGymId);
  if (existing && existing.name.toLowerCase() === gymName.toLowerCase()) {
    return existingGymId;
  }
  const found = await db.gyms.where("name").equalsIgnoreCase(gymName).first();
  if (found) {
    logger.debug("Resolved gym by name match", { gymName, gymId: found.id });
    return found.id;
  }
  const newId = await db.gyms.add({ name: gymName });
  logger.info("Created new gym from competitor edit", { gymName, gymId: newId });
  return newId;
}

async function saveEdit() {
  elements.editCompetitorForm.classList.add("was-validated");
  if (!elements.editCompetitorForm.checkValidity()) {
    logger.debug("Competitor edit save rejected: form invalid");
    return;
  }

  const competitorId = parseInt(elements.editCompetitorModal.getAttribute(COMPETITOR_ID_ATTR));
  const existing = await db.competitors.get(competitorId);
  if (!existing) {
    logger.warn("Competitor not found when saving edit", { competitorId });
    return;
  }

  const gymId = await resolveGymId(elements.editGym.value.trim(), existing.gymId);
  const updated = new Competitor(
    elements.editNationalId.value.trim(),
    elements.editName.value.trim(),
    parseInt(elements.editStep.value),
    parseInt(elements.editDivision.value),
    gymId,
    competitorId
  );

  logger.info("Saving competitor edit", {
    competitorId,
    name: updated.name,
    identifier: updated.identifier,
    step: updated.step,
    division: updated.division,
    gymId,
  });
  await db.competitors.put(updated);
  Modal.getOrCreateInstance(elements.editCompetitorModal).hide();
  await updateCompetitorsTable();
}

function promptDelete(competitorId: number) {
  elements.deleteConfirmationModal.setAttribute(COMPETITOR_ID_ATTR, competitorId.toString());
  Modal.getOrCreateInstance(elements.deleteConfirmationModal).show();
}
