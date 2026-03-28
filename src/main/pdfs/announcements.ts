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
  enabledApparatuses, formatScore, ordinal, addStepTitlePage, divisionSegments,
  apparatusLabel, PageState, checkPageBreak, rankByScore, computeTeamTotals,
} from "./common";

const TOP_X = 3;

// Fixed apparatus display order for announcements (least dramatic to most dramatic).
// "bar" is displayed as "U Bars" per gymnastics convention.
const ANNOUNCEMENT_APPARATUS_ORDER = ["floor", "beam", "bar", "vault"];

// Competitor section column x-positions
const NAME_COL = MARGIN;
const NAME_WIDTH = 55;
const PLACINGS_COL = NAME_COL + NAME_WIDTH;
const PLACINGS_WIDTH = 160;
const CLUB_COL = PLACINGS_COL + PLACINGS_WIDTH;

// Team section column x-positions
const TEAM_PLACE_COL = MARGIN;
const TEAM_PLACE_WIDTH = 20;
const TEAM_NAME_COL = TEAM_PLACE_COL + TEAM_PLACE_WIDTH;
const TEAM_NAME_WIDTH = 70;
const TEAM_SCORE_COL = TEAM_NAME_COL + TEAM_NAME_WIDTH;
const TEAM_SCORE_WIDTH = 30;
const TEAM_MEMBERS_COL = TEAM_SCORE_COL + TEAM_SCORE_WIDTH;

interface PlacingInfo {
  label: string;
  place: number;
  tied: boolean;
  score: number;
}

interface AnnouncementRow {
  competitor: CompetitionCompetitorDetails;
  placings: PlacingInfo[];
}

export function generateAnnouncements(competition: CompetitionData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.deletePage(1);

  const apparatuses = enabledApparatuses(competition);
  const stepCompetitors = getCompetitorsByStep(competition.competitors);
  const sortedSteps = Object.keys(stepCompetitors).sort((a, b) => parseInt(a) - parseInt(b));

  for (const step of sortedSteps) {
    addStepAnnouncements(doc, competition, apparatuses, stepCompetitors[step], step);
  }

  return doc;
}

function addStepAnnouncements(
  doc: jsPDF,
  competition: CompetitionData,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  let y = addStepTitlePage(doc, competition, step);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text("Announcements", PAGE_WIDTH / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 8;

  const state: PageState = { doc, competition, step, y };

  for (const segment of divisionSegments(competitors, step, true)) {
    addDivisionAnnouncements(state, segment.label, apparatuses, segment.competitors);
    state.y += 8;
  }

  addTeamAnnouncements(state, competition, apparatuses, competitors);
}

function competitorOverallScore(competitor: CompetitionCompetitorDetails, apparatuses: string[]): number {
  return apparatuses.reduce((sum, ap) => sum + (competitor.scores[ap]?.finalScore ?? 0), 0);
}

// Build the ordered list of announcement rows for a division.
// Section 1: competitors with an overall placing <= TOP_X, from TOP_X down to 1.
// Section 2: remaining candidates, by apparatus in announcement order, from TOP_X down to 1.
// Within a given place, competitors are sorted alphabetically. Each competitor appears only once.
function buildDivisionRows(
  competitors: CompetitionCompetitorDetails[],
  apparatuses: string[]
): AnnouncementRow[] {
  const announcementApparatuses = ANNOUNCEMENT_APPARATUS_ORDER.filter((ap) => apparatuses.includes(ap));

  const overallPlacings = rankByScore(
    competitors,
    (c) => apparatuses.some((ap) => c.scores[ap] !== undefined)
      ? competitorOverallScore(c, apparatuses)
      : undefined
  );

  const apparatusPlacings = new Map<string, Map<number, { place: number; tied: boolean }>>();
  for (const ap of announcementApparatuses) {
    apparatusPlacings.set(ap, rankByScore(competitors, (c) => c.scores[ap]?.finalScore));
  }

  // Build candidate set: all competitors with a qualifying placing (<= TOP_X in any category).
  // Collect all their qualifying placings for display.
  const candidateMap = new Map<number, AnnouncementRow>();
  for (const competitor of competitors) {
    const placings: PlacingInfo[] = [];

    const op = overallPlacings.get(competitor.competitorId);
    if (op && op.place <= TOP_X) {
      placings.push({
        label: "Overall",
        place: op.place,
        tied: op.tied,
        score: competitorOverallScore(competitor, apparatuses),
      });
    }

    for (const ap of announcementApparatuses) {
      const apPlacing = apparatusPlacings.get(ap)?.get(competitor.competitorId);
      if (apPlacing && apPlacing.place <= TOP_X) {
        placings.push({
          label: apparatusLabel(ap),
          place: apPlacing.place,
          tied: apPlacing.tied,
          score: competitor.scores[ap].finalScore,
        });
      }
    }

    if (placings.length > 0) {
      candidateMap.set(competitor.competitorId, { competitor, placings });
    }
  }

  const rows: AnnouncementRow[] = [];
  const emitted = new Set<number>();

  // Section 1: overall section, TOP_X down to 1
  for (let p = TOP_X; p >= 1; p--) {
    const atPlace = [...candidateMap.values()]
      .filter((row) => {
        const placing = overallPlacings.get(row.competitor.competitorId);
        return placing !== undefined && placing.place === p;
      })
      .sort((a, b) => a.competitor.competitorName.localeCompare(b.competitor.competitorName));

    for (const row of atPlace) {
      if (!emitted.has(row.competitor.competitorId)) {
        rows.push(row);
        emitted.add(row.competitor.competitorId);
      }
    }
  }

  // Section 2: apparatus sections, TOP_X down to 1, in announcement order
  for (const ap of announcementApparatuses) {
    const apMap = apparatusPlacings.get(ap);
    if (!apMap) { continue; }

    for (let p = TOP_X; p >= 1; p--) {
      const atPlace = [...candidateMap.values()]
        .filter((row) => {
          if (emitted.has(row.competitor.competitorId)) { return false; }
          const placing = apMap.get(row.competitor.competitorId);
          return placing !== undefined && placing.place === p;
        })
        .sort((a, b) => a.competitor.competitorName.localeCompare(b.competitor.competitorName));

      for (const row of atPlace) {
        rows.push(row);
        emitted.add(row.competitor.competitorId);
      }
    }
  }

  return rows;
}

function formatPlacings(placings: PlacingInfo[]): string {
  return placings
    .map((p) => `${ordinal(p.place)}${p.tied ? "=" : ""} ${p.label} (${formatScore(p.score)})`)
    .join("; ");
}

function addDivisionAnnouncements(
  state: PageState,
  divisionTitle: string,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[]
) {
  const doc = state.doc;

  checkPageBreak(state, ROW_HEIGHT * 3, "Announcements");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text(divisionTitle, MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Name", NAME_COL, state.y);
  doc.text("Placings", PLACINGS_COL, state.y);
  doc.text("Club", CLUB_COL, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  const rows = buildDivisionRows(competitors, apparatuses);

  for (const row of rows) {
    doc.setFontSize(BODY_FONT_SIZE);
    const placingsText = formatPlacings(row.placings);
    const lines: string[] = doc.splitTextToSize(placingsText, PLACINGS_WIDTH);
    const rowHeight = ROW_HEIGHT * Math.max(1, lines.length);

    checkPageBreak(state, rowHeight, "Announcements");
    doc.text(row.competitor.competitorName, NAME_COL, state.y);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], PLACINGS_COL, state.y + i * ROW_HEIGHT);
    }
    doc.text(row.competitor.clubName, CLUB_COL, state.y);
    state.y += rowHeight;
  }
}

