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

// See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-exports
// for the reason for 'import type' (interfaces are weird)

import { jsPDF } from "jspdf";
import fs from "fs";
import os from "os";
import path from "path";
import {shell} from "electron";
import { CompetitionData } from "../../common/data";
import { Logger } from "../logger";

// The jsPDF "save" function either doesn't work (but swallows the error) or drops the
// file somewhere I couldn't find.  Rather, we turn it into a byte array and write it
// to a location of our careful choosing.
export function savePDF(competition: CompetitionData, pdfDocument: jsPDF, basename: string, logger?: Logger) {
  const buffer = pdfDocument.output("arraybuffer");

  const competitionSlug = competition.name.replace(/([^a-zA-Z0-1])+/g, "-") + " - " + competition.date;
  const dirPath = path.join(os.homedir(), "GymScore", competitionSlug);
  logger?.debug("Creating PDF output directory", { dirPath });
  fs.mkdirSync(dirPath, { recursive: true});
  const filename = path.join(dirPath, basename + ".pdf");

  logger?.info("Writing PDF file", { filename, sizeBytes: buffer.byteLength });
  fs.writeFile(filename, Buffer.from(buffer), (error: any) => {
    if (error) {
      logger?.error("Failed to write PDF file", { filename, error: String(error) });
      throw error;
    }
    logger?.info("PDF file written and opening", { filename });
    // Let the system open and then user can print using native funcionality (which will work
    // much better than the spectacularly shite printing support in Electron)
    shell.openPath(filename);
  });
}
