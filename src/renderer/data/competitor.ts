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

import { Division } from "./division";

export interface ICompetitor {
  id?: number,
  identifier: string,
  name: string,
  step: number,
  division: Division,
  gymId: number,
}

export class Competitor implements ICompetitor {
  id: number; // PK
  // The governing body identifier (could be strictly a number, but we don't know for sure so we treat it
  // as an opaque string)
  identifier: string;
  name: string;
  gymId: number;
  step: number;
  division: Division;

  constructor(identifier: string, name: string, step: number, division: Division, gymId: number, id?:number) {
    this.identifier = identifier;
    this.name = name;
    this.gymId = gymId;
    this.step = step;
    this.division = division;

    if (id) {this.id = id;}
  }
}
