import { appendFile, readFile } from "node:fs/promises";
import { analyzeReview } from "./analyze.js";
import { formatReport } from "./format.js";
import { parseRepository } from "./github.js";

interface PullRequestEvent {
  number?: number;
  repository?: { full_name?: string };
}

async function main(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let event: PullRequestEvent = {};
  if (eventPath) event = JSON.parse(await readFile(eventPath, "utf8")) as PullRequestEvent;

  const inputNumber = process.env.INPUT_PR_NUMBER?.trim();
  const number = inputNumber ? Number.parseInt(inputNumber, 10) : event.number;
  if (!number) throw new Error("No pull request number was provided or found in the event payload.");

  const repositoryName = process.env.GITHUB_REPOSITORY ?? event.repository?.full_name;
  if (!repositoryName) throw new Error("GITHUB_REPOSITORY is not available.");
  const token = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const report = await analyzeReview(number, {
    cwd: workspace,
    offline: false,
    repository: parseRepository(repositoryName),
    maxCommits: boundedInput("INPUT_MAX_COMMITS", 5, 1, 20),
    maxFiles: boundedInput("INPUT_MAX_FILES", 20, 1, 100),
    ...(token ? { token } : {}),
  });
  const markdown = formatReport(report, "markdown");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, "utf8");
  } else {
    process.stdout.write(`${markdown}\n`);
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `report<<BLAMETRAIL_EOF\n${markdown}\nBLAMETRAIL_EOF\n`, "utf8");
  }
}

function boundedInput(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`::error title=BlameTrail failed::${message.replaceAll("\n", "%0A")}\n`);
  process.exitCode = 1;
});
