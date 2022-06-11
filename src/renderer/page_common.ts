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
