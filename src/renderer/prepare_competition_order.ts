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

import Sortable from "sortablejs";
import { Modal } from "bootstrap";
import { db } from "./data/gymscoredb";
import { CompetitionCompetitorDetails, CompetitionData } from "../common/data/competition";
import { getCompetitorsByGroup, getCompetitorsByStep } from "../common/competitors_by";
import { logger } from "./logger";
import { competition } from "./prepare_competition_state";

interface StepGroup {
  step: number;
  group: number;
  competitors: CompetitionCompetitorDetails[];
}

const COMPETITOR_ID_ATTR = "data-competitor-id";

let stepGroups: StepGroup[];
let currentIndex = -1;
let sortable: Sortable;
let modal: Modal;

export function setupOrderTab(): void {
  document.getElementById("saveOrderButton").addEventListener("click", () => saveOrder(false));
  document.getElementById("saveAndNextButton").addEventListener("click", () => saveOrder(true));
  modal = new Modal(document.getElementById("orderModal"));

  document.getElementById("groupOrderTab").addEventListener("shown.bs.tab", () => {
    buildStepGroups();
    renderCards();
  });
}

function buildStepGroups(): void {
  if (!competition) {
    stepGroups = [];
    return;
  }
  const byStep = getCompetitorsByStep(competition.competitors.filter((c) => c.groupNumber > 0));
  stepGroups = [];
  for (const step of Object.keys(byStep).sort()) {
    const byGroup = getCompetitorsByGroup(byStep[step]);
    for (const group of Object.keys(byGroup).sort().filter((g) => g !== "0")) {
      stepGroups.push({
        step: parseInt(step),
        group: parseInt(group),
        competitors: byGroup[group],
      });
    }
  }
}

function isOrdered(sg: StepGroup): boolean {
  return sg.competitors.some((c) => (c.groupOrder ?? 0) > 0);
}

function renderCards(): void {
  const container = document.getElementById("stepsContainer");
  container.innerHTML = "";

  const alertContainer = document.getElementById("ungroupedAlert");
  alertContainer.innerHTML = "";
  const ungroupedCount = competition ? competition.competitors.filter((c) => (c.groupNumber ?? 0) === 0).length : 0;
  if (ungroupedCount > 0) {
    const noun = ungroupedCount === 1 ? "competitor has" : "competitors have";
    const alertEl = document.createElement("div");
    alertEl.className = "alert alert-warning d-flex align-items-center gap-2 mt-3";
    alertEl.setAttribute("role", "alert");

    const icon = document.createElement("i");
    icon.className = "bi bi-exclamation-triangle-fill";
    alertEl.appendChild(icon);

    const msg = document.createElement("span");
    msg.textContent = `${ungroupedCount} ${noun} not been assigned to a group. `;
    alertEl.appendChild(msg);

    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "Review on Competitors tab.";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("competitorsTab").click();
    });
    alertEl.appendChild(link);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-close ms-auto";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.addEventListener("click", () => {
      alertContainer.innerHTML = "";
    });
    alertEl.appendChild(closeBtn);

    alertContainer.appendChild(alertEl);
  }

  if (!stepGroups || stepGroups.length === 0) {
    return;
  }

  const stepNumbers = [...new Set(stepGroups.map((sg) => sg.step))].sort((a, b) => a - b);

  for (const step of stepNumbers) {
    const card = document.createElement("div");
    card.classList.add("card", "step-card");

    const cardHeader = document.createElement("div");
    cardHeader.classList.add("card-header", "fw-bold");
    cardHeader.textContent = `Step ${step}`;
    card.appendChild(cardHeader);

    const cardBody = document.createElement("div");
    cardBody.classList.add("card-body", "p-1");

    const table = document.createElement("table");
    table.classList.add("table", "table-sm", "table-striped", "table-bordered", "w-auto", "mb-0");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Group", "Status", ""].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    stepGroups
      .filter((sg) => sg.step === step)
      .forEach((sg) => {
        const i = stepGroups.indexOf(sg);
        const ordered = isOrdered(sg);
        const row = tbody.insertRow();

        row.insertCell().textContent = sg.group.toString();

        const statusCell = row.insertCell();
        const badge = document.createElement("span");
        badge.className = ordered ? "badge text-bg-success" : "badge text-bg-secondary";
        badge.textContent = ordered ? "Ordered" : "Not ordered";
        statusCell.appendChild(badge);

        const actionCell = row.insertCell();
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-sm btn-outline-primary";
        btn.textContent = "Order";
        btn.addEventListener("click", () => openModal(i));
        actionCell.appendChild(btn);
      });
    table.appendChild(tbody);

    cardBody.appendChild(table);
    card.appendChild(cardBody);
    container.appendChild(card);
  }
}

function competitorDisplayOrder(sg: StepGroup): CompetitionCompetitorDetails[] {
  if (isOrdered(sg)) {
    return [...sg.competitors].sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
  }
  return [...sg.competitors].sort((a, b) => a.competitorName.localeCompare(b.competitorName));
}

function openModal(index: number): void {
  currentIndex = index;
  const sg = stepGroups[index];

  document.getElementById("orderModalTitle").textContent = `Step ${sg.step} \u2014 Group ${sg.group}`;

  const displayOrder = competitorDisplayOrder(sg);
  logger.debug("Order modal opened", {
    step: sg.step,
    group: sg.group,
    order: displayOrder.map((c) => `${c.competitorName} (${c.competitorIdentifier})`),
  });

  const list = document.getElementById("orderList");
  list.innerHTML = "";
  for (const c of displayOrder) {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center gap-2";
    li.setAttribute(COMPETITOR_ID_ATTR, c.competitorId.toString());

    const grip = document.createElement("i");
    grip.className = "bi bi-grip-vertical text-muted";
    li.appendChild(grip);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = c.competitorName;
    li.appendChild(nameSpan);

    const detailSmall = document.createElement("small");
    detailSmall.className = "text-muted ms-1";
    detailSmall.textContent = `${c.competitorIdentifier} \u2014 ${c.clubName}`;
    li.appendChild(detailSmall);

    list.appendChild(li);
  }

  if (sortable) {
    sortable.destroy();
  }
  sortable = new Sortable(list, { animation: 150 });

  const nextUnordered = stepGroups.findIndex((s, i) => i > index && !isOrdered(s));
  document.getElementById("saveAndNextButton").classList.toggle("d-none", nextUnordered < 0);

  modal.show();
}

async function saveOrder(goNext: boolean): Promise<void> {
  const list = document.getElementById("orderList");
  const savedOrder: string[] = [];
  list.querySelectorAll<HTMLElement>(`li[${COMPETITOR_ID_ATTR}]`).forEach((li, index) => {
    const competitorId = parseInt(li.getAttribute(COMPETITOR_ID_ATTR));
    const competitor = competition.competitors.find((c) => c.competitorId === competitorId);
    if (competitor) {
      competitor.groupOrder = index + 1;
      savedOrder.push(`${competitor.competitorName} (${competitor.competitorIdentifier})`);
    }
  });

  const sg = stepGroups[currentIndex];
  logger.debug("Order saved", { step: sg.step, group: sg.group, order: savedOrder });

  await db.competitions.update(competition.id, competition as CompetitionData);

  buildStepGroups();
  renderCards();

  if (goNext) {
    const nextUnordered = stepGroups.findIndex((s, i) => i > currentIndex && !isOrdered(s));
    if (nextUnordered >= 0) {
      openModal(nextUnordered);
      return;
    }
  }

  modal.hide();
}
