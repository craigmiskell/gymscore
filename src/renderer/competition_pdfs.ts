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

declare const api: typeof import("../common/api").default;

import { ICompetition } from "../common/data";
import { logger } from "./logger";

export function generateCompetitionPDFs(competition: ICompetition) {
  logger.info("Requesting results, places, and announcements PDFs", {
    competitionId: competition.id,
    competitionName: competition.name,
  });
  api.sendAsync("generate-pdfs", { type: "results", competition });
  api.sendAsync("generate-pdfs", { type: "places", competition });
  api.sendAsync("generate-pdfs", { type: "announcements", competition });
}
