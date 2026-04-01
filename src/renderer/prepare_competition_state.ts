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

import * as pageCommon from "./page_common";
import { ICompetition } from "../common/data";

export const COMPETITOR_ID_ATTR_NAME = "competitorId";
export const CLUB_ID_ATTR_NAME = "clubId";
export const TEAM_INDEX_ATTR_NAME = "teamId";

export class Elements extends pageCommon.BaseElements {
  detailsForm: HTMLFormElement = null;
  competitionName: HTMLInputElement = null;
  competitionDate: HTMLInputElement = null;
  competitionLocation: HTMLInputElement = null;
  enableVault: HTMLInputElement = null;
  enableBar: HTMLInputElement = null;
  enableBeam: HTMLInputElement = null;
  enableFloor: HTMLInputElement = null;
  competitorName: HTMLInputElement = null;
  competitors: HTMLTableElement = null;
  addCompetitorModal: HTMLDivElement = null;
  competitorNameModal: HTMLInputElement = null;
  competitorIdModal: HTMLInputElement = null;
  competitorStepSelectModal: HTMLSelectElement = null;
  competitorDivisionSelectModal: HTMLSelectElement = null;
  competitorClubModal: HTMLInputElement = null;
  competitorTeamModal: HTMLInputElement = null;
  addCompetitorButton: HTMLButtonElement = null;
  competitorDetailsForm: HTMLFormElement = null;
  filterName: HTMLInputElement = null;
  filterNationalId: HTMLInputElement = null;
  filterStep: HTMLInputElement = null;
  filterClub: HTMLInputElement = null;
  filterTeam: HTMLInputElement = null;
  filterGroup: HTMLInputElement = null;
  duplicateCompetitorError: HTMLDivElement = null;
  competitorAlreadyAddedWarning: HTMLDivElement = null;
  nationalIdDuplicateWarning: HTMLDivElement = null;
  selectAllCheckbox: HTMLInputElement = null;
  groupAssignToolbar: HTMLDivElement = null;
  groupAssignGuidance: HTMLSpanElement = null;
  groupAssignCount: HTMLSpanElement = null;
}

export const elements = new Elements();

// Exported as a live binding; importing modules read the current value.
// Only details module reassigns it (via setCompetition) when loading/creating.
export let competition: ICompetition = undefined;
export function setCompetition(c: ICompetition) { competition = c; }
