import { jsPDF } from "jspdf";
import fs from "fs";
import {shell} from "electron";

export function savePDF(pdfDocument: jsPDF, directory: string, filename: string) {
  // The jsPDF "save" function either doesn't work (but swallows the error) or drops the
  // file somewhere I couldn't find.  Rather, we turn it into a byte array and write it
  // to a location of our careful choosing.
  const buffer = pdfDocument.output("arraybuffer");

  fs.writeFile(filename, Buffer.from(buffer), (error: any) => {
    if (error) {
      throw error;
    }
    // Let the system open and then user can print using native funcionality (which will work
    // much better than the spectacularly shite printing support in Electron)
    shell.openPath(filename);
  });
}
