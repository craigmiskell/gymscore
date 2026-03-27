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
import { enabledApparatuses, formatScore, ordinal, capitalise, teamApparatusScore } from "./common";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) { return date; }
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  if (isNaN(day) || isNaN(month) || month < 0 || month > 11) { return date; }
  return `${day} ${MONTH_NAMES[month]} ${year}`;
}

function apparatusLabel(apparatus: string): string {
  return apparatus === "bar" ? "U Bars" : capitalise(apparatus);
}

const UNDER_AGE: Record<number, number> = {
  1: 9,
  2: 10,
  3: 11,
  4: 12,
  5: 12,
  6: 13,
  7: 14,
  8: 15,
};

function stepDivisionLine(step: string, division: Division | null): string {
  const stepNum = parseInt(step, 10);
  if (division === Division.Under && stepNum < 9) {
    return `WAG Step ${step} Under ${UNDER_AGE[stepNum]}`;
  }
  return "WAG Step " + step;
}

// Compute placing and tie information for a set of competitors scored by getScore.
// Competitors for whom getScore returns undefined are excluded.
function computePlacings(
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
    const count = [...result.values()].filter((e) => e.place === entry.place).length;
    if (count > 1) {
      result.set(id, { ...entry, tied: true });
    }
  }
  return result;
}

const TOP_CERTIFICATES = 3;

const CERT_WIDTH = 297;   // landscape A4
const CERT_HEIGHT = 210;  // landscape A4
const MARGIN = 20;
const CENTER_X = CERT_WIDTH / 2;
const CONTENT_WIDTH = CERT_WIDTH - 2 * MARGIN;

export function generateCertificates(competition: Competition): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  doc.deletePage(1);

  const apparatuses = enabledApparatuses(competition);
  const stepCompetitors = getCompetitorsByStep(competition.competitors);
  const sortedSteps = Object.keys(stepCompetitors).sort((a, b) => parseInt(a) - parseInt(b));

  for (const step of sortedSteps) {
    addTeamCertificates(doc, competition, apparatuses, stepCompetitors[step], step);
    addIndividualCertificates(doc, competition, apparatuses, stepCompetitors[step], step);
  }

  return doc;
}

function addTeamCertificates(
  doc: jsPDF,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
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
    .sort((a, b) => b.total - a.total);

  if (teamTotals.length === 0) { return; }

  // Assign places, handling ties
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

  for (const { teamIndex, total, place: teamPlace, tied } of placedTeams.filter((t) => t.place <= TOP_CERTIFICATES)) {
    const team = competition.teams[teamIndex];
    if (!team) { continue; }

    const members = competitors
      .filter((c) => c.teamIndex === teamIndex)
      .map((c) => c.competitorName)
      .sort();

    addTeamCertificate(doc, competition, step, team.name, members, total, teamPlace, tied);
  }
}

function addIndividualCertificates(
  doc: jsPDF,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string
) {
  const stepNum = parseInt(step, 10);
  const hasDivisions = stepNum < 9;

  if (hasDivisions) {
    const unders = competitors.filter((c) => c.division === Division.Under);
    const overs = competitors.filter((c) => c.division === Division.Over);
    addDivisionIndividualCertificates(doc, competition, apparatuses, unders, step, Division.Under);
    addDivisionIndividualCertificates(doc, competition, apparatuses, overs, step, Division.Over);
  } else {
    addDivisionIndividualCertificates(doc, competition, apparatuses, competitors, step, null);
  }
}

interface ApparatusPlacing {
  apparatus: string;
  place: number;
  tied: boolean;
  score: number;
}

interface OverallPlacing {
  place: number;
  tied: boolean;
  score: number;
}

