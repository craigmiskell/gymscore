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
import "./common.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";

// import $ from "jquery";

// // https://github.com/electron/electron/issues/254
// declare global {
//   interface Window { $: any; jQuery: any; }
// }
// window.$ = window.jQuery = $;


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
