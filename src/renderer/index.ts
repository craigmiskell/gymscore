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

// import "bootstrap";
//Alternatively, more selective:
//import { Tooltip, Toast, Popover } from 'bootstrap';

import "bootstrap/dist/css/bootstrap.min.css";

console.log("Hello from Renderer!");

import * as jq from "jquery";
console.log(jq.fn.jquery);

console.log(api.sendSync("synchronous-message", "syncping"));

api.receive("asynchronous-reply", (args: any) => {
  console.log("Received async reply");
  console.log(args);
});
api.sendAsync("asynchronous-message", "asyncping");

document.getElementById("printButton").addEventListener("click", async () => {
  const offscreen = new OffscreenCanvas(256, 256);
  const ctx = offscreen.getContext("2d");
  ctx.fillStyle = "rgb(200, 0, 0)";
  ctx.fillRect(10, 10, 50, 50);

  const blob = await offscreen.convertToBlob();
  const arrayBuffer = await blob.arrayBuffer();
  api.sendAsync("save-png", {data: arrayBuffer, filenameHint: "foobar"});
});
