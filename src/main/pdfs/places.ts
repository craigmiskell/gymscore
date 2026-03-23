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
import { Competition } from "../../common/data/competition";

// TODO: implement Places PDF generation
export function generatePlaces(_competition: Competition): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.deletePage(1);
  doc.addPage("a4", "landscape");
  doc.setFontSize(14);
  doc.text("Places — not yet implemented", 10, 20);
  return doc;
}
