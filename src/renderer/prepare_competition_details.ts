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
import { ICompetition, Competition, CompetitionState } from "../common/data";
import { Collapse } from "bootstrap";
import { logger } from "./logger";
import { elements, competition, setCompetition } from "./prepare_competition_state";
import { competitionFields } from "./page_common";

export function setupDetailsPanel() {
  elements.detailsEditButton.addEventListener("click", onDetailsButtonClick);
  elements.detailsEditable.addEventListener("show.bs.collapse", onDetailsExpanding);
  elements.detailsEditable.addEventListener("hidden.bs.collapse", onDetailsHidden);
  elements.competitionName.addEventListener("input", autoSave);
  elements.competitionDate.addEventListener("input", autoSave);
  elements.competitionLocation.addEventListener("input", autoSave);
  elements.enableVault.addEventListener("change", autoSave);
  elements.enableBar.addEventListener("change", autoSave);
  elements.enableBeam.addEventListener("change", autoSave);
  elements.enableFloor.addEventListener("change", autoSave);
}

export async function loadCompetition(compId: number | undefined) {
  if (compId) {
    const loaded = await db.competitions.where(":id").equals(compId).first();
    if (loaded) {
      loaded.teams = loaded.teams ?? [];
      loaded.competitors = loaded.competitors ?? [];
      logger.info("Competition loaded", {
        compId,
        ...competitionFields(loaded),
        competitorCount: loaded.competitors.length,
        teamCount: loaded.teams.length,
        state: loaded.state,
      });
      setCompetition(loaded);
      elements.competitionName.value = loaded.name;
      elements.competitionDate.value = loaded.date;
      elements.competitionLocation.value = loaded.location;
      elements.enableBar.checked = loaded.bar;
      elements.enableBeam.checked = loaded.beam;
      elements.enableFloor.checked = loaded.floor;
      elements.enableVault.checked = loaded.vault;
      updateCollapsedText(loaded);
    } else {
      logger.warn("Competition not found in DB", { compId });
    }
  } else {
    logger.info("No competition ID in URL; creating new competition");
    elements.enableBar.checked =
    elements.enableBeam.checked =
    elements.enableFloor.checked =
    elements.enableVault.checked = true;
  }
}

export function showInitialState() {
  if (competition == undefined) {
    elements.detailsEditable.addEventListener("shown.bs.collapse", () => {
      elements.competitionName.focus();
    }, { once: true });
    Collapse.getOrCreateInstance(elements.detailsEditable, { toggle: false }).show();
  } else {
    setFormFieldsEnabled(false);
  }
}

function updateCollapsedText(comp: ICompetition) {
  elements.detailsCollapsedText.innerText = `${comp.name} - ${comp.date} - ${comp.location}`;
}

async function saveCompetitionDetails() {
  if (competition) {
    competition.name = elements.competitionName.value;
    competition.date = elements.competitionDate.value;
    competition.location = elements.competitionLocation.value;
    competition.state = CompetitionState.Preparing;
    populateCompetitionDisciplines(competition);
    logger.debug("Auto-saving competition details", {
      competitionId: competition.id,
      ...competitionFields(competition),
    });
    db.competitions.put(competition);
  } else {
    setCompetition(await createCompetition());
  }
  updateCollapsedText(competition);
}

async function createCompetition(): Promise<ICompetition> {
  const comp = new Competition(
    elements.competitionName.value,
    elements.competitionDate.value,
    elements.competitionLocation.value,
  );
  populateCompetitionDisciplines(comp);
  await db.competitions.add(comp);
  logger.info("New competition created", {
    competitionId: comp.id,
    ...competitionFields(comp),
  });
  return comp;
}

function populateCompetitionDisciplines(comp: ICompetition) {
  comp.vault = elements.enableVault.checked;
  comp.bar = elements.enableBar.checked;
  comp.beam = elements.enableBeam.checked;
  comp.floor = elements.enableFloor.checked;
}

export function setFormFieldsEnabled(enabled: boolean) {
  const fields = [
    elements.competitionName, elements.competitionDate,
    elements.competitionLocation, elements.enableBar, elements.enableBeam,
    elements.enableFloor, elements.enableVault,
  ];
  for (const field of fields) {
    field.classList.toggle("disabled", !enabled);
    field.disabled = !enabled;
  }
}

function onDetailsButtonClick() {
  const collapse = Collapse.getOrCreateInstance(elements.detailsEditable, { toggle: false });
  if (elements.detailsEditable.classList.contains("show")) {
    collapse.hide();
  } else {
    collapse.show();
  }
}

function onDetailsExpanding() {
  elements.detailsForm.classList.remove("was-validated");
  setFormFieldsEnabled(true);
  elements.detailsEditButton.classList.remove("collapsed");
  elements.detailsEditButton.setAttribute("aria-expanded", "true");
}

function onDetailsHidden() {
  elements.detailsEditButton.classList.add("collapsed");
  elements.detailsEditButton.setAttribute("aria-expanded", "false");
}

let autoSaveTimer: ReturnType<typeof setTimeout> = null;

function autoSave() {
  if (!elements.detailsForm.checkValidity()) {
    return;
  }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => { void saveCompetitionDetails(); }, 300);
}
