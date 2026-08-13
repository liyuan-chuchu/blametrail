import assert from "node:assert/strict";
import test from "node:test";
import { detectRiskFlags, parseBlamePorcelain, parseGitHubRemote, parseTarget } from "./git.js";

test("parseTarget accepts a line range", () => {
  assert.deepEqual(parseTarget("src/auth.ts:42-45"), {
    file: "src/auth.ts",
    startLine: 42,
    endLine: 45,
  });
});

test("parseTarget preserves a Windows drive path", () => {
  assert.deepEqual(parseTarget("C:\\repo\\src\\auth.ts:7"), {
    file: "C:/repo/src/auth.ts",
    startLine: 7,
    endLine: 7,
  });
});

test("parseBlamePorcelain groups lines by commit", () => {
  const first = "a".repeat(40);
  const second = "b".repeat(40);
  const output = `${first} 1 10 2\nauthor Ada\n\tline one\n${first} 2 11\nauthor Ada\n\tline two\n${second} 3 12 1\nauthor Lin\n\tline three`;
  assert.deepEqual(parseBlamePorcelain(output), [
    { sha: first, startLine: 10, endLine: 11 },
    { sha: second, startLine: 12, endLine: 12 },
  ]);
});

test("parseGitHubRemote handles HTTPS, SCP, and SSH URLs", () => {
  const expected = { owner: "openai", repo: "codex" };
  assert.deepEqual(parseGitHubRemote("https://github.com/openai/codex.git"), expected);
  assert.deepEqual(parseGitHubRemote("git@github.com:openai/codex.git"), expected);
  assert.deepEqual(parseGitHubRemote("ssh://git@github.com/openai/codex.git"), expected);
});

test("risk detection finds historical landmines", () => {
  assert.deepEqual(
    detectRiskFlags("Revert temporary workaround for security regression and latency bug"),
    ["revert", "security", "regression", "workaround", "performance", "bug-fix"],
  );
});
