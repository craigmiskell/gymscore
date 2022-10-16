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


// See https://dexie.org/docs/Typescript for some other inspiration
export interface IGym {
  id?: number;
  name: string;
}

export class Gym implements IGym {
  id: number;
  name: string;

  constructor(name: string, id?:number) {
    this.name = name;
    if (id) {this.id = id;}
  }
}
