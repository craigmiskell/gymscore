import {IpcRendererEvent, ipcRenderer} from "electron";

type ReceiveCallbackFunction = (...args: any[]) => void;

export default {
  sendSync: (channel:string, data: any) => {
    // allowlist channels (fetchCompetitor not in use, just an exemplar from early testing)
    const validChannels = ["fetchCompetitor"];
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, data);
    } else {
      console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
    }
  },
  sendAsync: (channel:string, data: any) => {
    // allowlist channels
    const validChannels = ["save-png", "generate-pdfs"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
    }
  },
  receive: (channel:string, func: ReceiveCallbackFunction) => {
    const validChannels = ["asynchronous-reply"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any) => func(...args));
    } else {
      console.log("*** RENDERER IS NOT PERMITTED TO LISTEN ON  "+channel+"***");
    }
  }
};
