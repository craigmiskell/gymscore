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

// declare const api: typeof import("../common/api").default;

// import "bootstrap";
//Alternatively, more selective:
//import { Tooltip, Toast, Popover } from 'bootstrap';

console.log("Welcome to GymScore");

//TODO: move this to a data place; maybe gymscoredb.ts?
// Looks like we get full persistent access to all available storage but this is worth reporting
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(function(persistent) {
    if (persistent) {
      console.log("Storage will not be cleared except by explicit user action");
    } else {
      // TODO: alert the user to tell me that this unexpected event has happened.
      console.log("Storage may be cleared by the UA under storage pressure.");
    }
  });
}
navigator.storage.estimate().then(estimation =>{
  console.log(`Quota: ${estimation.quota/1024/1024}MB`);
  console.log(`Usage: ${estimation.usage/1024/1024}MB`);
});

// Will need this eventually, just not yet
// import jq from "jquery";

import { db } from "./data/gymscoredb";
// import { Gym, Competitor, Step, UnderOver } from "./data";
// import { GymscoreVersion } from "./data/version";
import * as pageCommon from "./page_common";
pageCommon.setup();

testDB();

// Leave this as an example for how to draw to a canvas and then save to disk
// via the main context.  We'll move it elsewhere and add actual useful drawing later.
// document.getElementById("printButton").addEventListener("click", async () => {
//   const offscreen = new OffscreenCanvas(256, 256);
//   const ctx = offscreen.getContext("2d");
//   ctx.fillStyle = "rgb(200, 0, 0)";
//   ctx.fillRect(10, 10, 50, 50);

//   const blob = await offscreen.convertToBlob();
//   const arrayBuffer = await blob.arrayBuffer();
//   api.sendAsync("save-png", {data: arrayBuffer, filenameHint: "foobar"});
// });

async function testDB() {
  // await db.delete();  // For debugging; uncomment when necessary
  // await db.open();
  db.transaction("rw", db.competitions, async() => {
    db.competitions.toArray().then((a) => {
      for (const c of a) {
        console.log(c);
      }
    });
  });
}
