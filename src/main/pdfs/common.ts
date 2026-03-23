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

export const PAGE_WIDTH = 297;   // landscape A4
export const PAGE_HEIGHT = 210;  // landscape A4
export const MARGIN = 10;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
export const BOTTOM_MARGIN = 15;
export const ROW_HEIGHT = 6;
export const HEADING_FONT_SIZE = 10;
export const BODY_FONT_SIZE = 9;

export function enabledApparatuses(competition: Competition): string[] {
  const result: string[] = [];
  if (competition.vault) { result.push("vault"); }
  if (competition.bar) { result.push("bar"); }
  if (competition.beam) { result.push("beam"); }
  if (competition.floor) { result.push("floor"); }
  return result;
}

export function formatScore(score: number): string {
  return (Math.floor(score) / 1000).toFixed(3);
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

// Adds a new landscape A4 page with the standard competition/step title header.
// Returns the y position after the header, ready for content.
export function addStepTitlePage(doc: jsPDF, competition: Competition, step: string): number {
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
