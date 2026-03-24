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
import { IGym} from "../common/data";
import * as pageCommon from "./page_common";
import { Modal } from "bootstrap";

const GYM_ID_ATTR_NAME = "gymId";

class Elements extends pageCommon.BaseElements {
  gyms: HTMLTableElement = null;
  editGymModal: HTMLElement = null;
  editGymForm: HTMLFormElement = null;
  editGymName: HTMLInputElement = null;
  editGymSave: HTMLButtonElement = null;
}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

pageCommon.setup();

async function onLoaded() {
  pageCommon.findElements(elements);

  elements.editGymSave.addEventListener("click", async () => {
    await saveEdit();
  });

  updateGymsTable();
}

async function displayGymInRow(row: HTMLTableRowElement, gym: IGym) {
  row.setAttribute(GYM_ID_ATTR_NAME, gym.id.toString());
  row.cells[0].textContent = gym.name;
}

function createGymRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for (let i = 0; i < 2; i++) {
    row.insertCell();
  }
  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const row = <HTMLTableRowElement>(<HTMLElement>event.currentTarget).closest("tr");
    openEditModal(parseInt(row.getAttribute(GYM_ID_ATTR_NAME)));
  });

  const icon = document.createElement("i");
  icon.classList.add("bi", "bi-pencil-square");
  link.appendChild(icon);
  row.cells[1].appendChild(link);
  return row;
}

async function updateGymsTable() {
  const body = elements.gyms.tBodies[0];

  const gyms = await db.gyms.toCollection().sortBy("name");

  // If the table is too long, trim it; if it's short, we'll create more later
  while (body.rows.length > gyms.length) {
    body.deleteRow(-1);
  }

  gyms.forEach((gym, i) => {
    let row = body.rows[i];
    if (row == undefined) {
      row = createGymRow(body);
    }
    displayGymInRow(row, gym);
  });
}

async function openEditModal(gymId: number) {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    return;
  }

  elements.editGymModal.setAttribute(GYM_ID_ATTR_NAME, gymId.toString());
  elements.editGymName.value = gym.name;
  elements.editGymForm.classList.remove("was-validated");

  Modal.getOrCreateInstance(elements.editGymModal).show();
}

async function saveEdit() {
  elements.editGymForm.classList.add("was-validated");
  if (!elements.editGymForm.checkValidity()) {
    return;
  }

  const gymId = parseInt(elements.editGymModal.getAttribute(GYM_ID_ATTR_NAME));
  const existing = await db.gyms.get(gymId);
  if (!existing) {
    return;
  }

  existing.name = elements.editGymName.value;
  await db.gyms.put(existing);
  Modal.getOrCreateInstance(elements.editGymModal).hide();
  await updateGymsTable();
}
