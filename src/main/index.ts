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

import {IpcMainEvent, Menu, MenuItemConstructorOptions, app, BrowserWindow, ipcMain, dialog, shell} from "electron";
import path from "path";
import isDev from "electron-is-dev";
import fs from "fs";
import zlib from "zlib";
import strftime from "strftime";
import Blob from "cross-blob"; // Used by jsPDF to save
// And this is necessary for jsPDF to find the Blob object (using Blob from buffer is insufficient)
globalThis.Blob = Blob;

import { CompetitionData } from "../common/data/competition";
import * as pdfs from "./pdfs";
import { Logger } from "./logger";

import { savePDF } from "./pdfs/savePdf";

if (isDev) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("electron-reload")(path.join(__dirname, ".."), {
    electron: process.execPath,
    hardResetMethod: "exit",
  });
}

const createHelpWindow = () => {
  const userGuidePath = path.join(app.getAppPath(), "dist/renderer/user-guide.html");
  if (!fs.existsSync(userGuidePath)) {
    dialog.showMessageBox({
      type: "info",
      title: "User Guide Not Available",
      message: "The user guide has not been built yet.\n\nRun: npm run build-docs",
    });
    return;
  }
  const helpWin = new BrowserWindow({
    width: 900,
    height: 700,
    title: "GymScore User Guide",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  helpWin.setMenu(null);
  helpWin.loadFile(userGuidePath);
};

const buildAppMenu = (): Menu => {
  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: "zoomIn" },
    { role: "zoomOut" },
    { role: "resetZoom" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];
  if (isDev) {
    viewSubmenu.push({ type: "separator" }, { role: "reload" }, { role: "toggleDevTools" });
  }
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    { label: "View", submenu: viewSubmenu },
    {
      role: "help",
      submenu: [{ label: "User Guide", click: createHelpWindow }],
    },
  ];
  return Menu.buildFromTemplate(template);
};

const createWindow = () => {
  logger.info("Creating main browser window");
  const win = new BrowserWindow({
    show: false,
    icon: path.join(app.getAppPath(), "gymscore.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.maximize();
  win.show();

  win.loadFile("dist/renderer/index.html");
  if(isDev) {
    win.webContents.openDevTools();
  }
  win.on("closed", () => {
    logger.info("Main browser window closed");
  });
};

const logger = new Logger(app.getPath("userData"));
logger.setupIpc();

if (!app.requestSingleInstanceLock()) {
  logger.warn("Another instance is already running; this instance will quit");
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) {win.restore();}
      win.focus();
    }
  });

  app.whenReady().then(() => {
    logger.info("Application started", { version: app.getVersion() });
    Menu.setApplicationMenu(buildAppMenu());
    createWindow();

    // Recommended boilerplate to recreate a window when activated
    // which gives the expected UX on OSX
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {createWindow();}
    });
  });
}

// Recommended boiler-plate to quit the app when all windows are closed
// except for OSX (see on activate above)
app.on("window-all-closed", () => {
  logger.info("All windows closed", { platform: process.platform });
  if (process.platform !== "darwin") {app.quit();}
});

ipcMain.on("open-user-guide", () => {
  createHelpWindow();
});

ipcMain.on("open-external-url", (_event: IpcMainEvent, url: string) => {
  shell.openExternal(url);
});

ipcMain.on("generate-pdfs", (event: IpcMainEvent, arg: any) => {
  const competition: CompetitionData = arg.competition;
  logger.info("Generating PDF", {
    type: arg.type,
    competitionName: competition.name,
    competitionDate: competition.date,
  });
  switch(arg.type) {
  case "recorder-sheets":
    savePDF(competition, pdfs.generateRecorderSheets(competition), "recorder-sheets", logger);
    break;
  case "programme":
    savePDF(competition, pdfs.generateProgramme(competition), "programme", logger);
    break;
  case "results":
    savePDF(competition, pdfs.generateResults(competition), "results", logger);
    break;
  case "places":
    savePDF(competition, pdfs.generatePlaces(competition), "places", logger);
    break;
  case "announcements":
    savePDF(competition, pdfs.generateAnnouncements(competition), "announcements", logger);
    break;
  // Not needed currently, but the code exists and would be easy to adapt again later, so there's
  // little harm in keeping it but not using it.
  // case "certificates":
  //   savePDF(competition, pdfs.generateCertificates(competition), "certificates", logger);
  //   break;
  default:
    logger.warn("Unknown PDF type requested", { type: arg.type });
    break;
  }
});

