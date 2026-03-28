// Copyright 2022 Craig Miskell (craig@stroppykitten.com)
//
// This file is part of clubscore
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

import { jsPDF } from "jspdf";
import { CompetitionData, CompetitionCompetitorDetails } from "../../common/data/competition";
import { getCompetitorsByStep } from "../../common/competitors_by";
import {
  PAGE_WIDTH, MARGIN, CONTENT_WIDTH, ROW_HEIGHT, HEADING_FONT_SIZE, BODY_FONT_SIZE,
  enabledApparatuses, formatScore, capitalise, ordinal, teamApparatusScore, addStepTitlePage, divisionSegments,
  PageState, checkPageBreak, rankByScore, computeTeamTotals,
} from "./common";

const PLACING_FONT_SIZE = 7;

export function generateResults(competition: CompetitionData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.deletePage(1);

  const apparatuses = enabledApparatuses(competition);
  const stepCompetitors = getCompetitorsByStep(competition.competitors);
  const sortedSteps = Object.keys(stepCompetitors).sort((a, b) => parseInt(a) - parseInt(b));

  for (const step of sortedSteps) {
    addStepResults(doc, competition, apparatuses, stepCompetitors[step], step);
  }

  return doc;
}

function formatDScore(score: number): string {
  return parseFloat((Math.floor(score) / 1000).toFixed(3)).toString();
}

function computePlacings(competitors: CompetitionCompetitorDetails[], apparatus: string): Map<number, number> {
  const ranked = rankByScore(competitors, (c) => c.scores[apparatus]?.finalScore);
  return new Map([...ranked.entries()].map(([id, { place }]) => [id, place]));
}

function computeOverallPlacings(
  competitors: CompetitionCompetitorDetails[],
  apparatuses: string[]
): Map<number, { place: number; tied: boolean }> {
  return rankByScore(competitors, (c) =>
    apparatuses.some((ap) => c.scores[ap] !== undefined)
      ? apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0)
      : undefined
  );
}

function addStepResults(
  doc: jsPDF,
  competition: CompetitionData,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  const state: PageState = { doc, competition, step, y: addStepTitlePage(doc, competition, step) };

  // Team table
  const teamIndices = Array.from(new Set(
    competitors.map((c) => c.teamIndex).filter((i): i is number => i !== null)
  )).sort((a, b) => a - b);
  if (teamIndices.length > 0) {
    addTeamTable(state, competition, apparatuses, competitors, teamIndices);
    state.y += 8;
  }

  // Pre-compute placings per apparatus (across all competitors at this step, regardless of division)
  const placings = new Map<string, Map<number, number>>();
  for (const apparatus of apparatuses) {
    placings.set(apparatus, computePlacings(competitors, apparatus));
  }

  const segments = divisionSegments(competitors, step);
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) { state.y += 8; }
    addCompetitorTable(state, segments[i].label, apparatuses, segments[i].competitors, placings, competition);
  }
}

// --- Team table ---

interface TeamColLayout {
  teamName: number;
  apparatus: number[];
  overall: number;
}

function computeTeamColLayout(apparatuses: string[]): TeamColLayout {
  const teamNameWidth = 60;
  const overallWidth = 28;
  const apparatusWidth = (CONTENT_WIDTH - teamNameWidth - overallWidth) / Math.max(apparatuses.length, 1);
  const layout: TeamColLayout = {
    teamName: MARGIN,
    apparatus: [],
    overall: MARGIN + teamNameWidth + apparatuses.length * apparatusWidth,
  };
  for (let i = 0; i < apparatuses.length; i++) {
    layout.apparatus.push(MARGIN + teamNameWidth + i * apparatusWidth);
  }
  return layout;
}

