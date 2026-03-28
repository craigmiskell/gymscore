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
import { MAX_SUPPORTED_FORMAT_VERSION } from "../common/data/competitionExport";
import { GymscoreVersion } from "./data/version";
import {
  CompetitionImportHandler,
  DuplicateInfo,
  DuplicateAction,
  CompetitorMismatch,
  NameChoice,
  ImportCompetitionResult,
} from "./competitionImportTypes";
import { v1Handler } from "./importCompetition_v1";
import { logger } from "./logger";

// ─── Modal element IDs (must match index.html) ────────────────────────────────

const DUPLICATE_MODAL_ID = "importDuplicateModal";
const DUPLICATE_NAME_ID = "importDuplicateName";
const DUPLICATE_CREATE_BTN_ID = "importDuplicateCreateBtn";
const DUPLICATE_OVERWRITE_BTN_ID = "importDuplicateOverwriteBtn";

const RECONCILE_MODAL_ID = "importReconcileModal";
const RECONCILE_TBODY_ID = "importReconcileTbody";
const RECONCILE_PROCEED_BTN_ID = "importReconcileProceedBtn";

// ─── Version registry ─────────────────────────────────────────────────────────
//
// To add support for a new format version, add one case here and create the
// corresponding importCompetition_vN.ts that exports a CompetitionImportHandler.

function getHandler(formatVersion: number): CompetitionImportHandler | null {
  switch (formatVersion) {
  case 1: return v1Handler;
  default: return null;
  }
}

export async function importCompetition(jsonData: string): Promise<ImportCompetitionResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return { success: false, errorMessage: "Invalid file: could not parse JSON." };
  }

  const formatVersion: unknown = parsed?.formatVersion;
  if (typeof formatVersion !== "number") {
    return { success: false, errorMessage: "Invalid file: missing or invalid formatVersion." };
  }

  if (formatVersion > MAX_SUPPORTED_FORMAT_VERSION) {
    const minGs: string = parsed?.minGymscoreVersion ?? "a newer version";
    const exportGs: string = parsed?.gymscoreVersion ?? "unknown";
    return {
      success: false,
      errorMessage:
        `This file was exported by GymScore v${exportGs} using export format version ${formatVersion}. ` +
        `Your copy of GymScore (${GymscoreVersion}) supports up to format version ${MAX_SUPPORTED_FORMAT_VERSION}. ` +
        `You need at least GymScore v${minGs} to import this file.`,
    };
  }

  const handler = getHandler(formatVersion);
  if (!handler) {
    return { success: false, errorMessage: `Unsupported format version ${formatVersion}.` };
  }

  logger.info("Dispatching to import handler", { formatVersion });
  return handler.run(parsed, showDuplicateModal, showReconcileModal);
}

function showDuplicateModal(info: DuplicateInfo): Promise<"cancel" | DuplicateAction> {
  return new Promise(resolve => {
    let settled = false;
    const settle = (value: "cancel" | DuplicateAction) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const modal = document.getElementById(DUPLICATE_MODAL_ID);
    document.getElementById(DUPLICATE_NAME_ID).textContent = `${info.name} (${info.date})`;

    const createBtn = document.getElementById(DUPLICATE_CREATE_BTN_ID);
    const newCreateBtn = createBtn.cloneNode(true) as HTMLElement;
    createBtn.replaceWith(newCreateBtn);
    newCreateBtn.addEventListener("click", () => {
      Modal.getOrCreateInstance(modal).hide();
      settle("create-duplicate");
    });

    const overwriteBtn = document.getElementById(DUPLICATE_OVERWRITE_BTN_ID);
    const newOverwriteBtn = overwriteBtn.cloneNode(true) as HTMLElement;
    overwriteBtn.replaceWith(newOverwriteBtn);
    newOverwriteBtn.addEventListener("click", () => {
      Modal.getOrCreateInstance(modal).hide();
      settle("overwrite");
    });

    modal.addEventListener("hidden.bs.modal", () => settle("cancel"), { once: true });
    Modal.getOrCreateInstance(modal).show();
  });
}

function makeRadioOption(identifier: string, value: string, label: string, checked: boolean): HTMLDivElement {
  const div = document.createElement("div");
  div.classList.add("form-check");
  const input = document.createElement("input");
  input.classList.add("form-check-input");
  input.type = "radio";
  input.name = `reconcile-${CSS.escape(identifier)}`;
  input.id = `reconcile-${value}-${CSS.escape(identifier)}`;
  input.value = value;
  input.checked = checked;
  const lbl = document.createElement("label");
  lbl.classList.add("form-check-label");
  lbl.htmlFor = input.id;
  lbl.textContent = label;
  div.appendChild(input);
  div.appendChild(lbl);
  return div;
}

function showReconcileModal(
  mismatches: CompetitorMismatch[],
): Promise<Map<string, NameChoice> | null> {
  return new Promise(resolve => {
    let settled = false;
    const settle = (value: Map<string, NameChoice> | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const modal = document.getElementById(RECONCILE_MODAL_ID);
    const tbody = document.getElementById(RECONCILE_TBODY_ID);

    tbody.innerHTML = "";
    for (const mm of mismatches) {
      const row = document.createElement("tr");

      const idCell = document.createElement("td");
      idCell.textContent = mm.identifier;
      row.appendChild(idCell);

      const localCell = document.createElement("td");
      localCell.textContent = mm.localName;
      row.appendChild(localCell);

      const exportCell = document.createElement("td");
      exportCell.textContent = mm.exportName;
      row.appendChild(exportCell);

      const choiceCell = document.createElement("td");
      choiceCell.appendChild(makeRadioOption(mm.identifier, "keep-local", "Keep mine", true));
      choiceCell.appendChild(makeRadioOption(mm.identifier, "use-export", "Use from import", false));
      row.appendChild(choiceCell);
      tbody.appendChild(row);
    }

    const proceedBtn = document.getElementById(RECONCILE_PROCEED_BTN_ID);
    const newProceedBtn = proceedBtn.cloneNode(true) as HTMLElement;
    proceedBtn.replaceWith(newProceedBtn);
    newProceedBtn.addEventListener("click", () => {
      const choices = new Map<string, NameChoice>();
      for (const mm of mismatches) {
        const selected = tbody.querySelector<HTMLInputElement>(
          `input[name="reconcile-${CSS.escape(mm.identifier)}"]:checked`
        );
        choices.set(mm.identifier, (selected?.value ?? "keep-local") as NameChoice);
      }
      Modal.getOrCreateInstance(modal).hide();
      settle(choices);
    });

    modal.addEventListener("hidden.bs.modal", () => settle(null), { once: true });
    Modal.getOrCreateInstance(modal).show();
  });
}
