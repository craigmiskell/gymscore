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

import { ICompetitor } from "./competitor";

// Details of a competitor *at a given competition*
// They will, over their competitive lifetime, change steps as they grow
// and may change gyms.  So while we store those details against the competitor
// as the current/last known value, it's more important to know what state they
// were in at a given competition.
// This is the data object stored competitors list for the competition.
export class CompetitionCompetitorDetails {
  competitorId: number;
  competitorName: string;
  stepString: string;
  gymId: number;
  teamIndex: number;
  groupNumber: number;

  constructor(competitor: ICompetitor, stepString: string, gymId: number, teamIndex: number, groupNumber: number) {
    this.competitorId = competitor.id;
    this.competitorName = competitor.name;
    this.stepString = stepString;
    this.gymId = gymId;
    this.teamIndex = teamIndex;
    this.groupNumber = groupNumber;
  }
}

export class Team {
  constructor(
    public name: string,
    public gymId: number,
  ) {}
}

export interface ICompetition {
  id?: number,
  name: string,
  date: string,
  location: string,
  state: CompetitionState,
  vault: boolean,
  bars: boolean,
  beam: boolean,
  floor: boolean,
  competitors: CompetitionCompetitorDetails[],
  teams: Team[],

  removeCompetitorById(competitorId: number): void;
  getCompetitorById(competitorId: number): CompetitionCompetitorDetails;
}

export enum CompetitionState {
  Preparing = 0,
  Live,
  Completed
}

export class Competition implements ICompetition {
  id: number;
  name: string;
  date: string;
  location: string;
  state: CompetitionState;
  vault = false;
  bars = false;
  beam = false;
  floor = false;
  competitors: CompetitionCompetitorDetails[] = [];
  teams: Team[] = [];

  constructor(name: string, date: string, location:string, id?:number) {
    this.name = name;
    this.date = date;
    this.location = location;
    this.state = CompetitionState.Preparing;
    if (id) {this.id = id;}
  }

  removeCompetitorById(competitorId: number) {
    const index = this.competitors.findIndex(
      (otherCompetitor: CompetitionCompetitorDetails) => {
        return competitorId == otherCompetitor.competitorId;
      }
    );
    if(index < 0) {
      return; //Ignore; -1 or not-found.
    }
    this.competitors.splice(index, 1);
  }

  getCompetitorById(competitorId: number) {
    return this.competitors.find(
      (otherCompetitor: CompetitionCompetitorDetails) => {
        return competitorId == otherCompetitor.competitorId;
      }
    );
  }
}
