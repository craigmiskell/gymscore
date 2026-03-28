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
import { Division, hasDivisions } from "../../common/data/division";
import { Apparatus, APPARATUSES } from "../../common/apparatus";

export { Apparatus } from "../../common/apparatus";

export const PAGE_WIDTH = 297;   // landscape A4
export const PAGE_HEIGHT = 210;  // landscape A4
export const MARGIN = 10;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
export const BOTTOM_MARGIN = 15;
export const ROW_HEIGHT = 6;
export const HEADING_FONT_SIZE = 10;
export const BODY_FONT_SIZE = 9;

export function enabledApparatuses(competition: CompetitionData): Apparatus[] {
  return APPARATUSES.filter((ap) => competition[ap]);
}

import { capitalise, formatScore } from "../../common/formatting";
export { capitalise, formatScore };

export function ordinal(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 13) { return `${n}th`; }
  if (mod10 === 1) { return `${n}st`; }
  if (mod10 === 2) { return `${n}nd`; }
  if (mod10 === 3) { return `${n}rd`; }
  return `${n}th`;
}

// Sum of the top 3 (or fewer) competitor scores for a team at a given apparatus.
export function teamApparatusScore(
  competitors: CompetitionCompetitorDetails[],
  teamIndex: number,
  apparatus: string
): number | null {
  const top3 = competitors
    .filter((c) => c.teamIndex === teamIndex && c.scores[apparatus] !== undefined)
    .sort((a, b) => b.scores[apparatus].finalScore - a.scores[apparatus].finalScore)
    .slice(0, 3);
  if (top3.length === 0) { return null; }
  return top3.reduce((sum, c) => sum + c.scores[apparatus].finalScore, 0);
}

export interface DivisionSegment {
  label: string;
  competitors: CompetitionCompetitorDetails[];
}

// Splits competitors into labelled segments by division (Overs/Unders) when the step has
// divisions, or returns a single "Competitors" segment otherwise. Segments with no members
// are omitted. Pass undersFirst=true to put Unders before Overs (used by announcements).
export function divisionSegments(
  competitors: CompetitionCompetitorDetails[],
  step: string,
  undersFirst = false
): DivisionSegment[] {
  if (hasDivisions(parseInt(step, 10))) {
    const overs: DivisionSegment = { label: "Overs",
      competitors: competitors.filter((c) => c.division === Division.Over) };
    const unders: DivisionSegment = { label: "Unders",
      competitors: competitors.filter((c) => c.division === Division.Under) };
    return (undersFirst ? [unders, overs] : [overs, unders]).filter((s) => s.competitors.length > 0);
  }
  return competitors.length > 0 ? [{ label: "Competitors", competitors }] : [];
}

export function apparatusLabel(apparatus: string): string {
  return apparatus === "bar" ? "U Bars" : capitalise(apparatus);
}

export interface PageState {
  doc: jsPDF;
  competition: CompetitionData;
  step: string;
  y: number;
}

export function checkPageBreak(state: PageState, neededHeight: number, continuationLabel = "") {
  if (state.y + neededHeight > PAGE_HEIGHT - BOTTOM_MARGIN) {
    state.doc.addPage("a4", "landscape");
    state.doc.setFont("helvetica", "normal");
    state.doc.setFontSize(8);
    const label = continuationLabel ? ` ${continuationLabel}` : "";
    state.doc.text(
      `${state.competition.name} \u2014 WAG Step ${state.step}${label} (continued)`,
      MARGIN, MARGIN + 4
    );
    state.y = MARGIN + 10;
  }
}

// Ranks a list of competitors by score (descending). Competitors for whom getScore returns
// undefined are excluded. Ties share the same place number and are flagged.
export function rankByScore(
  competitors: CompetitionCompetitorDetails[],
  getScore: (c: CompetitionCompetitorDetails) => number | undefined
): Map<number, { place: number; tied: boolean }> {
  const withScore = competitors
    .filter((c) => getScore(c) !== undefined)
    .sort((a, b) => (getScore(b) ?? 0) - (getScore(a) ?? 0));

  const result = new Map<number, { place: number; tied: boolean }>();
  for (let i = 0; i < withScore.length; i++) {
    const isTie = i > 0 && getScore(withScore[i]) === getScore(withScore[i - 1]);
    const place = isTie ? (result.get(withScore[i - 1].competitorId)?.place ?? i + 1) : i + 1;
    result.set(withScore[i].competitorId, { place, tied: false });
  }
  for (const [id, entry] of result) {
    if ([...result.values()].filter((e) => e.place === entry.place).length > 1) {
      result.set(id, { ...entry, tied: true });
    }
  }
  return result;
}

export function computeTeamTotals(
  teamIndices: number[],
  competitors: CompetitionCompetitorDetails[],
  apparatuses: string[]
): Array<{ teamIndex: number; total: number; hasScore: boolean }> {
  return teamIndices.map((teamIndex) => {
    const total = apparatuses.reduce((sum, ap) => {
      const score = teamApparatusScore(competitors, teamIndex, ap);
      return score !== null ? sum + score : sum;
    }, 0);
    const hasScore = apparatuses.some((ap) => teamApparatusScore(competitors, teamIndex, ap) !== null);
    return { teamIndex, total, hasScore };
  });
}

// Adds a new landscape A4 page with the standard competition/step title header.
// Returns the y position after the header, ready for content.
export function addStepTitlePage(doc: jsPDF, competition: CompetitionData, step: string): number {
  doc.addPage("a4", "landscape");
  let y = MARGIN + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(competition.name, PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(13);
  doc.text("WAG Step " + step, PAGE_WIDTH / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 3;
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;
  return y;
}
