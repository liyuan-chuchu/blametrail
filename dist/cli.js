#!/usr/bin/env node
import { analyzeExplain, analyzeReview } from "./analyze.js";
import { formatReport } from "./format.js";
import { parseTarget } from "./git.js";
import { parseRepository } from "./github.js";
const VERSION = "0.1.0";
export function parseCli(argv) {
    const parsed = {
        command: undefined,
        positional: [],
        format: "text",
        offline: false,
        maxCommits: 5,
        maxFiles: 20,
        help: false,
        version: false,
    };
    const args = [...argv];
    parsed.command = args.shift();
    for (let index = 0; index < args.length; index += 1) {
        const value = args[index];
        if (!value)
            continue;
        if (value === "--json")
            parsed.format = "json";
        else if (value === "--markdown" || value === "--md")
            parsed.format = "markdown";
        else if (value === "--offline")
            parsed.offline = true;
        else if (value === "--help" || value === "-h")
            parsed.help = true;
        else if (value === "--version" || value === "-v")
            parsed.version = true;
        else if (value === "--repo")
            parsed.repository = requireValue(args, ++index, "--repo");
        else if (value === "--max-commits") {
            parsed.maxCommits = parseBoundedInteger(requireValue(args, ++index, "--max-commits"), 1, 20);
        }
        else if (value === "--max-files") {
            parsed.maxFiles = parseBoundedInteger(requireValue(args, ++index, "--max-files"), 1, 100);
        }
        else if (value.startsWith("-"))
            throw new Error(`Unknown option: ${value}`);
        else
            parsed.positional.push(value);
    }
    return parsed;
}
async function main() {
    const cli = parseCli(process.argv.slice(2));
    if (cli.version || cli.command === "version") {
        process.stdout.write(`${VERSION}\n`);
        return;
    }
    if (cli.help || !cli.command || cli.command === "help") {
        process.stdout.write(helpText());
        return;
    }
    const options = {
        cwd: process.cwd(),
        offline: cli.offline,
        maxCommits: cli.maxCommits,
        maxFiles: cli.maxFiles,
    };
    if (cli.repository)
        options.repository = parseRepository(cli.repository);
    if (cli.command === "explain") {
        const input = cli.positional[0];
        if (!input)
            throw new Error("explain requires path/to/file:line.");
        const report = await analyzeExplain(parseTarget(input), options);
        process.stdout.write(`${formatReport(report, cli.format)}\n`);
        return;
    }
    if (cli.command === "review") {
        const input = cli.positional[0];
        if (!input)
            throw new Error("review requires a pull request number or URL.");
        const number = parsePullNumber(input);
        const report = await analyzeReview(number, options);
        process.stdout.write(`${formatReport(report, cli.format)}\n`);
        return;
    }
    throw new Error(`Unknown command: ${cli.command}`);
}
function parsePullNumber(value) {
    const match = value.match(/(?:\/pull\/)?(\d+)(?:\/?$)/);
    const number = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    if (!Number.isSafeInteger(number) || number < 1) {
        throw new Error("Pull request must be a positive number or a GitHub pull request URL.");
    }
    return number;
}
function requireValue(args, index, option) {
    const value = args[index];
    if (!value)
        throw new Error(`${option} requires a value.`);
    return value;
}
function parseBoundedInteger(value, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
        throw new Error(`Expected an integer from ${min} to ${max}, received ${value}.`);
    }
    return number;
}
function helpText() {
    return `BlameTrail ${VERSION} — the evidence trail behind every line of code.

Usage:
  blametrail explain <file:line|file:start-end> [options]
  blametrail review <pull-number|pull-url> [options]

Options:
  --offline             Use local Git history only (explain command)
  --repo owner/name     Override the repository inferred from origin
  --json                Emit machine-readable JSON
  --markdown, --md      Emit Markdown suitable for a PR or issue
  --max-commits <n>     Limit commit evidence (default 5, max 20)
  --max-files <n>       Limit files analyzed by review (default 20, max 100)
  --help, -h            Show help
  --version, -v         Show version

Authentication:
  Set GITHUB_TOKEN or GH_TOKEN for private repositories and higher API limits.
  BlameTrail never accepts tokens as command-line arguments.
`;
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`blametrail: ${message}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map