import { jsPDF } from "jspdf";
import fs from "fs";
import os from "os";
import path from "path";
import {shell} from "electron";
import { Competition } from "../renderer/data";

// The jsPDF "save" function either doesn't work (but swallows the error) or drops the
// file somewhere I couldn't find.  Rather, we turn it into a byte array and write it
// to a location of our careful choosing.
export function savePDF(competition: Competition, pdfDocument: jsPDF, basename: string) {
  const buffer = pdfDocument.output("arraybuffer");

  const competitionSlug = competition.name.replace(/([^a-zA-Z0-1])+/g, "-") + " - " + competition.date;
  const dirPath = path.join(os.homedir(), "GymScore", competitionSlug);
  fs.mkdirSync(dirPath, { recursive: true});
  const filename = path.join(dirPath, basename + ".pdf");

  fs.writeFile(filename, Buffer.from(buffer), (error: any) => {
    if (error) {
      throw error;
    }
    // Let the system open and then user can print using native funcionality (which will work
    // much better than the spectacularly shite printing support in Electron)
    shell.openPath(filename);
  });
}
