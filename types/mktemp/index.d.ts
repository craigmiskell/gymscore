declare module 'mktemp' {
    export function createDir(
        template: string,
        callback?: Function
    ): Promise<string>

    export function createDirSync(
        template: string,
    ): string

    export function createFile(
        template: string,
        callback?: Function
    ): Promise<string>

    export function createFileSync(
        template: string,
    ): string
}