function addDivisionIndividualCertificates(
  doc: jsPDF,
  competition: Competition,
  apparatuses: string[],
  competitors: CompetitionCompetitorDetails[],
  step: string,
  division: Division | null
) {
  if (competitors.length === 0) { return; }

  const overallPlacings = computePlacings(
    competitors,
    (c) => apparatuses.some((ap) => c.scores[ap] !== undefined)
      ? apparatuses.reduce((sum, ap) => sum + (c.scores[ap]?.finalScore ?? 0), 0)
      : undefined
  );

  const apparatusPlacings = new Map<string, Map<number, { place: number; tied: boolean }>>();
  for (const ap of apparatuses) {
    apparatusPlacings.set(ap, computePlacings(competitors, (c) => c.scores[ap]?.finalScore));
  }

  // A competitor qualifies for a certificate if they place top X in any category
  const qualifying = competitors.filter((c) => {
    const overall = overallPlacings.get(c.competitorId);
    if (overall && overall.place <= TOP_CERTIFICATES) { return true; }
    return apparatuses.some((ap) => {
      const apPlacing = apparatusPlacings.get(ap)?.get(c.competitorId);
      return apPlacing && apPlacing.place <= TOP_CERTIFICATES;
    });
  });

  // Sort by overall placing, then alphabetically
  qualifying.sort((a, b) => {
    const aPlace = overallPlacings.get(a.competitorId)?.place ?? Infinity;
    const bPlace = overallPlacings.get(b.competitorId)?.place ?? Infinity;
    if (aPlace !== bPlace) { return aPlace - bPlace; }
    return a.competitorName.localeCompare(b.competitorName);
  });

  for (const competitor of qualifying) {
    const overallEntry = overallPlacings.get(competitor.competitorId);
    const overall: OverallPlacing | undefined = overallEntry && overallEntry.place <= TOP_CERTIFICATES
      ? {
        place: overallEntry.place,
        tied: overallEntry.tied,
        score: apparatuses.reduce((sum, ap) => sum + (competitor.scores[ap]?.finalScore ?? 0), 0),
      }
      : undefined;

    const apPlacings: ApparatusPlacing[] = [];
    for (const ap of apparatuses) {
      const apEntry = apparatusPlacings.get(ap)?.get(competitor.competitorId);
      if (apEntry && apEntry.place <= TOP_CERTIFICATES) {
        apPlacings.push({
          apparatus: ap,
          place: apEntry.place,
          tied: apEntry.tied,
          score: competitor.scores[ap].finalScore
        });
      }
    }

    addIndividualCertificate(
      doc, competition, step, division,
      competitor.competitorName, competitor.clubName,
      overall, apPlacings
    );
  }
}

function addTeamCertificate(
  doc: jsPDF,
  competition: Competition,
  step: string,
  teamName: string,
  members: string[],
  total: number,
  place: number,
  tied: boolean
) {
  doc.addPage("a4", "landscape");

  let y = MARGIN + 15;

  // Competition name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(competition.name, CENTER_X, y, { align: "center" });
  y += 12;

  // Divider
  doc.line(MARGIN, y, CERT_WIDTH - MARGIN, y);
  y += 12;

  // Team name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(teamName, CENTER_X, y, { align: "center" });
  y += 16;

  // Members
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const membersText = members.join(", ");
  const wrappedMembers: string[] = doc.splitTextToSize(membersText, CONTENT_WIDTH);
  doc.text(wrappedMembers, CENTER_X, y, { align: "center" });
  y += wrappedMembers.length * 7 + 16;

  // Placing
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const placingText = `${ordinal(place)}${tied ? "=" : ""} Team (${formatScore(total)})`;
  doc.text(placingText, CENTER_X, y, { align: "center" });
  y += 16;

  // Step
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("WAG Step " + step, CENTER_X, y, { align: "center" });
  y += 16;

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(formatDate(competition.date), CENTER_X, y, { align: "center" });

  // Signature line near bottom
  const sigLineY = CERT_HEIGHT - MARGIN - 20;
  const sigLineX1 = MARGIN + 30;
  const sigLineX2 = CERT_WIDTH - MARGIN - 30;
  doc.line(sigLineX1, sigLineY, sigLineX2, sigLineY);
}

function addIndividualCertificate(
  doc: jsPDF,
  competition: Competition,
  step: string,
  division: Division | null,
  name: string,
  club: string,
  overall: OverallPlacing | undefined,
  apPlacings: ApparatusPlacing[]
) {
  doc.addPage("a4", "landscape");

  let y = MARGIN + 15;

  // Competition name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(competition.name, CENTER_X, y, { align: "center" });
  y += 12;

  // Divider
  doc.line(MARGIN, y, CERT_WIDTH - MARGIN, y);
  y += 12;

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(name, CENTER_X, y, { align: "center" });
  y += 16;

  // Club
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(club, CENTER_X, y, { align: "center" });
  y += 14;

  // Placings
  doc.setFontSize(13);
  if (overall) {
    const overallText = `${ordinal(overall.place)}${overall.tied ? "=" : ""} Overall (${formatScore(overall.score)})`;
    doc.text(overallText, CENTER_X, y, { align: "center" });
    y += 10;
  }
  for (const ap of apPlacings) {
    // eslint-disable-next-line max-len
    const apText = `${ordinal(ap.place)}${ap.tied ? "=" : ""} ${apparatusLabel(ap.apparatus)} (${formatScore(ap.score)})`;
    doc.text(apText, CENTER_X, y, { align: "center" });
    y += 10;
  }
  y += 6;

  // Step/division line
  doc.setFontSize(13);
  doc.text(stepDivisionLine(step, division), CENTER_X, y, { align: "center" });
  y += 14;

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(formatDate(competition.date), CENTER_X, y, { align: "center" });

  // Signature line near bottom
  const sigLineY = CERT_HEIGHT - MARGIN - 20;
  const sigLineX1 = MARGIN + 30;
  const sigLineX2 = CERT_WIDTH - MARGIN - 30;
  doc.line(sigLineX1, sigLineY, sigLineX2, sigLineY);
}