function addTeamTable(
  state: PageState,
  competition: CompetitionData,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  teamIndices: number[]
) {
  const doc = state.doc;
  const layout = computeTeamColLayout(apparatuses);

  checkPageBreak(state, ROW_HEIGHT * 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text("Teams", MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Team", layout.teamName, state.y);
  for (let i = 0; i < apparatuses.length; i++) {
    doc.text(capitalise(apparatuses[i]), layout.apparatus[i], state.y);
  }
  doc.text("Overall", layout.overall, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  const teamOveralls = computeTeamTotals(teamIndices, competitors, apparatuses)
    .sort((a, b) => b.total - a.total);

  for (const { teamIndex, total, hasScore } of teamOveralls) {
    const team = competition.teams[teamIndex];
    if (!team) { continue; }

    checkPageBreak(state, ROW_HEIGHT);
    doc.setFontSize(BODY_FONT_SIZE);
    doc.text(team.name, layout.teamName, state.y);

    for (let i = 0; i < apparatuses.length; i++) {
      const score = teamApparatusScore(competitors, teamIndex, apparatuses[i]);
      doc.text(score !== null ? formatScore(score) : "-", layout.apparatus[i], state.y);
    }
    doc.text(hasScore ? formatScore(total) : "-", layout.overall, state.y);
    state.y += ROW_HEIGHT;
  }
}

// --- Competitor table ---

interface CompetitorColLayout {
  name: number;
  id: number;
  club: number;
  team: number;
  apparatus: number[];
  overall: number;
}

function computeCompetitorColLayout(apparatuses: string[]): CompetitorColLayout {
  const nameWidth = 50;
  const idWidth = 18;
  const clubWidth = 35;
  const teamWidth = 30;
  const overallWidth = 28;
  const fixedWidth = nameWidth + idWidth + clubWidth + teamWidth + overallWidth;
  const apparatusWidth = (CONTENT_WIDTH - fixedWidth) / Math.max(apparatuses.length, 1);

  const layout: CompetitorColLayout = {
    name: MARGIN,
    id: MARGIN + nameWidth,
    club: MARGIN + nameWidth + idWidth,
    team: MARGIN + nameWidth + idWidth + clubWidth,
    apparatus: [],
    overall: MARGIN + fixedWidth - overallWidth + apparatuses.length * apparatusWidth,
  };
  for (let i = 0; i < apparatuses.length; i++) {
    layout.apparatus.push(MARGIN + fixedWidth - overallWidth + i * apparatusWidth);
  }
  return layout;
}


function addCompetitorTable(
  state: PageState,
  divisionTitle: string,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  placings: Map<string, Map<number, number>>,
  competition: CompetitionData
) {
  const doc = state.doc;
  const layout = computeCompetitorColLayout(apparatuses);
  const overallPlacings = computeOverallPlacings(competitors, apparatuses);

  const sorted = [...competitors].sort((a, b) => {
    const totalA = apparatuses.reduce((sum, ap) => sum + (a.scores[ap]?.finalScore ?? 0), 0);
    const totalB = apparatuses.reduce((sum, ap) => sum + (b.scores[ap]?.finalScore ?? 0), 0);
    return totalB - totalA;
  });

  checkPageBreak(state, ROW_HEIGHT * 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text(divisionTitle, MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Name", layout.name, state.y);
  doc.text("ID", layout.id, state.y);
  doc.text("Club", layout.club, state.y);
  doc.text("Team", layout.team, state.y);
  for (let i = 0; i < apparatuses.length; i++) {
    doc.text(capitalise(apparatuses[i]), layout.apparatus[i], state.y);
  }
  doc.text("Overall", layout.overall, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  for (const competitor of sorted) {
    checkPageBreak(state, ROW_HEIGHT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FONT_SIZE);

    const teamName = competition.teams[competitor.teamIndex]?.name ?? "";
    doc.text(competitor.competitorName, layout.name, state.y);
    doc.text(competitor.competitorIdentifier, layout.id, state.y);
    doc.text(competitor.clubName, layout.club, state.y);
    doc.text(teamName, layout.team, state.y);

    for (let i = 0; i < apparatuses.length; i++) {
      const apparatus = apparatuses[i];
      const x = layout.apparatus[i];
      const score = competitor.scores[apparatus];

      if (score !== undefined) {
        const scoreText = formatScore(score.finalScore);
        doc.setFontSize(BODY_FONT_SIZE);
        doc.text(scoreText, x, state.y);

        const placing = placings.get(apparatus)?.get(competitor.competitorId);
        const scoreWidth = doc.getTextWidth(scoreText);
        doc.setFontSize(PLACING_FONT_SIZE);
        const annotation = placing !== undefined
          ? `${ordinal(placing)}  (${formatDScore(score.difficulty)})`
          : `(${formatDScore(score.difficulty)})`;
        doc.text(annotation, x + scoreWidth + 0.5, state.y);
      } else {
        doc.setFontSize(BODY_FONT_SIZE);
        doc.text("-", x, state.y);
      }
    }

    const overall = apparatuses.reduce((sum, ap) => sum + (competitor.scores[ap]?.finalScore ?? 0), 0);
    const overallText = formatScore(overall);
    doc.setFontSize(BODY_FONT_SIZE);
    doc.text(overallText, layout.overall, state.y);

    const op = overallPlacings.get(competitor.competitorId);
    if (op !== undefined) {
      const overallWidth = doc.getTextWidth(overallText);
      doc.setFontSize(PLACING_FONT_SIZE);
      doc.text(`${ordinal(op.place)}${op.tied ? "=" : ""}`, layout.overall + overallWidth + 0.5, state.y);
    }

    state.y += ROW_HEIGHT;
  }
  // Restore font size after mixed-size rendering
  doc.setFontSize(HEADING_FONT_SIZE);
}
