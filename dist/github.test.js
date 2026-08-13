import assert from "node:assert/strict";
import test from "node:test";
import { extractIssueReferences, parseRepository } from "./github.js";
test("extractIssueReferences keeps evidence-backed issue references", () => {
    const body = "Fixes #42. Resolves owner/repo#7. See issue #99 and https://github.com/acme/app/issues/12";
    assert.deepEqual(extractIssueReferences(body), [7, 12, 42, 99]);
});
test("parseRepository requires owner/name", () => {
    assert.deepEqual(parseRepository("openai/codex.git"), { owner: "openai", repo: "codex" });
    assert.throws(() => parseRepository("codex"), /owner\/name/);
});
//# sourceMappingURL=github.test.js.map