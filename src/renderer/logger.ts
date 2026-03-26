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

import { LogLevel } from "../common/logger-types";

declare const api: typeof import("../common/api").default;

function renderTemplate(template: string, fields: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return key in fields ? String(fields[key]) : `{${key}}`;
  });
}

function log(level: LogLevel, template: string, fields: Record<string, unknown>) {
  const message = renderTemplate(template, fields);
  api.sendAsync("log-entry", { level, template, message, fields });
}

export const logger = {
  trace: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.TRACE, template, fields),
  debug: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.DEBUG, template, fields),
  info: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.INFO, template, fields),
  warn: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.WARN, template, fields),
  error: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.ERROR, template, fields),
  fatal: (template: string, fields: Record<string, unknown> = {}) => log(LogLevel.FATAL, template, fields),
};
