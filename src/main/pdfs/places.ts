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

import { jsPDF } from "jspdf";
import { CompetitionData, CompetitionCompetitorDetails } from "../../common/data/competition";
import { getCompetitorsByStep } from "../../common/competitors_by";
import {
  PAGE_WIDTH, MARGIN, ROW_HEIGHT, HEADING_FONT_SIZE, BODY_FONT_SIZE,
  enabledApparatuses, formatScore, capitalise, ordinal, addStepTitlePage, divisionSegments,
  PageState, checkPageBreak, rankByScore, computeTeamTotals,
} from "./common";

// Team section column x-positions
const TEAM_PLACE_COL = MARGIN;
const TEAM_PLACE_WIDTH = 20;
const TEAM_NAME_COL = TEAM_PLACE_COL + TEAM_PLACE_WIDTH;
const TEAM_NAME_WIDTH = 70;
const TEAM_SCORE_COL = TEAM_NAME_COL + TEAM_NAME_WIDTH;
const TEAM_SCORE_WIDTH = 30;
const TEAM_MEMBERS_COL = TEAM_SCORE_COL + TEAM_SCORE_WIDTH;
const TEAM_MEMBERS_WIDTH = PAGE_WIDTH - MARGIN - TEAM_MEMBERS_COL;

// Division (Overs/Unders) section column x-positions
const DIV_APPARATUS_COL = MARGIN;
const DIV_APPARATUS_WIDTH = 40;
const DIV_PLACE_COL = DIV_APPARATUS_COL + DIV_APPARATUS_WIDTH;
const DIV_PLACE_WIDTH = 20;
const DIV_NAME_COL = DIV_PLACE_COL + DIV_PLACE_WIDTH;
const DIV_NAME_WIDTH = 70;
const DIV_SCORE_COL = DIV_NAME_COL + DIV_NAME_WIDTH;
const DIV_SCORE_WIDTH = 30;
const DIV_CLUB_COL = DIV_SCORE_COL + DIV_SCORE_WIDTH;

export function generatePlaces(competition: CompetitionData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.deletePage(1);

  const apparatuses = enabledApparatuses(competition);
  const stepCompetitors = getCompetitorsByStep(competition.competitors);
  const sortedSteps = Object.keys(stepCompetitors).sort((a, b) => parseInt(a) - parseInt(b));

  for (const step of sortedSteps) {
    addStepPlaces(doc, competition, apparatuses, stepCompetitors[step], step);
  }

  return doc;
}

function addStepPlaces(
  doc: jsPDF,
  competition: CompetitionData,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  const state: PageState = { doc, competition, step, y: addStepTitlePage(doc, competition, step) };

  addTeamPlaces(state, competition, apparatuses, competitors);

  for (const segment of divisionSegments(competitors, step)) {
    state.y += 8;
    addDivisionPlaces(state, segment.label, apparatuses, segment.competitors);
  }
}

