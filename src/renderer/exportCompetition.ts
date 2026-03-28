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

import { ICompetition } from "../common/data/competition";
import {
  CURRENT_FORMAT_VERSION,
  FORMAT_MIN_GYMSCORES,
  CompetitionExportV1,
  ExportedClub,
  ExportedCompetitor,
  ExportedCompetition,
} from "../common/data/competitionExport";
import { GymscoreVersion } from "./data/version";
import { db } from "./data/gymscoredb";
import { logger } from "./logger";

export async function buildCompetitionExport(competition: ICompetition): Promise<string> {
  logger.info("Building competition export", {
    competitionId: competition.id,
    competitionName: competition.name,
  });

  // Collect the unique set of competitor and club IDs referenced by this competition
  const competitorIds = [...new Set(competition.competitors.map(c => c.competitorId))];
  const clubIdSet = new Set<number>();
  competition.competitors.forEach(c => clubIdSet.add(c.clubId));
  competition.teams.forEach(t => clubIdSet.add(t.clubId));
  const clubIds = [...clubIdSet];

  // Load records from the database
  const competitors = await db.competitors.bulkGet(competitorIds);
  const clubs = await db.clubs.bulkGet(clubIds);

  // Build export-format objects. exportId == the DB primary key at export time;
  // these serve as cross-reference IDs within the export file only.
  const exportedClubs: ExportedClub[] = clubs
    .filter(c => c !== undefined)
    .map(c => ({ exportId: c.id, name: c.name }));

  const exportedCompetitors: ExportedCompetitor[] = competitors
    .filter(c => c !== undefined)
    .map(c => ({
      exportId: c.id,
      identifier: c.identifier,
      name: c.name,
      step: c.step,
      division: c.division,
      clubId: c.clubId,   // export-local club ID (same numeric value as DB ID at export time)
    }));

  // Serialize the competition without its database id.
  // All competitorId / clubId values embedded in the competition are the same
  // numeric values as exportId fields above, so they are already export-local references.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _stripped, ...competitionWithoutId } = competition as any;
  const exportedCompetition: ExportedCompetition = competitionWithoutId;

  const payload: CompetitionExportV1 = {
    formatVersion: CURRENT_FORMAT_VERSION as 1,
    gymscoreVersion: GymscoreVersion,
    minGymscoreVersion: FORMAT_MIN_GYMSCORES[CURRENT_FORMAT_VERSION],
    competition: exportedCompetition,
    competitors: exportedCompetitors,
    clubs: exportedClubs,
  };

  logger.debug("Competition export built", {
    competitorCount: exportedCompetitors.length,
    clubCount: exportedClubs.length,
  });

  return JSON.stringify(payload);
}