function addTeamAnnouncements(
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
    .slice(0, TOP_X);

  if (teamTotals.length === 0) { return; }

  const placedTeams: Array<{ teamIndex: number; total: number; place: number; tied: boolean }> = [];
  let place = 1;
  for (let i = 0; i < teamTotals.length; i++) {
    const isTie = i > 0 && teamTotals[i].total === teamTotals[i - 1].total;
    if (!isTie) { place = i + 1; }
    placedTeams.push({ ...teamTotals[i], place, tied: false });
  }
  for (const team of placedTeams) {
    team.tied = placedTeams.filter((t) => t.place === team.place).length > 1;
  }

  doc.addPage("a4", "landscape");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${state.competition.name} \u2014 WAG Step ${state.step} Announcements (continued)`,
    MARGIN, MARGIN + 4
  );
  state.y = MARGIN + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADING_FONT_SIZE);
  doc.text("Teams", MARGIN, state.y);
  state.y += ROW_HEIGHT;

  doc.text("Place", TEAM_PLACE_COL, state.y);
  doc.text("Team", TEAM_NAME_COL, state.y);
  doc.text("Score", TEAM_SCORE_COL, state.y);
  doc.text("Members", TEAM_MEMBERS_COL, state.y);
  doc.setFont("helvetica", "normal");
  state.y += 1;
  doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += ROW_HEIGHT;

  // Output from TOP_X down to 1
  for (let p = TOP_X; p >= 1; p--) {
    for (const { teamIndex, total, tied } of placedTeams.filter((t) => t.place === p)) {
      const team = competition.teams[teamIndex];
      if (!team) { continue; }

      const members = competitors
        .filter((c) => c.teamIndex === teamIndex)
        .map((c) => c.competitorName)
        .join(", ");

      checkPageBreak(state, ROW_HEIGHT, "Announcements");
      doc.setFontSize(BODY_FONT_SIZE);
      doc.text(`${ordinal(p)}${tied ? "=" : ""}`, TEAM_PLACE_COL, state.y);
      doc.text(team.name, TEAM_NAME_COL, state.y);
      doc.text(formatScore(total), TEAM_SCORE_COL, state.y);
      doc.text(members, TEAM_MEMBERS_COL, state.y);
      state.y += ROW_HEIGHT;
    }
  }
}