// Receives the full exported JSON string from the renderer. Renderer and main are separate OS processes
// so data is always copied (never passed by reference), regardless of size. See exportDatabase() in
// renderer/index.ts for alternatives if the size ever becomes problematic.
ipcMain.handle("export-db", async (event, jsonData: string) => {
  logger.info("DB export dialog opening", { jsonSizeBytes: jsonData.length });
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: "Export GymScore Database",
    defaultPath: `gymscore-backup-${strftime("%Y-%m-%d")}.json.gz`,
    filters: [{ name: "GymScore Backup (gzip)", extensions: ["gz"] }],
  });
  if (canceled || !filePath) {
    logger.info("DB export dialog cancelled");
    return { success: false, canceled: true };
  }
  logger.info("Writing DB export file", { filePath });
  try {
    fs.writeFileSync(filePath, zlib.gzipSync(jsonData));
    logger.info("DB export file written successfully", { filePath });
  } catch (err) {
    logger.error("DB export file write failed", { filePath, error: String(err) });
    return { success: false, canceled: false };
  }
  return { success: true };
});

ipcMain.handle("export-competition", async (event, { jsonData, competitionName }:
  { jsonData: string, competitionName: string }) => {
  logger.info("Competition export dialog opening", { jsonSizeBytes: jsonData.length });
  const slug = competitionName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: "Export Competition",
    defaultPath: `${slug}.gscomp.gz`,
    filters: [{ name: "GymScore Competition", extensions: ["gscomp.gz", "gz"] }],
  });
  if (canceled || !filePath) {
    logger.info("Competition export dialog cancelled");
    return { success: false, canceled: true };
  }
  logger.info("Writing competition export file", { filePath });
  try {
    fs.writeFileSync(filePath, zlib.gzipSync(jsonData));
    logger.info("Competition export file written successfully", { filePath });
  } catch (err) {
    logger.error("Competition export file write failed", { filePath, error: String(err) });
    return { success: false, canceled: false };
  }
  return { success: true };
});

ipcMain.handle("import-competition", async (event) => {
  logger.info("Competition import dialog opening");
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: "Import Competition",
    filters: [{ name: "GymScore Competition", extensions: ["gscomp.gz", "gz", "json"] }],
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) {
    logger.info("Competition import dialog cancelled");
    return { success: false, canceled: true };
  }
  const filePath = filePaths[0];
  logger.info("Reading competition import file", { filePath });
  try {
    const raw = fs.readFileSync(filePath);
    // Detect gzip by magic bytes (1f 8b) rather than extension alone
    const isGzip = raw[0] === 0x1f && raw[1] === 0x8b;
    const data = isGzip
      ? zlib.gunzipSync(raw).toString("utf-8")
      : raw.toString("utf-8");
    logger.info("Competition import file read successfully", { filePath, isGzip, sizeBytes: data.length });
    return { success: true, data };
  } catch (err) {
    logger.error("Competition import file read failed", { filePath, error: String(err) });
    return { success: false, canceled: false };
  }
});

ipcMain.handle("import-db", async (event) => {
  logger.info("DB import dialog opening");
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: "Import GymScore Database",
    filters: [{ name: "GymScore Backup", extensions: ["gz", "json"] }],
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) {
    logger.info("DB import dialog cancelled");
    return { success: false, canceled: true };
  }
  const filePath = filePaths[0];
  logger.info("Reading DB import file", { filePath });
  try {
    const raw = fs.readFileSync(filePath);
    const isGzip = raw[0] === 0x1f && raw[1] === 0x8b;
    const data = isGzip
      ? zlib.gunzipSync(raw).toString("utf-8")
      : raw.toString("utf-8");
    logger.info("DB import file read successfully", { filePath, isGzip, sizeBytes: data.length });
    return { success: true, data };
  } catch (err) {
    logger.error("DB import file read failed", { filePath, error: String(err) });
    return { success: false, canceled: false };
  }
});

logger.debug("Data storage path", { path: app.getPath("userData") });
