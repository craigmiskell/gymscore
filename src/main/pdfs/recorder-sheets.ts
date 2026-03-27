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
import { getCompetitorsByGroup, getCompetitorsByStep } from "../../common/competitors_by";

const PAGE_WIDTH_LANDSCAPE=297;

interface Titles {
  competitionSlug: string,
  step: string,
  apparatus: string,
  group: string,
}

interface ColDef {
  key: string;
  header: string;
  subtext?: string;
  width: number;
}

export function generateRecorderSheets(competition: Competition) {
  const doc = new jsPDF({
    orientation: "landscape",
  });

  //console.log(doc.getFontList());
  // helvetica: [ 'normal', 'bold', 'italic', 'bolditalic' ],
  // Helvetica: [ '', 'Bold', 'Oblique', 'BoldOblique' ],
  // courier: [ 'normal', 'bold', 'italic', 'bolditalic' ],
  // Courier: [ '', 'Bold', 'Oblique', 'BoldOblique' ],
  // times: [ 'normal', 'bold', 'italic', 'bolditalic' ],
  // Times: [ 'Roman', 'Bold', 'Italic', 'BoldItalic' ],
  // zapfdingbats: [ 'normal' ],
  // ZapfDingbats: [ '' ],
  // symbol: [ 'normal' ],
  // Symbol: [ '' ]

  // Just nerf the default first page, so we don't have to contort ourselves to detect
  // if/when we need to add that first page.
  doc.deletePage(1);

  const titles: Titles = {
    competitionSlug: "", apparatus: "", group: "", step: ""
  };
  titles.competitionSlug = competitionSlug(competition);

  // For each apparatus and step combination that exists, produce a recording sheet
  if (competition.vault) {
    addSheetsForApparatus(doc, titles, competition.competitors, "Vault");
  }
  if (competition.bar) {
    addSheetsForApparatus(doc, titles, competition.competitors, "Bar");
  }
  if (competition.beam) {
    addSheetsForApparatus(doc, titles, competition.competitors, "Beam");
  }
  if (competition.floor) {
    addSheetsForApparatus(doc, titles, competition.competitors, "Floor");
  }
  return doc;
}

function addSheetsForApparatus(doc: jsPDF, titles: Titles,
  competitors: CompetitionCompetitorDetails[], apparatus: string) {

  titles.apparatus = apparatus;

  const stepCompetitors = getCompetitorsByStep(competitors);

  const sortedSteps = Array.from(Object.keys(stepCompetitors)).sort();

  for (const step of sortedSteps) {
    addSheetsForStep(doc, titles, stepCompetitors[step], step);
  }
}

function addSheetsForStep(doc: jsPDF, titles: Titles, competitors: CompetitionCompetitorDetails[], step: string) {
  const groupCompetitors = getCompetitorsByGroup(competitors);

  titles.step = step;

  for (const group of Object.keys(groupCompetitors).sort().filter(g => g !== "0")) {
    titles.group = group;
    addSheetsForStepGroup(doc, titles, groupCompetitors[group]);
  }
}

