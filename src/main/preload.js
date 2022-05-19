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

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) {element.innerText = text;}
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "api", {
    sendSync: (channel, data) => {
      // allowlist channels
      let validChannels = ["synchronous-message"];
      if (validChannels.includes(channel)) {
        return ipcRenderer.sendSync(channel, data);
      } else {
        console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
      }
    },
    sendAsync: (channel, data) => {
      // allowlist channels
      let validChannels = ["asynchronous-message", "save-png"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      } else {
        console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
      }
    },
    receive: (channel, func) => {
      let validChannels = ["asynchronous-reply"];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      } else {
        console.log("*** RENDERER IS NOT PERMITTED TO LISTEN ON  "+channel+"***");
      }
    }
  }
);
