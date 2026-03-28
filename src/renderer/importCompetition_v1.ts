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

import { CompetitionExportV1, ExportedCompetitor } from "../common/data/competitionExport";
import { ICompetitor } from "../common/data/competitor";
import { Division, hasDivisions } from "../common/data/division";
import { db } from "./data/gymscoredb";
import { logger } from "./logger";
import {
  CompetitionImportHandler,
  DuplicateAction,
  DuplicateInfo,
  CompetitorMismatch,
  ImportCompetitionResult,
  NameChoice,
  ShowDuplicateModal,
  ShowReconcileModal,
} from "./competitionImportTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple Levenshtein distance between two strings.
 * O(m*n) time and space; fine for short club names.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Returns true if two club names should be considered the same.
 * Covers exact match (case-insensitive, trimmed) and common typos / character
 * transpositions via Levenshtein distance ≤ max(2, 20% of the longer string).
 * Does not attempt to resolve semantic abbreviations (e.g. "St." vs "Saint").
 */
function clubNamesMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) {
    return true;
  }
  const maxLen = Math.max(na.length, nb.length);
  const threshold = Math.max(2, Math.floor(maxLen * 0.2));
  return levenshtein(na, nb) <= threshold;
}

/**
 * Pick the "latest" step/division between an existing local record and the
 * exported record.  Higher step wins; equal step prefers Over (1) over Under (0).
 * Division is ignored for steps ≥ 9 where hasDivisions() is false.
 */
function resolveStepDivision(
  localStep: number, localDivision: Division,
  exportStep: number, exportDivision: Division,
): { step: number; division: Division } {
  if (exportStep > localStep) {
    return { step: exportStep, division: exportDivision };
  }
  if (localStep > exportStep) {
    return { step: localStep, division: localDivision };
  }
  const division = hasDivisions(localStep)
    ? Math.max(localDivision, exportDivision) as Division
    : localDivision;
  return { step: localStep, division };
}

// ─── Internal prepare/complete types ─────────────────────────────────────────

interface MatchedCompetitor {
  exportId: number;
  localId: number;
  localName: string;
  localStep: number;
  localDivision: Division;
  exportStep: number;
  exportDivision: Division;
}

interface V1ImportState {
  data: CompetitionExportV1;
  matchedClubIdMap: Map<number, number>;  // export-local club ID → existing local ID
  newClubs: Map<number, string>;          // export-local club ID → name to create
  matchedCompetitors: MatchedCompetitor[];
  newCompetitors: ExportedCompetitor[];
}

interface V1PrepResult {
  duplicate?: DuplicateInfo;
  mismatches: CompetitorMismatch[];
  _state: V1ImportState;
}

interface V1ImportDecisions {
  duplicateAction: DuplicateAction;
  nameChoices: Map<string, NameChoice>;
}

// ─── Phase 1: prepare ─────────────────────────────────────────────────────────

