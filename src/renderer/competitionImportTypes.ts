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

// ─── Shared UI-decision types ─────────────────────────────────────────────────
//
// These live here (not in the versioned modules) so the orchestrator
// (importCompetition.ts) can type its modal callbacks without importing from
// any specific version module.

export type DuplicateAction = "create-duplicate" | "overwrite";
export type NameChoice = "use-export" | "keep-local";

export interface DuplicateInfo {
  existingId: number;
  name: string;
  date: string;
}

export interface CompetitorMismatch {
  identifier: string;
  exportName: string;
  localName: string;
  localCompetitorId: number;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface ImportCompetitionResult {
  success: boolean;
  canceled?: boolean;
  newCompetitionId?: number;
  errorMessage?: string;
}

// ─── Modal callback signatures ────────────────────────────────────────────────

/** Resolves with the user's choice, or "cancel" if the modal was dismissed. */
export type ShowDuplicateModal =
  (info: DuplicateInfo) => Promise<"cancel" | DuplicateAction>;

/** Resolves with a map of identifier → NameChoice, or null if cancelled. */
export type ShowReconcileModal =
  (mismatches: CompetitorMismatch[]) => Promise<Map<string, NameChoice> | null>;

// ─── Handler interface ────────────────────────────────────────────────────────
//
// Every versioned import module exports a single object implementing this
// interface.  importCompetition.ts never needs to know anything beyond it.

export interface CompetitionImportHandler {
  run(
    data: unknown,
    showDuplicateModal: ShowDuplicateModal,
    showReconcileModal: ShowReconcileModal,
  ): Promise<ImportCompetitionResult>;
}
