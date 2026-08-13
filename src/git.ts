import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CommitEvidence, RepositoryRef, RiskFlag, TargetSpec } from "./types.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 16 * 1024 * 1024;

export async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
    return stdout.trimEnd();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args[0] ?? "command"} failed: ${detail}`);
  }
}

export async function findRepositoryRoot(cwd: string): Promise<string> {
  return path.resolve(await runGit(["rev-parse", "--show-toplevel"], cwd));
}

export function parseTarget(value: string): TargetSpec {
  const match = value.match(/^(.*):(\d+)(?:-(\d+))?$/);
  if (!match?.[1] || !match[2]) {
    throw new Error("Target must use the form path/to/file:line or path/to/file:start-end.");
  }

  const startLine = Number.parseInt(match[2], 10);
  const endLine = match[3] ? Number.parseInt(match[3], 10) : startLine;
  if (startLine < 1 || endLine < startLine) {
    throw new Error("Target line range is invalid.");
  }

  return {
    file: match[1].replaceAll("\\", "/"),
    startLine,
    endLine,
  };
}

export async function validateTarget(root: string, target: TargetSpec): Promise<TargetSpec> {
  const absolute = path.resolve(root, target.file);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Target must stay inside the Git repository.");
  }
  await access(absolute);
  return { ...target, file: relative.replaceAll("\\", "/") };
}

interface BlamedRange {
  sha: string;
  startLine: number;
  endLine: number;
}

export function parseBlamePorcelain(output: string): BlamedRange[] {
  const ranges = new Map<string, BlamedRange>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\^?([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/i);
    if (!match?.[1] || !match[2] || /^0+$/.test(match[1])) continue;
    const sha = match[1];
    const finalLine = Number.parseInt(match[2], 10);
    const current = ranges.get(sha);
    if (current) {
      current.startLine = Math.min(current.startLine, finalLine);
      current.endLine = Math.max(current.endLine, finalLine);
    } else {
      ranges.set(sha, { sha, startLine: finalLine, endLine: finalLine });
    }
  }
  return [...ranges.values()].sort((a, b) => a.startLine - b.startLine);
}

export async function blameTarget(root: string, target: TargetSpec): Promise<BlamedRange[]> {
  const output = await runGit(
    ["blame", "--line-porcelain", `-L${target.startLine},${target.endLine}`, "--", target.file],
    root,
  );
  const ranges = parseBlamePorcelain(output);
  if (ranges.length === 0) throw new Error("No committed history was found for the selected lines.");
  return ranges;
}

export function detectRiskFlags(text: string): RiskFlag[] {
  const patterns: Array<[RiskFlag, RegExp]> = [
    ["revert", /\b(revert(?:ed|ing)?|rollback|backout)\b/i],
    ["security", /\b(security|vulnerab(?:ility|le)|cve|xss|csrf|injection|auth(?:n|z)?)\b/i],
    ["regression", /\b(regression|regressed|breakage|broke again)\b/i],
    ["workaround", /\b(workaround|work-around|hack|temporary fix|hotfix)\b/i],
    ["compatibility", /\b(compatib(?:ility|le)|legacy|backward|migration)\b/i],
    ["performance", /\b(performance|latency|slow|faster|optimi[sz]|memory leak)\b/i],
    ["bug-fix", /\b(fix(?:ed|es|ing)?|bug|race|deadlock|crash|incorrect|failure)\b/i],
  ];
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([flag]) => flag);
}

function parseLogRecord(record: string): Omit<CommitEvidence, "file" | "diffExcerpt" | "flags"> | undefined {
  const fields = record.replace(/^\n+/, "").split("\x1f");
  const [sha, shortSha, author, authoredAt, message] = fields;
  if (!sha || !shortSha || !author || !authoredAt || message === undefined) return undefined;
  const normalizedMessage = message.trim();
  return {
    sha,
    shortSha,
    author,
    authoredAt,
    subject: normalizedMessage.split(/\r?\n/, 1)[0] ?? normalizedMessage,
    message: normalizedMessage,
  };
}

export async function getCommitEvidence(
  root: string,
  sha: string,
  file: string,
  lines?: { startLine: number; endLine: number },
): Promise<CommitEvidence> {
  const metadata = await runGit(
    ["show", "-s", "--format=%H%x1f%h%x1f%an%x1f%aI%x1f%B", sha],
    root,
  );
  const parsed = parseLogRecord(metadata);
  if (!parsed) throw new Error(`Could not parse commit ${sha}.`);
  const diff = await runGit(
    ["show", "--format=", "--no-ext-diff", "--find-renames", "--unified=3", sha, "--", file],
    root,
  );
  const result: CommitEvidence = {
    ...parsed,
    file,
    diffExcerpt: truncate(diff, 12_000),
    flags: detectRiskFlags(parsed.message),
  };
  if (lines) {
    result.startLine = lines.startLine;
    result.endLine = lines.endLine;
  }
  return result;
}

export async function getFileHistory(
  root: string,
  file: string,
  maxCount: number,
): Promise<CommitEvidence[]> {
  try {
    const output = await runGit(
      [
        "log",
        "--follow",
        `--max-count=${maxCount}`,
        "--format=%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%B",
        "--",
        file,
      ],
      root,
    );
    const commits: CommitEvidence[] = [];
    for (const record of output.split("\x1e")) {
      const parsed = parseLogRecord(record);
      if (!parsed) continue;
      commits.push({
        ...parsed,
        file,
        diffExcerpt: "",
        flags: detectRiskFlags(parsed.message),
      });
    }
    return commits;
  } catch {
    return [];
  }
}

export async function getOriginRemote(root: string): Promise<string | undefined> {
  try {
    return await runGit(["remote", "get-url", "origin"], root);
  } catch {
    return undefined;
  }
}

export function parseGitHubRemote(remote: string): RepositoryRef | undefined {
  const normalized = remote.trim().replace(/\.git$/, "");
  const scpMatch = normalized.match(/^git@github\.com:([^/]+)\/(.+)$/i);
  if (scpMatch?.[1] && scpMatch[2]) return { owner: scpMatch[1], repo: scpMatch[2] };

  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return undefined;
    const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
    return owner && repo ? { owner, repo } : undefined;
  } catch {
    return undefined;
  }
}

export function attachCommitUrls(commits: CommitEvidence[], repository?: RepositoryRef): CommitEvidence[] {
  if (!repository) return commits;
  return commits.map((commit) => ({
    ...commit,
    url: `https://github.com/${repository.owner}/${repository.repo}/commit/${commit.sha}`,
  }));
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n… [truncated]`;
}
