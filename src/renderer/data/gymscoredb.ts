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

import Dexie from "dexie";
import { IClub, Club } from "../../common/data";
import { ICompetitor, Competitor } from "../../common/data/competitor";
import { ICompetition, Competition } from "../../common/data/competition";

// See https://dexie.org/docs/Typescript
class GymScoreDB extends Dexie {
  competitions!: Dexie.Table<ICompetition, number>;
  competitors!: Dexie.Table<ICompetitor, number>;
  clubs!: Dexie.Table<IClub, number>;

  constructor () {
    super("GymScoreDB");
    this.version(3).stores({
      competitions: "++id, name, date, location, state",
      competitors: "++id, identifier, name, clubId",
      clubs: "++id, name",
    });
    this.version(4).stores({
      competitions: "++id, name, date, location, state, archived",
      competitors: "++id, identifier, name, clubId",
      clubs: "++id, name",
    }).upgrade(tx => {
      return tx.table("competitions").toCollection().modify((competition: ICompetition) => {
        if (competition.archived === undefined) {
          competition.archived = false;
        }
      });
    });
  }
}

export const db = new GymScoreDB();
db.clubs.mapToClass(Club);
db.competitors.mapToClass(Competitor);
db.competitions.mapToClass(Competition);
