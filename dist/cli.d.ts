#!/usr/bin/env node
import type { OutputFormat } from "./types.js";
interface ParsedCli {
    command: string | undefined;
    positional: string[];
    format: OutputFormat;
    offline: boolean;
    repository?: string;
    maxCommits: number;
    maxFiles: number;
    help: boolean;
    version: boolean;
}
export declare function parseCli(argv: string[]): ParsedCli;
export {};
//# sourceMappingURL=cli.d.ts.map