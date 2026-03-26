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

import { BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import strftime from "strftime";
import { LogEntry, LogLevel } from "../common/logger-types";

const LOG_FILE_PATTERN = /^gymscore-\d{4}-\d{2}-\d{2}\.jsonl$/;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function renderTemplate(template: string, fields: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return key in fields ? String(fields[key]) : `{${key}}`;
  });
}

export class Logger {
  private readonly sessionId: string;
  private readonly logDir: string;
  private currentDate: string;
  private readonly sessionBuffer: LogEntry[] = [];
  private logWindow: BrowserWindow | null = null;

  constructor(userData: string) {
    this.sessionId = new Date().toISOString();
    this.logDir = path.join(userData, "logs");
    fs.mkdirSync(this.logDir, { recursive: true });
    this.pruneOldLogs();
    this.currentDate = strftime("%Y-%m-%d");
  }

  setupIpc() {
    ipcMain.on("log-entry", (_event, partial: Omit<LogEntry, "timestamp" | "session">) => {
      this.write({
        ...partial,
        timestamp: new Date().toISOString(),
        session: this.sessionId,
      });
    });

    ipcMain.on("open-log-window", () => {
      this.openLogWindow();
    });

    ipcMain.handle("get-log-session", () => this.sessionBuffer);

    ipcMain.handle("export-logs", async (event, minLevel: LogLevel) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return this.exportLogs(win, minLevel);
    });
  }

  private pruneOldLogs() {
    const cutoff = Date.now() - ONE_YEAR_MS;
    try {
      for (const file of fs.readdirSync(this.logDir)) {
        if (!LOG_FILE_PATTERN.test(file)) {
          continue;
        }
        const fullPath = path.join(this.logDir, file);
        if (fs.statSync(fullPath).mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch {
      // Best effort; failure here must not prevent startup
    }
  }

  private openLogWindow() {
    if (this.logWindow && !this.logWindow.isDestroyed()) {
      this.logWindow.focus();
      return;
    }
    this.logWindow = new BrowserWindow({
      width: 1200,
      height: 700,
      title: "GymScore Logs",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });
    this.logWindow.loadFile("dist/renderer/logs.html");
    this.logWindow.on("closed", () => {
      this.logWindow = null;
    });
  }

  private write(entry: LogEntry) {
    const today = strftime("%Y-%m-%d");
    if (today !== this.currentDate) {
      this.currentDate = today;
    }
    this.sessionBuffer.push(entry);
    const filePath = path.join(this.logDir, `gymscore-${this.currentDate}.jsonl`);
    try {
      fs.appendFileSync(filePath, JSON.stringify(entry) + "\n");
    } catch (err) {
      console.error("Failed to write log entry:", err);
    }
    if (this.logWindow && !this.logWindow.isDestroyed()) {
      this.logWindow.webContents.send("log-window-entry", entry);
    }
  }

  log(level: LogLevel, template: string, fields: Record<string, unknown> = {}) {
    this.write({
      timestamp: new Date().toISOString(),
      level,
      session: this.sessionId,
      template,
      message: renderTemplate(template, fields),
      fields,
    });
  }

  trace(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.TRACE, template, fields ?? {}); }
  debug(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.DEBUG, template, fields ?? {}); }
  info(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.INFO, template, fields ?? {}); }
  warn(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.WARN, template, fields ?? {}); }
  error(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.ERROR, template, fields ?? {}); }
  fatal(template: string, fields?: Record<string, unknown>) { this.log(LogLevel.FATAL, template, fields ?? {}); }

  private async exportLogs(
    win: BrowserWindow,
    minLevel: LogLevel
  ): Promise<{ success: boolean; canceled?: boolean }> {
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: "Export GymScore Logs",
      defaultPath: `gymscore-logs-${strftime("%Y-%m-%d")}.jsonl.gz`,
      filters: [{ name: "GymScore Logs (gzip)", extensions: ["gz"] }],
    });
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const files = fs.readdirSync(this.logDir)
      .filter((f) => LOG_FILE_PATTERN.test(f))
      .sort();

    const gzip = zlib.createGzip();
    const output = fs.createWriteStream(filePath);
    gzip.pipe(output);

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.logDir, file), "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) {
          continue;
        }
        try {
          const entry = JSON.parse(line) as LogEntry;
          if (entry.level >= minLevel) {
            gzip.write(line + "\n");
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
    gzip.end();
    await new Promise<void>((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    });
    return { success: true };
  }
}
