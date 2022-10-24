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

const GYM_ID_ATTR_NAME = "gymId";

class Elements extends pageCommon.BaseElements {
  gyms: HTMLTableElement = null;
}
const elements = new Elements();

window.addEventListener("DOMContentLoaded", () => {
  onLoaded();
});

pageCommon.setup();

async function onLoaded() {
  pageCommon.findElements(elements);
  updateGymsTable();
}

async function displayGymInRow(row: HTMLTableRowElement, gym: IGym) {
  row.cells[0].textContent = gym.name;
  row.cells[1].children[0].setAttribute(GYM_ID_ATTR_NAME, gym.id.toString());
}

function createGymRow(body: HTMLTableSectionElement): HTMLTableRowElement {
  const row = body.insertRow(-1);
  for(let i=0; i < 2; i++) {
    row.insertCell();
  }
  const link = document.createElement("a");
  link.href = "";
  link.addEventListener("click", removeGym);

  const icon = document.createElement("i");
  icon.classList.add("bi", "bi-trash");
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
    if(row == undefined) {
      row = createGymRow(body);
    }
    displayGymInRow(row, gym);
  });
}

async function removeGym(event: Event) {
  //TODO: prevent deleting a gym with competitors
  // Do this *first* so we get a chance to catch errors and not immediately reload the page
  event.preventDefault();

  const gymId = parseInt((<HTMLAnchorElement>event.currentTarget).getAttribute(GYM_ID_ATTR_NAME));
  await db.gyms.delete(gymId);
  updateGymsTable();
}