function addSheetsForStepGroup(doc: jsPDF, titles: Titles, competitors: CompetitionCompetitorDetails[]) {
  doc.addPage("a4", "landscape");
  doc.setFontSize(14);
  // 1.5 times because there just needs to be more space (including for writing)
  const lineHeight = doc.getTextDimensions("x").h * doc.getLineHeightFactor() * 1.5;

  function lineY(line: number) {
    return 10 + lineHeight * line;
  }

  doc.text(titles.competitionSlug, 10, lineY(0), {align: "left"});
  doc.text("WAG Step " + titles.step, 10, lineY(1), {align: "left"});
  doc.text("Apparatus: " + titles.apparatus, PAGE_WIDTH_LANDSCAPE - 10, lineY(1), {align: "right"});
  doc.text("Group " + titles.group, 10, lineY(2), {align: "left"});
  doc.text("Head Judge _________________________", PAGE_WIDTH_LANDSCAPE - 10, lineY(2), {align: "right"});
  doc.text("Judge 1 _________________________", PAGE_WIDTH_LANDSCAPE - 10, lineY(3), {align: "right"});
  doc.text("Judge 2 _________________________", PAGE_WIDTH_LANDSCAPE - 10, lineY(4), {align: "right"});
  doc.text("Judge 3 _________________________", PAGE_WIDTH_LANDSCAPE - 10, lineY(5), {align: "right"});

  const margin = 10;
  const tableTop = lineY(6);
  const mainFontSize = 9;
  const subtextFontSize = 6;
  const cellPad = 1.5;

  // Columns: total width 257mm, fits within 277mm usable (297 - 2*10 margins)
  const columns: ColDef[] = [
    { key: "competitor", header: "Name", width: 60 },
    { key: "e1", header: "Dedn 1", width: 16 },
    { key: "e2", header: "Dedn 2", width: 16 },
    { key: "e3", header: "Dedn 3", width: 16 },
    { key: "e4", header: "Dedn 4", width: 16 },
    { key: "average", header: "Average Dedn", width: 24 },
    { key: "escore", header: "E Score", subtext: "=10-dedn", width: 24 },
    { key: "dscore", header: "D Score", width: 22 },
    { key: "total", header: "Total", subtext: "=E+D", width: 18 },
    { key: "neutralDeductions", header: "Neutral Dedn", width: 24 },
    { key: "finalScore", header: "Score", subtext: "=Tot-neut", width: 21 },
  ];

  // Measure text heights at each font size
  doc.setFontSize(mainFontSize);
  doc.setFont("helvetica", "bold");
  const mainH = doc.getTextDimensions("Ag").h;
  const mainLineSpacing = mainH * doc.getLineHeightFactor();

  doc.setFontSize(subtextFontSize);
  const subH = doc.getTextDimensions("Ag").h;

  // Header: top pad + 2 main lines (some headers wrap) + subtext line + bottom pad
  const headerHeight = cellPad + 2 * mainLineSpacing + subH + cellPad;
  // Data row: top pad + 2 lines (name + id/club detail) + bottom pad
  const dataRowHeight = cellPad + 2 * mainLineSpacing + cellPad;

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  // Draw header row background
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, tableTop, totalWidth, headerHeight, "FD");

  // Draw header cells
  let x = margin;
  for (const col of columns) {
    const cellCenterX = x + col.width / 2;

    // Main header text (bold, wrapped to column width)
    doc.setFontSize(mainFontSize);
    doc.setFont("helvetica", "bold");
    const headerLines = doc.splitTextToSize(col.header, col.width - 2 * cellPad);
    const firstLineY = tableTop + cellPad + mainH;
    doc.text(headerLines, cellCenterX, firstLineY, { align: "center" });

    // Subtext in smaller font, pinned to bottom of header cell
    if (col.subtext) {
      doc.setFontSize(subtextFontSize);
      doc.setFont("helvetica", "normal");
      const subtextY = tableTop + headerHeight - cellPad;
      doc.text(col.subtext, cellCenterX, subtextY, { align: "center" });
    }

    doc.rect(x, tableTop, col.width, headerHeight);
    x += col.width;
  }

  // Draw data rows
  let rowTop = tableTop + headerHeight;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(mainFontSize);

  for (const competitor of competitors) {
    x = margin;
    const nameY = rowTop + cellPad + mainH;
    const detailY = nameY + mainLineSpacing;

    for (const col of columns) {
      doc.rect(x, rowTop, col.width, dataRowHeight);

      if (col.key === "competitor") {
        const nameLines = doc.splitTextToSize(competitor.competitorName, col.width - 2 * cellPad);
        doc.text(nameLines[0], x + cellPad, nameY);
        doc.text(`(${competitor.competitorIdentifier} ${competitor.clubName})`, x + cellPad, detailY);
      }

      x += col.width;
    }

    rowTop += dataRowHeight;
  }
}

function competitionSlug(competition: Competition) {
  return competition.name +" - " + competition.location + " - " + competition.date;
}
