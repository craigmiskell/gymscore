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

// ─── Format versioning ───────────────────────────────────────────────────────
//
// CURRENT_FORMAT_VERSION: the version written by the exporter.
// MAX_SUPPORTED_FORMAT_VERSION: the highest version this build can import.
//   Normally equals CURRENT_FORMAT_VERSION; bump independently if a new format
//   version can be imported without a code change on the older side.
// FORMAT_MIN_GYMSCORES: the minimum GymScore app version that introduced support
//   for each format version.  Used only to produce a helpful error message when
//   an importer encounters a format version it does not understand.

export const CURRENT_FORMAT_VERSION = 1;
export const MAX_SUPPORTED_FORMAT_VERSION = 1;

export const FORMAT_MIN_GYMSCORES: Record<number, string> = {
  1: "0.1.0",
};

// ─── Export-format types ─────────────────────────────────────────────────────
//
// IDs in these types are "export-local": they are the original DB primary keys
// at export time and are used only as cross-references within the export file.
// They must never be assumed to match IDs in the importing database.

export interface ExportedClub {
  exportId: number;
  name: string;
}

export interface ExportedCompetitor {
  exportId: number;
  identifier: string;  // national / governing-body ID; primary match key on import
  name: string;
  step: number;
  division: number;    // Division enum value (0=Under, 1=Over)
  clubId: number;      // export-local club ID
}

export interface ExportedCompetitorScore {
  difficulty: number;
  e1: number;
  e2: number;
  e3: number;
  e4: number;
  neutralDeductions: number;
  finalScore: number;
}

export interface ExportedCompetitionCompetitorDetails {
  competitorId: number;       // export-local competitor ID
  competitorIdentifier: string;
  competitorName: string;
  step: number;
  division: number;
  clubId: number;             // export-local club ID
  clubName: string;
  teamIndex: number | null;
  groupNumber: number;
  scores: Record<string, ExportedCompetitorScore>;
}

export interface ExportedTeam {
  name: string;
  clubId: number;             // export-local club ID
}

export interface ExportedCompetition {
  // id is intentionally absent — it is assigned by the importing database
  name: string;
  date: string;
  location: string;
  state: number;              // CompetitionState enum value
  archived: boolean;
  vault: boolean;
  bar: boolean;
  beam: boolean;
  floor: boolean;
  competitors: ExportedCompetitionCompetitorDetails[];
  teams: ExportedTeam[];
}

// ─── Versioned export envelope ────────────────────────────────────────────────

export interface CompetitionExportV1 {
  formatVersion: 1;
  gymscoreVersion: string;     // informative: the exporting app's version
  minGymscoreVersion: string;  // minimum app version able to import this format
  competition: ExportedCompetition;
  competitors: ExportedCompetitor[];
  clubs: ExportedClub[];
}

// Extend this union as new format versions are added:
//   export type CompetitionExport = CompetitionExportV1 | CompetitionExportV2;
export type CompetitionExport = CompetitionExportV1;
