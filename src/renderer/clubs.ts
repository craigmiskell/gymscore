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
import { IClub} from "../common/data";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";
import { logger } from "./logger";

const CLUB_ID_ATTR_NAME = "clubId";

class Elements extends pageCommon.BaseElements {
  clubs: HTMLTableElement = null;
  editClubModal: HTMLElement = null;
  editClubForm: HTMLFormElement = null;
  editClubName: HTMLInputElement = null;
  editClubSave: HTMLButtonElement = null;
}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

pageCommon.setup();

async function onLoaded() {
  pageCommon.findElements(elements);

  elements.editClubSave.addEventListener("click", async () => {
    await saveEdit();
  });

  updateClubsTable();
}

async function displayClubInRow(row: HTMLTableRowElement, club: IClub) {
  row.setAttribute(CLUB_ID_ATTR_NAME, club.id.toString());
  row.cells[0].textContent = club.name;
}

function createClubRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for (let i = 0; i < 2; i++) {
    row.insertCell();
  }
  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const row = <HTMLTableRowElement>(<HTMLElement>event.currentTarget).closest("tr");
    openEditModal(parseInt(row.getAttribute(CLUB_ID_ATTR_NAME)));
  });

  const icon = document.createElement("i");
  icon.classList.add("bi", "bi-pencil-square");
  link.appendChild(icon);
  row.cells[1].appendChild(link);
  return row;
}

async function updateClubsTable() {
  const body = elements.clubs.tBodies[0];

  const clubs = await db.clubs.toCollection().sortBy("name");
  logger.debug("Updating clubs table", { count: clubs.length });

  pageCommon.updateTableBody(body, clubs, createClubRow, (row, club) => {
    displayClubInRow(row, club);
  });
}

async function openEditModal(clubId: number) {
  logger.debug("Opening club edit modal", { clubId });
  const club = await db.clubs.get(clubId);
  if (!club) {
    logger.warn("Club not found when opening edit modal", { clubId });
    return;
  }

  elements.editClubModal.setAttribute(CLUB_ID_ATTR_NAME, clubId.toString());
  elements.editClubName.value = club.name;
  elements.editClubForm.classList.remove("was-validated");

  Modal.getOrCreateInstance(elements.editClubModal).show();
}

async function saveEdit() {
  elements.editClubForm.classList.add("was-validated");
  if (!elements.editClubForm.checkValidity()) {
    logger.debug("Club edit save rejected: form invalid");
    return;
  }

  const clubId = parseInt(elements.editClubModal.getAttribute(CLUB_ID_ATTR_NAME));
  const existing = await db.clubs.get(clubId);
  if (!existing) {
    logger.warn("Club not found when saving edit", { clubId });
    return;
  }

  const oldName = existing.name;
  existing.name = elements.editClubName.value;
  logger.info("Saving club edit", { clubId, oldName, newName: existing.name });
  await db.clubs.put(existing);
  Modal.getOrCreateInstance(elements.editClubModal).hide();
  await updateClubsTable();
}
