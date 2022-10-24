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

import {IpcMainEvent, app, BrowserWindow, ipcMain, shell} from "electron";
import path from "path";
import isDev from "electron-is-dev";
import fs from "fs";
import mktemp from "mktemp";
import os from "os";
import Blob from "cross-blob"; // Used by jsPDF to save
// And this is necessary for jsPDF to find the Blob object (using Blob from buffer is insufficient)
globalThis.Blob = Blob;

import { Competition } from "../common/data";
import * as pdfs from "./pdfs";

import { savePDF } from "./pdfs/savePdf";

const createWindow = () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.maximize();
  win.show();

  win.loadFile("dist/renderer/index.html");
  // TODO: we'll add a menu again later when we have a need
  // win.setMenu(null);
  if(isDev) {
    win.webContents.openDevTools();
  }
};

app.whenReady().then(() => {
  createWindow();

  // Recommended boilerplate to recreate a window when activated
  // which gives the expected UX on OSX
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {createWindow();}
  });
});

// Recommended boiler-plate to quit the app when all windows are closed
// except for OSX (see on activate above)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {app.quit();}
});

ipcMain.on("asynchronous-message", (event: IpcMainEvent, arg: any) => {
  console.log(arg);
  event.reply("asynchronous-reply", "async pong");
});

// Old code, kept for reference only
ipcMain.on("save-png", (event: IpcMainEvent, arg: any) => {
  const buffer = Buffer.from(arg.data);

  const tempDir = mktemp.createDirSync(path.join(os.tmpdir(), "XXXXXXX"));
  const filename = path.join(tempDir, arg.filenameHint + ".png");
  // TODO: create a singular temp directory per competition, perhaps a second hint (dirhint?)
  fs.writeFile(filename, buffer, (error: any) => {
    if (error) {
      throw error;
    }
    // Let the system open and then user can print
    shell.openPath(filename);
  });
});

ipcMain.on("generate-pdfs", (event: IpcMainEvent, arg: any) => {
  const competition: Competition = arg.competition;
  switch(arg.type) {
  case "recorder-sheets":
    savePDF(competition, pdfs.generateRecorderSheets(competition), "recorder-sheets");
    break;
  case "programme":
    savePDF(competition, pdfs.generateProgramme(competition), "programme");
  }
});

console.log("Data storage may be in "+ app.getPath("userData"));
