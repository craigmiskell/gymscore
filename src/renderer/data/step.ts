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

export enum UnderOver {
  Under = 0,
  Over,
}
const minLevel = 1;
const maxLevel = 10;

// export interface IStep {
//   level: bigint;
//   underOver: UnderOver;
// }

// Just a convenience class; persisted as strings, and use toString/fromString
// to de/hydrate it
export class Step { // implements IStep {
  _level: bigint;
  underOver: UnderOver;

  constructor(level: bigint, underOver: UnderOver) {
    this.level = level;
    this.underOver = underOver;
  }

  static fromString(step: string) :Step {
    // TODO: error handling (count of bits != 2, parse failures, out of bounds, etc)
    const bits = step.split("-");
    if(bits.length != 2) {
      throw new TypeError(`Step string "${step}" had ${bits.length} parts; expected 2`);
    }
    const uo = parseInt(bits[1]);
    if (Number.isNaN(uo) || (uo > UnderOver.Over)) {
      throw new TypeError(`UnderOver in serialised Step string "${step}" was not a valid value`);
    }
    return new Step(BigInt(parseInt(bits[0])), uo);
  }

  toString() :string {
    return `${this.level}-${this.underOver}`;
  }

  set level(value: bigint) {
    if (value < minLevel || value > maxLevel) {
      throw new RangeError("Level must be between 1 and 10 inclusive");
    }
    this._level = value;
  }
  get level() {
    return this._level;
  }
}