async function prepare(data: CompetitionExportV1): Promise<V1PrepResult> {
  logger.info("Preparing v1 competition import", { competitionName: data.competition.name });

  // ── Duplicate detection ──
  let duplicate: DuplicateInfo | undefined;
  const existing = await db.competitions
    .where("name").equals(data.competition.name)
    .toArray();
  const exactDuplicate = existing.find(c => c.date === data.competition.date);
  if (exactDuplicate) {
    duplicate = { existingId: exactDuplicate.id, name: exactDuplicate.name, date: exactDuplicate.date };
    logger.info("Duplicate competition detected", { existingId: exactDuplicate.id });
  }

  // ── Club resolution ──
  const allLocalClubs = await db.clubs.toArray();
  const matchedClubIdMap = new Map<number, number>();
  const newClubs = new Map<number, string>();

  for (const exportedClub of data.clubs) {
    const match = allLocalClubs.find(local => clubNamesMatch(local.name, exportedClub.name));
    if (match) {
      matchedClubIdMap.set(exportedClub.exportId, match.id);
      logger.debug("Club matched", { exportedName: exportedClub.name, localName: match.name, localId: match.id });
    } else {
      newClubs.set(exportedClub.exportId, exportedClub.name);
      logger.debug("Club will be created", { name: exportedClub.name });
    }
  }

  // ── Competitor resolution ──
  const matchedCompetitors: MatchedCompetitor[] = [];
  const newCompetitors: ExportedCompetitor[] = [];
  const mismatches: CompetitorMismatch[] = [];

  for (const ec of data.competitors) {
    if (!ec.identifier) {
      newCompetitors.push(ec);
      continue;
    }

    const local: ICompetitor | undefined = await db.competitors
      .where("identifier").equals(ec.identifier)
      .first();

    if (!local) {
      newCompetitors.push(ec);
      continue;
    }

    matchedCompetitors.push({
      exportId: ec.exportId,
      localId: local.id,
      localName: local.name,
      localStep: local.step,
      localDivision: local.division,
      exportStep: ec.step,
      exportDivision: ec.division as Division,
    });

    if (local.name !== ec.name) {
      mismatches.push({
        identifier: ec.identifier,
        exportName: ec.name,
        localName: local.name,
        localCompetitorId: local.id,
      });
    }
  }

  logger.debug("Import preparation complete", {
    matchedClubs: matchedClubIdMap.size,
    newClubs: newClubs.size,
    matchedCompetitors: matchedCompetitors.length,
    newCompetitors: newCompetitors.length,
    mismatches: mismatches.length,
  });

  return {
    duplicate,
    mismatches,
    _state: { data, matchedClubIdMap, newClubs, matchedCompetitors, newCompetitors },
  };
}

// ─── Phase 2: complete ────────────────────────────────────────────────────────

