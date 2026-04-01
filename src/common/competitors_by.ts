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

import { CompetitionCompetitorDetails } from "../common/data/competition";
import { APPARATUSES } from "./apparatus";

export interface KeyedCompetitors {
  [key: string]: CompetitionCompetitorDetails[]
}

function createKeyedCompetitorsProxy() {
  return new Proxy({}, {
    get: function(object: KeyedCompetitors, property: string) {
      if (!Object.prototype.hasOwnProperty.call(object, property)) {
        object[property] = new Array<CompetitionCompetitorDetails>();
      }
      return object[property];
    }
  });
}

export function getCompetitorsByStep(competitors: CompetitionCompetitorDetails[]): KeyedCompetitors {
  return keyedCompetitorsByFunc(competitors, (c) => c.step.toString());
}

export function sortByGroupOrder(competitors: CompetitionCompetitorDetails[]): CompetitionCompetitorDetails[] {
  const allUnordered = competitors.every((c) => (c.groupOrder ?? 0) === 0);
  if (allUnordered) {
    return [...competitors].sort((a, b) => a.competitorName.localeCompare(b.competitorName));
  }
  return [...competitors].sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
}

export function getCompetitorsByGroup(competitors: CompetitionCompetitorDetails[]): KeyedCompetitors {
  return keyedCompetitorsByFunc(competitors, (c) => c.groupNumber.toString());
}

/**
 * Returns how many positions to rotate competitor order when a group is at the
 * given apparatus. Groups rotate through apparatuses starting from
 * apparatus (groupIndex % numApparatuses), matching the competition schedule.
 * Each time a group advances to their next apparatus the first competitor in
 * the previous order moves to the end.
 */
export function apparatusRotation(apparatusIndex: number, groupIndex: number, numApparatuses: number): number {
  return ((apparatusIndex - groupIndex) % numApparatuses + numApparatuses) % numApparatuses;
}

/**
 * Rotates a competitor array by `rotation` positions: competitors.slice(rotation)
 * comes first, competitors.slice(0, rotation) moves to the end.
 */
export function rotateCompetitorOrder(
  competitors: CompetitionCompetitorDetails[],
  rotation: number
): CompetitionCompetitorDetails[] {
  const n = competitors.length;
  if (n === 0) {
    return competitors;
  }
  const r = rotation % n;
  if (r === 0) {
    return competitors;
  }
  return [...competitors.slice(r), ...competitors.slice(0, r)];
}

/**
 * Returns the 0-based index of `apparatus` in the list of enabled apparatuses
 * for the competition, and the total count of enabled apparatuses — the two
 * values needed to call `sortByGroupOrderForApparatus`.
 *
 * Callers pass `competition` as a record so this file stays independent of
 * the renderer/main process split.
 */
export function enabledApparatusContext(
  competition: Partial<Record<string, boolean>>,
  apparatus: string
): { apparatusIndex: number; numApparatuses: number } {
  const enabled = APPARATUSES.filter((a) => competition[a]);
  return { apparatusIndex: enabled.findIndex((a) => a === apparatus), numApparatuses: enabled.length };
}

/**
 * Sorts competitors by groupOrder then rotates the result to reflect the group's
 * position in the competition apparatus rotation.
 */
export function sortByGroupOrderForApparatus(
  competitors: CompetitionCompetitorDetails[],
  apparatusIndex: number,
  groupIndex: number,
  numApparatuses: number
): CompetitionCompetitorDetails[] {
  return rotateCompetitorOrder(
    sortByGroupOrder(competitors),
    apparatusRotation(apparatusIndex, groupIndex, numApparatuses)
  );
}

function keyedCompetitorsByFunc(
  competitors: CompetitionCompetitorDetails[],
  getKey: (c: CompetitionCompetitorDetails) => string): KeyedCompetitors {
  const result = createKeyedCompetitorsProxy();
  for (const competitor of competitors) {
    result[getKey(competitor)].push(competitor);
  }
  return result;
}
