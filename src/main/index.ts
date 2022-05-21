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

import {IpcMainEvent} from 'electron';

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const fs = require("fs");
const mktemp = require("mktemp");
const os = require("os");

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
  console.log("Hello from src/main/index.js");
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

ipcMain.on("synchronous-message", (event: IpcMainEvent, arg: any) => {
  console.log(arg);
  event.returnValue = "sync pong";
});

ipcMain.on("save-png", (event: IpcMainEvent, arg: any) => {

  let buffer = Buffer.from(arg.data);

  let tempDir = mktemp.createDirSync(path.join(os.tmpdir(), "XXXXXXX"));
  let filename = path.join(tempDir, arg.filenameHint + ".png");
  // TODO: create a singular temp directory per competition, perhaps a second hint (dirhint?)
  fs.writeFile(filename, buffer, (error: any) => {
    if (error) {
      throw error;
    }
    // Let the system open and then user can print
    shell.openPath(filename);
  });
});
