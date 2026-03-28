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

import { CompetitionData, Team} from "../../common/data";
import { Division, hasDivisions } from "../../common/data";
import { jsPDF } from "jspdf";
import { CompetitionCompetitorDetails } from "../../common/data/competition";
import { getCompetitorsByGroup, getCompetitorsByStep } from "../../common/competitors_by";
import { PAGE_WIDTH } from "./common";

export function generateProgramme(competition: CompetitionData) {
  const doc = new jsPDF({
    orientation: "landscape",
  });

  // Delete the default first page, so we don't have to contort ourselves to detect
  // if/when we need to add that first page.
  doc.deletePage(1);

  // TODO: How do we handle 'byes' for unusual numbers of groups?
  const stepCompetitors = getCompetitorsByStep(competition.competitors);
  // Sort them; conveniently the string-form is intuitively sortable by default.
  const sortedSteps = Array.from(Object.keys(stepCompetitors)).sort();

  for (const step of sortedSteps) {
    addSheetForStep(doc, competition.teams, stepCompetitors[step], step);
  }
  return doc;
}

const columnOffsets = {
  name: 0,
  num: 30,
  div: 43,
  club: 53,
  team: 79,
};
function addGroupTitles(doc: jsPDF, xOffset: number, y: number, showDiv: boolean) {
  doc.text("Name", xOffset,                      y, {align: "left"});
  doc.text("Num",  xOffset + columnOffsets.num,  y, {align: "left"});
  if (showDiv) {
    doc.text("Div",  xOffset + columnOffsets.div,  y, {align: "left"});
  }
  doc.text("Club", xOffset + columnOffsets.club, y, {align: "left"});
  doc.text("Team", xOffset + columnOffsets.team, y, {align: "left"});

  doc.line(xOffset, y + 2, xOffset + 90, y + 2);

}
function addSheetForStep(doc: jsPDF, teams: Team[], competitors: CompetitionCompetitorDetails[], step: string) {
  doc.addPage("a4", "landscape");
  doc.setFontSize(12);

  const margin = 5;
  let y = 15; // Allow a margin for the printer to be unable to print on

  doc.text("WAG Step " + step, 10, y, {align: "left"});
  y += 2;
  doc.line(margin, y, PAGE_WIDTH - margin, y);
  y += 10;

  doc.setFontSize(10);
  const lineHeight = doc.getTextDimensions("x").h * doc.getLineHeightFactor();
  const showDiv = hasDivisions(parseInt(step));
  addGroupTitles(doc, 10, y, showDiv);
  addGroupTitles(doc, 155, y, showDiv);

  y += lineHeight * 1.5;

  const disciplines = ["Vault", "Bars", "Beam", "Floor"];
  const groupCompetitors = getCompetitorsByGroup(competitors);
  const groupHeights = [0, 0];
  const sortedGroups = Object.keys(groupCompetitors).sort().filter(g => g !== "0");

  for (let i = 0; i < sortedGroups.length; i++) {
    const groupIndex = parseInt(sortedGroups[i]);
    const column = i % 2; // 0 = left column, 1 = right column
    const h = addTableForGroup(
      doc, disciplines, teams, groupCompetitors[sortedGroups[i]], groupIndex, column, y, showDiv
    );
    groupHeights[column] = h;

    if (column == 1) {
      // Just did the right hand side; find the max height of the current 'row' and move down that far
      y += Math.max(groupHeights[0], groupHeights[1]);
    }
    disciplines.push(disciplines.shift()); // Rotate disciplines; first becomes last.
  }
}

function addTableForGroup(
  doc: jsPDF,
  disciplines: string[],
  teams: Team[],
  competitors: CompetitionCompetitorDetails[],
  groupIndex: number,
  column: number,
  startY: number,
  showDiv: boolean): number {

  doc.setFontSize(8); // Not as small as you might expect
  const origFont = doc.getFont();
  const lineHeight = doc.getTextDimensions("x").h * doc.getLineHeightFactor();
  const xOffset = (column == 0) ? 10 : 155;
  let y = startY;

  const groupTitle = "Group " + groupIndex + ": (" + disciplines.join(",") + ")";
  doc.setFont(origFont.fontName, "bold");
  doc.text(groupTitle, xOffset, y);
  doc.setFont(origFont.fontName, "normal");
  y += lineHeight*1.5;

  //TODO: maxWidth option?
  for (const competitor of competitors) {
    doc.text(competitor.competitorName, columnOffsets.name + xOffset, y);
    doc.text(competitor.competitorIdentifier, columnOffsets.num + xOffset, y);
    if (showDiv) {
      doc.text(Division[competitor.division], columnOffsets.div + xOffset, y);
    }
    doc.text(competitor.clubName, columnOffsets.club + xOffset, y);
    doc.text(teams[competitor.teamIndex]?.name ?? "", columnOffsets.team + xOffset, y);
    y += lineHeight;
  }
  y += lineHeight * 2; // Spacing between groups
  return y - startY;
}
