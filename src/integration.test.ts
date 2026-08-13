import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { analyzeExplain } from "./analyze.js";

const execFileAsync = promisify(execFile);

test("offline explain returns local commit evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blametrail-"));
  try {
    await git(root, ["init"]);
    await git(root, ["config", "user.name", "Test Maintainer"]);
    await git(root, ["config", "user.email", "maintainer@example.test"]);
    await writeFile(path.join(root, "auth.ts"), "export const cache = new Map();\n", "utf8");
    await git(root, ["add", "auth.ts"]);
    await git(root, ["commit", "-m", "fix race condition with a compatibility cache"]);

    const report = await analyzeExplain(
      { file: "auth.ts", startLine: 1, endLine: 1 },
      { cwd: root, offline: true, maxCommits: 5, maxFiles: 20 },
    );
    assert.equal(report.commits.length, 1);
    assert.match(report.commits[0]?.subject ?? "", /race condition/);
    assert.deepEqual(report.commits[0]?.flags, ["security", "compatibility", "bug-fix"]);
    assert.match(report.warnings[0] ?? "", /Offline mode/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd, windowsHide: true });
}
