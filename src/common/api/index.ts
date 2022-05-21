import {IpcRendererEvent, ipcRenderer} from 'electron';

export default {
    sendSync: (channel:string, data: any) => {
        // allowlist channels
        let validChannels = ["synchronous-message"];
        if (validChannels.includes(channel)) {
        return ipcRenderer.sendSync(channel, data);
        } else {
        console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
        }
    },
    sendAsync: (channel:string, data: any) => {
        // allowlist channels
        let validChannels = ["asynchronous-message", "save-png"];
        if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
        } else {
        console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER "+channel+"***");
        }
    },
    receive: (channel:string, func: Function) => {
        let validChannels = ["asynchronous-reply"];
        if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any) => func(...args));
        } else {
        console.log("*** RENDERER IS NOT PERMITTED TO LISTEN ON  "+channel+"***");
        }
    }
}