function addTeamPlaces(
  state: PageState,
  competition: CompetitionData,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[]
) {
  const doc = state.doc;

  const teamIndices = Array.from(new Set(
    competitors.map((c) => c.teamIndex).filter((i): i is number => i !== null)
  ));
  const teamTotals = computeTeamTotals(teamIndices, competitors, apparatuses)
    .filter((t) => t.hasScore)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  if (teamTotals.length === 0) { return; }

  checkPageBreak(state, ROW_HEIGHT * (2 + teamTotals.length));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text("Teams", MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Place", TEAM_PLACE_COL, state.y);
  doc.text("Team", TEAM_NAME_COL, state.y);
  doc.text("Score", TEAM_SCORE_COL, state.y);
  doc.text("Competitors", TEAM_MEMBERS_COL, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  let place = 1;
  for (let i = 0; i < teamTotals.length; i++) {
    const { teamIndex, total } = teamTotals[i];
    const team = competition.teams[teamIndex];
    if (!team) { continue; }

    const isTie = i > 0 && total === teamTotals[i - 1].total;
    if (!isTie) { place = i + 1; }

    const members = competitors
      .filter((c) => c.teamIndex === teamIndex)
      .map((c) => c.competitorName)
      .join(", ");

    doc.setFontSize(BODY_FONT_SIZE);
    const memberLines = doc.splitTextToSize(members, TEAM_MEMBERS_WIDTH);
    const lineSpacing = doc.getFontSize() * doc.getLineHeightFactor() / doc.internal.scaleFactor;
    const rowHeight = ROW_HEIGHT + (memberLines.length - 1) * lineSpacing;
    checkPageBreak(state, rowHeight);
    doc.text(ordinal(place) + (isTie ? "=" : ""), TEAM_PLACE_COL, state.y);
    doc.text(team.name, TEAM_NAME_COL, state.y);
    doc.text(formatScore(total), TEAM_SCORE_COL, state.y);
    doc.text(memberLines, TEAM_MEMBERS_COL, state.y);
    state.y += rowHeight;
  }
}

interface PlaceEntry {
  competitor: CompetitionCompetitorDetails;
  place: number;
  tied: boolean;
}

function computeTop3WithPlaces(
  competitors: CompetitionCompetitorDetails[],
  apparatus: string
): PlaceEntry[] {
  const ranked = rankByScore(competitors, (c) => c.scores[apparatus]?.finalScore);
  return [...competitors]
    .filter((c) => ranked.has(c.competitorId))
    .sort((a, b) =>
      (ranked.get(a.competitorId)?.place ?? Infinity) - (ranked.get(b.competitorId)?.place ?? Infinity))
    .slice(0, 3)
    .map((c) => {
      const r = ranked.get(c.competitorId);
      return { competitor: c, place: r.place, tied: r.tied };
    });
}

interface OverallPlaceEntry {
  competitor: CompetitionCompetitorDetails;
  total: number;
  place: number;
  tied: boolean;
}

function computeTop3OverallWithPlaces(
  competitors: CompetitionCompetitorDetails[],
  apparatuses: string[]
): OverallPlaceEntry[] {
  const ranked = rankByScore(competitors, (c) =>
    apparatuses.some((ap) => c.scores[ap] !== undefined)
      ? apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0)
      : undefined
  );
  return [...competitors]
    .filter((c) => ranked.has(c.competitorId))
    .sort((a, b) =>
      (ranked.get(a.competitorId)?.place ?? Infinity) - (ranked.get(b.competitorId)?.place ?? Infinity))
    .slice(0, 3)
    .map((c) => {
      const total = apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0);
      const r = ranked.get(c.competitorId);
      return { competitor: c, total, place: r.place, tied: r.tied };
    });
}

function addDivisionPlaces(
  state: PageState,
  divisionTitle: string,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[]
) {
  const doc = state.doc;

  checkPageBreak(state, ROW_HEIGHT * 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text(divisionTitle, MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Apparatus", DIV_APPARATUS_COL, state.y);
  doc.text("Place", DIV_PLACE_COL, state.y);
  doc.text("Name", DIV_NAME_COL, state.y);
  doc.text("Score", DIV_SCORE_COL, state.y);
  doc.text("Club", DIV_CLUB_COL, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  for (const apparatus of apparatuses) {
    const entries = computeTop3WithPlaces(competitors, apparatus);
    if (entries.length === 0) { continue; }

    checkPageBreak(state, ROW_HEIGHT * entries.length);

    for (let i = 0; i < entries.length; i++) {
      const { competitor, place, tied } = entries[i];
      doc.setFontSize(BODY_FONT_SIZE);
      doc.text(i === 0 ? capitalise(apparatus) : "", DIV_APPARATUS_COL, state.y);
      doc.text(ordinal(place) + (tied ? "=" : ""), DIV_PLACE_COL, state.y);
      doc.text(competitor.competitorName, DIV_NAME_COL, state.y);
      doc.text(formatScore(competitor.scores[apparatus].finalScore), DIV_SCORE_COL, state.y);
      doc.text(competitor.clubName, DIV_CLUB_COL, state.y);
      state.y += ROW_HEIGHT;
    }
  }

  const overallEntries = computeTop3OverallWithPlaces(competitors, apparatuses);
  if (overallEntries.length > 0) {
    checkPageBreak(state, ROW_HEIGHT * overallEntries.length);

    for (let i = 0; i < overallEntries.length; i++) {
      const { competitor, total, place, tied } = overallEntries[i];
      doc.setFontSize(BODY_FONT_SIZE);
      doc.text(i === 0 ? "Overall" : "", DIV_APPARATUS_COL, state.y);
      doc.text(ordinal(place) + (tied ? "=" : ""), DIV_PLACE_COL, state.y);
      doc.text(competitor.competitorName, DIV_NAME_COL, state.y);
      doc.text(formatScore(total), DIV_SCORE_COL, state.y);
      doc.text(competitor.clubName, DIV_CLUB_COL, state.y);
      state.y += ROW_HEIGHT;
    }
  }
}
