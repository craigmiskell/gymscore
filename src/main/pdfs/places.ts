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
import { Competition, CompetitionCompetitorDetails } from "../../common/data/competition";
import { Division } from "../../common/data/division";
import { getCompetitorsByStep } from "../../common/competitors_by";
import {
  PAGE_WIDTH, PAGE_HEIGHT, MARGIN, BOTTOM_MARGIN, ROW_HEIGHT, HEADING_FONT_SIZE, BODY_FONT_SIZE,
  enabledApparatuses, formatScore, capitalise, ordinal, teamApparatusScore, addStepTitlePage,
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

interface PageState {
  doc: jsPDF;
  competition: Competition;
  step: string;
  y: number;
}

export function generatePlaces(competition: Competition): jsPDF {
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

function checkPageBreak(state: PageState, neededHeight: number) {
  if (state.y + neededHeight > PAGE_HEIGHT - BOTTOM_MARGIN) {
    state.doc.addPage("a4", "landscape");
    state.doc.setFont("helvetica", "normal");
    state.doc.setFontSize(8);
    state.doc.text(`${state.competition.name} \u2014 WAG Step ${state.step} (continued)`, MARGIN, MARGIN + 4);
    state.y = MARGIN + 10;
  }
}

function addStepPlaces(
  doc: jsPDF,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  const state: PageState = { doc, competition, step, y: addStepTitlePage(doc, competition, step) };

  addTeamPlaces(state, competition, apparatuses, competitors);

  const overs = competitors.filter((c) => c.division === Division.Over);
  const unders = competitors.filter((c) => c.division === Division.Under);

  if (overs.length > 0) {
    state.y += 8;
    addDivisionPlaces(state, "Overs", apparatuses, overs);
  }
  if (unders.length > 0) {
    state.y += 8;
    addDivisionPlaces(state, "Unders", apparatuses, unders);
  }
}

function addTeamPlaces(
  state: PageState,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[]
) {
  const doc = state.doc;

  const teamIndices = Array.from(new Set(
    competitors.map((c) => c.teamIndex).filter((i): i is number => i !== null)
  ));
  const teamTotals = teamIndices
    .map((teamIndex) => {
      const total = apparatuses.reduce((sum, ap) => {
        const score = teamApparatusScore(competitors, teamIndex, ap);
        return score !== null ? sum + score : sum;
      }, 0);
      const hasScore = apparatuses.some((ap) => teamApparatusScore(competitors, teamIndex, ap) !== null);
      return { teamIndex, total, hasScore };
    })
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
  const sorted = [...competitors]
    .filter((c) => c.scores[apparatus] !== undefined)
    .sort((a, b) => b.scores[apparatus].finalScore - a.scores[apparatus].finalScore)
    .slice(0, 3);

  const entries: PlaceEntry[] = [];
  let place = 1;
  for (let i = 0; i < sorted.length; i++) {
    const isTie = i > 0 && sorted[i].scores[apparatus].finalScore === sorted[i - 1].scores[apparatus].finalScore;
    if (!isTie) { place = i + 1; }
    entries.push({ competitor: sorted[i], place, tied: false });
  }
  // Mark ties: any place shared by more than one entry
  for (const entry of entries) {
    if (entries.filter((e) => e.place === entry.place).length > 1) {
      entry.tied = true;
    }
  }
  return entries;
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
  const withTotals = competitors
    .map((c) => ({
      competitor: c,
      total: apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0),
      hasScore: apparatuses.some((ap) => c.scores[ap] !== undefined),
    }))
    .filter((e) => e.hasScore)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const entries: OverallPlaceEntry[] = [];
  let place = 1;
  for (let i = 0; i < withTotals.length; i++) {
    const isTie = i > 0 && withTotals[i].total === withTotals[i - 1].total;
    if (!isTie) { place = i + 1; }
    entries.push({ competitor: withTotals[i].competitor, total: withTotals[i].total, place, tied: false });
  }
  for (const entry of entries) {
    if (entries.filter((e) => e.place === entry.place).length > 1) {
      entry.tied = true;
    }
  }
  return entries;
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
