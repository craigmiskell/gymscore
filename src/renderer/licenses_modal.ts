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

import { Modal } from "bootstrap";
import licensesData from "./data/licenses.json";
import copyingData from "./data/copying.json";

declare const api: typeof import("../common/api").default;

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository: string | null;
}

interface LicenseInfo {
  label: string;
  url: string;
}

const KNOWN_LICENSES: Record<string, LicenseInfo> = {
  "MIT": { label: "MIT License", url: "https://opensource.org/licenses/MIT" },
  "Apache-2.0": { label: "Apache License 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  "MPL-2.0": { label: "Mozilla Public License 2.0", url: "https://www.mozilla.org/en-US/MPL/2.0/" },
  "GPL-3.0-or-later": { label: "GNU GPL v3+", url: "https://www.gnu.org/licenses/gpl-3.0.html" },
};

const MIT_PERMISSION_NOTICE =
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and " +
  "associated documentation files (the \"Software\"), to deal in the Software without restriction, " +
  "including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, " +
  "and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, " +
  "subject to the following conditions:\n\n" +
  "The above copyright notice and this permission notice shall be included in all copies or substantial " +
  "portions of the Software.\n\n" +
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT " +
  "LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. " +
  "IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, " +
  "WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE " +
  "SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.";

function buildGymsScoreNotice(): HTMLElement {
  const div = document.createElement("div");
  div.className = "mb-4 p-3 border rounded";

  const heading = document.createElement("h5");
  heading.className = "mb-1";
  heading.textContent = "GymScore";
  div.appendChild(heading);

  const p = document.createElement("p");
  p.className = "mb-0 small";
  p.appendChild(new Text("GymScore is free software licensed under the "));
  p.appendChild(makeExtLink("https://www.gnu.org/licenses/gpl-3.0.html", "GNU General Public License v3 (GPLv3)"));
  p.appendChild(new Text(". Copyright \u00a9 2022 Craig Miskell. The full license text is in the "));

  const copyingLink = document.createElement("a");
  copyingLink.href = "#";
  copyingLink.id = "openCopyingLink";
  copyingLink.textContent = "COPYING";
  p.appendChild(copyingLink);

  p.appendChild(new Text(" file distributed with this application."));
  div.appendChild(p);

  return div;
}

function buildMitCollapseSection(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-1";

  const btn = document.createElement("button");
  btn.className = "btn btn-link btn-sm p-0 small text-decoration-none";
  btn.setAttribute("type", "button");
  btn.setAttribute("data-bs-toggle", "collapse");
  btn.setAttribute("data-bs-target", "#mitLicenseText");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "mitLicenseText");
  btn.textContent = "Show full MIT license text\u2026";
  wrapper.appendChild(btn);

  const collapse = document.createElement("div");
  collapse.id = "mitLicenseText";
  collapse.className = "collapse";

  const pre = document.createElement("pre");
  pre.className = "small border rounded p-2 bg-light mt-1 license-text-pre";
  pre.textContent = MIT_PERMISSION_NOTICE;
  collapse.appendChild(pre);
  wrapper.appendChild(collapse);

  return wrapper;
}

function repoUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  return raw.startsWith("git://") ? "https://" + raw.slice("git://".length) : raw;
}

function groupKey(license: string): string {
  return license.replace(/^\(|\)$/g, "").replace(/\*$/, "");
}

function makeExtLink(url: string, text: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = "#";
  a.className = "ext-link";
  a.dataset.url = url;
  a.textContent = text;
  return a;
}

function buildLicenseHeading(key: string, pkgCount: number): HTMLHeadingElement {
  const h6 = document.createElement("h6");
  h6.className = "mt-3 mb-1";

  const parts = key.split(" OR ");
  parts.forEach((part, i) => {
    if (i > 0) {
      h6.appendChild(new Text(" or "));
    }
    const known = KNOWN_LICENSES[part];
    h6.appendChild(known ? makeExtLink(known.url, known.label) : new Text(part));
  });

  const count = document.createElement("span");
  count.className = "text-muted fw-normal small";
  count.textContent = " (" + pkgCount + (pkgCount === 1 ? " package)" : " packages)");
  h6.appendChild(count);

  return h6;
}

function buildPackageList(pkgs: LicenseEntry[]): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "mb-0 small";

  pkgs.forEach((pkg, i) => {
    if (i > 0) {
      p.appendChild(new Text(", "));
    }
    const url = repoUrl(pkg.repository);
    const display = pkg.name + "\u00a0" + pkg.version;
    p.appendChild(url ? makeExtLink(url, display) : new Text(display));
  });

  return p;
}

function populateBody(bodyEl: HTMLElement): void {
  const entries = licensesData as LicenseEntry[];

  const groups = new Map<string, LicenseEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry.license);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }

  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "MIT") { return -1; }
    if (b === "MIT") { return 1; }
    return a.localeCompare(b);
  });

  bodyEl.appendChild(buildGymsScoreNotice());

  const intro = document.createElement("p");
  intro.className = "text-muted small mb-3";
  intro.textContent =
    "GymScore bundles the following open-source libraries. Click a package name to visit its source repository.";
  bodyEl.appendChild(intro);

  for (const [key, pkgs] of sortedGroups) {
    bodyEl.appendChild(buildLicenseHeading(key, pkgs.length));
    if (key === "MIT") {
      bodyEl.appendChild(buildMitCollapseSection());
    }
    bodyEl.appendChild(buildPackageList(pkgs));
  }
}

export function setup(): void {
  const modal = document.getElementById("licensesModal");
  modal.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains("ext-link")) {
      event.preventDefault();
      const url = target.dataset.url;
      if (url) {
        api.sendAsync("open-external-url", url);
      }
    }
    if (target.id === "openCopyingLink") {
      event.preventDefault();
      Modal.getOrCreateInstance(document.getElementById("copyingModal")).show();
    }
  });

  document.getElementById("copyingModalBody").textContent = copyingData.text;

  const body = document.getElementById("licensesModalBody");
  populateBody(body);
}

export function show(): void {
  Modal.getOrCreateInstance(document.getElementById("licensesModal")).show();
}
