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
import { Division } from "./division";

interface CompetitorScores {
  [key: string]: CompetitorScore
}

// Values are all * 1000 and are integers, to be rendered as floating point (to 3dp) by the UI.
export class CompetitorScore {
  constructor(
    public difficulty: number,
    public e1: number,
    public e2: number,
    public e3: number,
    public e4: number,
    public neutralDeductions: number,
    public finalScore: number, // Can be calculated from the other data, but it's easier to store it as well.
  ) {}
}

// Details of a competitor *at a given competition*
// They will, over their competitive lifetime, change steps as they grow
// and may change clubs.  So while we store those details against the competitor
// as the current/last known value, it's more important to know what state they
// were in at a given competition.
// This is the data object stored in competitors list for the competition.
export class CompetitionCompetitorDetails {
  competitorId: number;
  competitorIdentifier: string;
  competitorName: string;
  step: number;
  division: Division;
  clubId: number;
  clubName: string;
  teamIndex: number | null;
  groupNumber: number;
  groupOrder: number;
  scores: CompetitorScores;

  constructor(competitor: ICompetitor, step: number, division: Division, clubId: number,
    clubName: string, teamIndex: number | null, groupNumber: number) {
    this.competitorId = competitor.id;
    this.competitorIdentifier = competitor.identifier;
    this.competitorName = competitor.name;
    this.step = step;
    this.division = division;
    this.clubId = clubId;
    this.clubName = clubName;
    this.teamIndex = teamIndex;
    this.groupNumber = groupNumber;
    this.groupOrder = 0;
    this.scores = {};
  }
}

export class Team {
  constructor(
    public name: string,
    public clubId: number,
  ) {}
}

export interface ICompetition {
  id?: number,
  name: string,
  date: string,
  location: string,
  state: CompetitionState,
  archived?: boolean,
  vault: boolean,
  bar: boolean,
  beam: boolean,
  floor: boolean,
  competitors: CompetitionCompetitorDetails[],
  teams: Team[],

  removeCompetitorById(competitorId: number): void;
  getCompetitorById(competitorId: number): CompetitionCompetitorDetails;
}

// Plain data view of a competition: what crosses the IPC boundary. Class instances are serialised
// to plain objects by Structured Clone, so the main process only receives data properties, not methods.
export type CompetitionData = Omit<ICompetition, "removeCompetitorById" | "getCompetitorById">;

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
  archived = false;
  vault = false;
  bar = false;
  beam = false;
  floor = false;
  competitors: CompetitionCompetitorDetails[] = [];
  teams: Team[] = [];

  constructor(name: string, date: string, location:string, id?:number) {
    this.name = name;
    this.date = date;
    this.location = location;
    this.state = CompetitionState.Preparing;
    if (id !== undefined) {this.id = id;}
  }

  removeCompetitorById(competitorId: number) {
    const index = this.competitors.findIndex(
      (otherCompetitor: CompetitionCompetitorDetails) => {
        return competitorId === otherCompetitor.competitorId;
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
        return competitorId === otherCompetitor.competitorId;
      }
    );
  }
}
