// Type declarations for the "api" module alias (used when contextBridge exposes the api globally).
// Renderer files that use `declare const api: typeof import("../common/api").default` pick up
// types directly from index.ts; this file covers any code that imports from the "api" module name.
export { Api, PdfType, FileOperationResult, FileReadResult } from "./index";
