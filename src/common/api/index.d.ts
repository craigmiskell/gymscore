type ReceiveCallbackFunction = (...args) => void;

declare module "api" {
    export function sendSync(channel:string, data: any): any;
    export function sendAsync(channel:string, data: any);
    export function receive(channel:string, func: ReceiveCallbackFunction);
}
