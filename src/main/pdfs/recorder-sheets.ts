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

import { Competition } from "../../renderer/data";
import { jsPDF, CellConfig } from "jspdf";
import { CompetitionCompetitorDetails } from "../../renderer/data/competition";
import { getCompetitorsByGroup, getCompetitorsByStep } from "./common";

const PAGE_WIDTH_LANDSCAPE=297;

interface Titles {
  competitionSlug: string,
  step: string,
  apparatus: string,
  group: string,
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

  for (const group of Object.keys(groupCompetitors).sort()) {
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

  const space = " ";
  const data = [];
  for (const competitor of competitors) {
    data.push({
      number: competitor.competitorIdentifier,
      name: competitor.competitorName,
      club: competitor.gymName,
      dscore: space, e1: space, e2: space, e3:space, e4:space,
      average: space, escore: space, neutralDeductions: space, finalScore: space
    });
  }

  const headers = new Array<CellConfig>();
  defineHeader(headers, "number", "#", 25);
  defineHeader(headers, "name", "Name", 50);
  defineHeader(headers, "club", "Club", 50);
  defineHeader(headers, "dscore", "D Score", 30);
  defineHeader(headers, "e1", "E1", 20);
  defineHeader(headers, "e2", "E2", 20);
  defineHeader(headers, "e3", "E3", 20);
  defineHeader(headers, "e4", "E4", 20);
  defineHeader(headers, "average", "Average\nDedn", 32);
  defineHeader(headers, "escore", "E Score", 30);
  defineHeader(headers, "neutralDeductions", "Neutral\nDeductions", 40);
  defineHeader(headers, "finalScore", "Final\nScore", 25);

  doc.table(
    10,
    lineY(6),
    data,
    headers,
    {}
  );
}

function defineHeader(headers: Array<CellConfig>, name: string, prompt: string, width: number) {
  headers.push({ name: name, prompt: prompt, align: "left", padding: 0, width: width });

}
function competitionSlug(competition: Competition) {
  return competition.name +" - " + competition.location + " - " + competition.date;
}
