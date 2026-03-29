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

  const intro = document.createElement("p");
  intro.className = "text-muted small mb-3";
  intro.textContent =
    "GymScore bundles the following open-source libraries. Click a package name to visit its source repository.";
  bodyEl.appendChild(intro);

  for (const [key, pkgs] of sortedGroups) {
    bodyEl.appendChild(buildLicenseHeading(key, pkgs.length));
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
  });

  const body = document.getElementById("licensesModalBody");
  populateBody(body);
}

export function show(): void {
  Modal.getOrCreateInstance(document.getElementById("licensesModal")).show();
}