async function complete(state: V1ImportState, decisions: V1ImportDecisions): Promise<number> {
  const { data, matchedClubIdMap, newClubs, matchedCompetitors, newCompetitors } = state;

  const clubIdMap = new Map<number, number>(matchedClubIdMap);

  for (const [exportId, name] of newClubs) {
    const newId = await db.clubs.add({ name }) as number;
    clubIdMap.set(exportId, newId);
    logger.info("Club created during import", { name, newId });
  }

  const competitorIdMap = new Map<number, number>();

  for (const mc of matchedCompetitors) {
    const exportCompetitor = data.competitors.find(c => c.exportId === mc.exportId);
    const resolved = resolveStepDivision(mc.localStep, mc.localDivision, mc.exportStep, mc.exportDivision);
    const nameChoice = decisions.nameChoices.get(exportCompetitor?.identifier ?? "");

    const local = await db.competitors.get(mc.localId);
    if (local) {
      let changed = false;
      if (nameChoice === "use-export" && exportCompetitor && local.name !== exportCompetitor.name) {
        local.name = exportCompetitor.name;
        changed = true;
      }
      if (local.step !== resolved.step || local.division !== resolved.division) {
        local.step = resolved.step;
        local.division = resolved.division;
        changed = true;
      }
      const remappedClubId = clubIdMap.get(exportCompetitor?.clubId ?? -1);
      if (remappedClubId !== undefined && local.clubId !== remappedClubId) {
        local.clubId = remappedClubId;
        changed = true;
      }
      if (changed) {
        await db.competitors.put(local);
        logger.debug("Competitor updated during import", { localId: mc.localId });
      }
    }

    competitorIdMap.set(mc.exportId, mc.localId);
  }

  for (const ec of newCompetitors) {
    const remappedClubId = clubIdMap.get(ec.clubId) ?? 0;
    const newId = await db.competitors.add({
      identifier: ec.identifier,
      name: ec.name,
      step: ec.step,
      division: ec.division as Division,
      clubId: remappedClubId,
    }) as number;
    competitorIdMap.set(ec.exportId, newId);
    logger.info("Competitor created during import", { name: ec.name, newId });
  }

  // ── Handle duplicate action ──
  let competitionName = data.competition.name;
  if (decisions.duplicateAction === "overwrite") {
    const existingList = await db.competitions
      .where("name").equals(data.competition.name)
      .toArray();
    const toDelete = existingList.find(c => c.date === data.competition.date);
    if (toDelete) {
      await db.competitions.delete(toDelete.id);
      logger.info("Existing competition deleted for overwrite", { deletedId: toDelete.id });
    }
  } else if (decisions.duplicateAction === "create-duplicate") {
    competitionName = `${data.competition.name} (imported)`;
  }

  // ── Remap and assemble the new competition record ──
  const importedCompetitors = data.competition.competitors.map(ec => {
    const localCompetitorId = competitorIdMap.get(ec.competitorId);
    const localClubId = clubIdMap.get(ec.clubId);
    const resolvedLocal = matchedCompetitors.find(mc => mc.exportId === ec.competitorId);
    const exportedComp = data.competitors.find(c => c.exportId === ec.competitorId);

    let finalName = ec.competitorName;
    if (exportedComp) {
      const nameChoice = decisions.nameChoices.get(exportedComp.identifier);
      if (nameChoice === "keep-local" && resolvedLocal) {
        finalName = resolvedLocal.localName;
      } else if (nameChoice === "use-export") {
        finalName = exportedComp.name;
      } else if (!nameChoice && resolvedLocal) {
        finalName = resolvedLocal.localName;
      }
    }

    let finalStep = ec.step;
    let finalDivision = ec.division as Division;
    if (resolvedLocal) {
      const resolved = resolveStepDivision(
        resolvedLocal.localStep, resolvedLocal.localDivision,
        ec.step, ec.division as Division,
      );
      finalStep = resolved.step;
      finalDivision = resolved.division;
    }

    const localClubName = data.clubs.find(c => c.exportId === ec.clubId)?.name ?? ec.clubName;

    return {
      ...ec,
      competitorId: localCompetitorId ?? ec.competitorId,
      competitorName: finalName,
      step: finalStep,
      division: finalDivision,
      clubId: localClubId ?? ec.clubId,
      clubName: localClubName,
    };
  });

  const importedTeams = data.competition.teams.map(t => ({
    ...t,
    clubId: clubIdMap.get(t.clubId) ?? t.clubId,
  }));

  const newCompetition = {
    ...data.competition,
    name: competitionName,
    competitors: importedCompetitors,
    teams: importedTeams,
  };
  delete (newCompetition as any).id;

  const newId = await db.competitions.add(newCompetition as any) as number;
  logger.info("Competition imported", { newId, name: competitionName });
  return newId;
}

export const v1Handler: CompetitionImportHandler = {
  async run(
    data: unknown,
    showDuplicateModal: ShowDuplicateModal,
    showReconcileModal: ShowReconcileModal,
  ): Promise<ImportCompetitionResult> {
    logger.info("Starting v1 import");
    const prep = await prepare(data as CompetitionExportV1);

    let duplicateAction: DuplicateAction | undefined;
    if (prep.duplicate) {
      const choice = await showDuplicateModal(prep.duplicate);
      if (choice === "cancel") {
        logger.info("Import cancelled at duplicate resolution step");
        return { success: false, canceled: true };
      }
      duplicateAction = choice;
    }

    const nameChoices = new Map<string, NameChoice>();
    if (prep.mismatches.length > 0) {
      const choices = await showReconcileModal(prep.mismatches);
      if (choices === null) {
        logger.info("Import cancelled at reconciliation step");
        return { success: false, canceled: true };
      }
      for (const [id, choice] of choices) {
        nameChoices.set(id, choice);
      }
    }

    try {
      const newId = await complete(prep._state, {
        duplicateAction: duplicateAction ?? "create-duplicate",
        nameChoices,
      });
      return { success: true, newCompetitionId: newId };
    } catch (err) {
      logger.error("Import failed during write phase", { error: String(err) });
      return { success: false, errorMessage: `Import failed: ${String(err)}` };
    }
  },
};
