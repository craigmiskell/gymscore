type MktempCallbackFunction =  (err: NodeJS.ErrnoException | null, dirname: string | null) => void

declare module "mktemp" {
    export function createDir(
        template: string,
        callback?: MktempCallbackFunction
    ): Promise<string>

    export function createDirSync(
        template: string,
    ): string

    export function createFile(
        template: string,
        callback?: MktempCallbackFunction
    ): Promise<string>

    export function createFileSync(
        template: string,
    ): string
}
