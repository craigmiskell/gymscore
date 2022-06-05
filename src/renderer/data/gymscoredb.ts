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

import Dexie from 'dexie';
import { IGym, Gym } from './gym';
import { ICompetitor, Competitor } from './competitor';

// See https://dexie.org/docs/Typescript
class GymScoreDB extends Dexie {
  competitors!: Dexie.Table<ICompetitor, number>;
  gyms!: Dexie.Table<IGym, number>;

  constructor () {
      super("GymScoreDB");
      this.version(1).stores({
        competitors: '++id, identifier, name, _stepString, gymId',
        gyms: '++id, name, ',
      });
  }
}

export var db = new GymScoreDB();
db.gyms.mapToClass(Gym);
db.competitors.mapToClass(Competitor);
