import { IpcRendererEvent, ipcRenderer } from "electron";
import { CompetitionData } from "../data/competition";
import { LogEntry, LogLevel } from "../logger-types";

export type PdfType = "recorder-sheets" | "programme" | "results" | "places" | "announcements" | "certificates";
export type FileOperationResult = { success: boolean; canceled?: boolean };
export type FileReadResult = { success: boolean; canceled?: boolean; data?: string };

// Typed interface for the API exposed to renderer pages via contextBridge.
// Each overload captures the exact channel/payload/return-type contract.
export interface Api {
  sendAsync(channel: "generate-pdfs", data: { type: PdfType; competition: CompetitionData }): void;
  sendAsync(channel: "log-entry", data: Omit<LogEntry, "timestamp" | "session">): void;
  sendAsync(channel: "open-log-window", data: null): void;
  sendAsync(channel: "open-external-url", data: string): void;

  invoke(channel: "export-db", data: string): Promise<FileOperationResult>;
  invoke(
    channel: "export-competition",
    data: { jsonData: string; competitionName: string }
  ): Promise<FileOperationResult>;
  invoke(channel: "import-competition"): Promise<FileReadResult>;
  invoke(channel: "import-db"): Promise<FileReadResult>;
  invoke(channel: "export-logs", data: LogLevel): Promise<FileOperationResult>;
  invoke(channel: "get-log-session"): Promise<LogEntry[]>;

  receive(channel: "log-window-entry", func: (data: LogEntry) => void): void;
}

// Implementation uses broad internal types; the Api interface above enforces correctness at call sites.
const api = {
  sendAsync: (channel: string, data: unknown) => {
    const validChannels = ["save-png", "generate-pdfs", "log-entry", "open-log-window", "open-external-url"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.log("*** INVALID CHANNEL FOR SENDING FROM RENDERER " + channel + " ***");
    }
  },
  receive: (channel: string, func: (...args: unknown[]) => void) => {
    const validChannels = ["asynchronous-reply", "log-window-entry"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: unknown[]) => func(...args));
    } else {
      console.log("*** RENDERER IS NOT PERMITTED TO LISTEN ON  " + channel + " ***");
    }
  },
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    const validChannels = ["export-db", "import-db", "get-log-session", "export-logs",
      "export-competition", "import-competition"];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    } else {
      console.log("*** INVALID CHANNEL FOR INVOKE FROM RENDERER " + channel + " ***");
      return Promise.reject(new Error("Invalid channel"));
    }
  },
};

export default api as unknown as Api;
