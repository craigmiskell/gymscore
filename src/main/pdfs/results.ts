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
import { Competition, CompetitionCompetitorDetails } from "../../common/data/competition";
import { Division } from "../../common/data/division";
import { getCompetitorsByStep } from "../../common/competitors_by";
import {
  PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH, BOTTOM_MARGIN, ROW_HEIGHT, HEADING_FONT_SIZE, BODY_FONT_SIZE,
  enabledApparatuses, formatScore, capitalise, ordinal, teamApparatusScore, addStepTitlePage,
} from "./common";

const PLACING_FONT_SIZE = 7;

export function generateResults(competition: Competition): jsPDF {
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

// Returns a map from competitorId to 1-based rank for the given apparatus across all competitors at this step.
// Competitors with equal scores receive the same rank.
function computePlacings(competitors: CompetitionCompetitorDetails[], apparatus: string): Map<number, number> {
  const withScore = competitors
    .filter((c) => c.scores[apparatus] !== undefined)
    .sort((a, b) => b.scores[apparatus].finalScore - a.scores[apparatus].finalScore);

  const result = new Map<number, number>();
  for (let i = 0; i < withScore.length; i++) {
    const isTie = i > 0 &&
      withScore[i].scores[apparatus].finalScore === withScore[i - 1].scores[apparatus].finalScore;
    result.set(withScore[i].competitorId, isTie ? result.get(withScore[i - 1].competitorId) : i + 1);
  }
  return result;
}

interface PageState {
  doc: jsPDF;
  competition: Competition;
  step: string;
  y: number;
}

function addContinuationHeader(state: PageState) {
  state.doc.addPage("a4", "landscape");
  state.doc.setFont("helvetica", "normal");
  state.doc.setFontSize(8);
  state.doc.text(`${state.competition.name} \u2014 WAG Step ${state.step} (continued)`, MARGIN, MARGIN + 4);
  state.y = MARGIN + 10;
}

function checkPageBreak(state: PageState, neededHeight: number) {
  if (state.y + neededHeight > PAGE_HEIGHT - BOTTOM_MARGIN) {
    addContinuationHeader(state);
  }
}

function addStepResults(
  doc: jsPDF,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  const state: PageState = { doc, competition, step, y: addStepTitlePage(doc, competition, step) };

  // Team table
  const teamIndices = Array.from(new Set(competitors.map((c) => c.teamIndex))).sort((a, b) => a - b);
  if (teamIndices.length > 0) {
    addTeamTable(state, competition, apparatuses, competitors, teamIndices);
    state.y += 8;
  }

  // Pre-compute placings per apparatus (across all competitors at this step, regardless of division)
  const placings = new Map<string, Map<number, number>>();
  for (const apparatus of apparatuses) {
    placings.set(apparatus, computePlacings(competitors, apparatus));
  }

  const overs = competitors.filter((c) => c.division === Division.Over);
  const unders = competitors.filter((c) => c.division === Division.Under);

  if (overs.length > 0) {
    addCompetitorTable(state, "Overs", apparatuses, overs, placings, competition);
    state.y += 8;
  }
  if (unders.length > 0) {
    addCompetitorTable(state, "Unders", apparatuses, unders, placings, competition);
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
  competition: Competition,
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

  const teamOveralls = teamIndices.map((teamIndex) => {
    const overall = apparatuses.reduce((sum, apparatus) => {
      const score = teamApparatusScore(competitors, teamIndex, apparatus);
      return score !== null ? sum + score : sum;
    }, 0);
    const hasAnyScore = apparatuses.some(
      (apparatus) => teamApparatusScore(competitors, teamIndex, apparatus) !== null
    );
    return { teamIndex, overall, hasAnyScore };
  });
  teamOveralls.sort((a, b) => b.overall - a.overall);

  for (const { teamIndex, overall, hasAnyScore } of teamOveralls) {
    const team = competition.teams[teamIndex];
    if (!team) { continue; }

    checkPageBreak(state, ROW_HEIGHT);
    doc.setFontSize(BODY_FONT_SIZE);
    doc.text(team.name, layout.teamName, state.y);

    for (let i = 0; i < apparatuses.length; i++) {
      const score = teamApparatusScore(competitors, teamIndex, apparatuses[i]);
      doc.text(score !== null ? formatScore(score) : "-", layout.apparatus[i], state.y);
    }
    doc.text(hasAnyScore ? formatScore(overall) : "-", layout.overall, state.y);
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

function computeOverallPlacings(
  competitors: CompetitionCompetitorDetails[],
  apparatuses: string[]
): Map<number, { place: number; tied: boolean }> {
  const totals = competitors.map((c) => ({
    id: c.competitorId,
    total: apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0),
  }));
  totals.sort((a, b) => b.total - a.total);

  const result = new Map<number, { place: number; tied: boolean }>();
  for (let i = 0; i < totals.length; i++) {
    const place = i === 0 ? 1 : (
      totals[i].total === totals[i - 1].total
        ? result.get(totals[i - 1].id).place
        : i + 1
    );
    result.set(totals[i].id, { place, tied: false });
  }
  // Mark ties
  for (const [id, entry] of result) {
    const samePlace = [...result.values()].filter((e) => e.place === entry.place);
    if (samePlace.length > 1) {
      result.set(id, { ...entry, tied: true });
    }
  }
  return result;
}

function addCompetitorTable(
  state: PageState,
  divisionTitle: string,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  placings: Map<string, Map<number, number>>,
  competition: Competition
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
