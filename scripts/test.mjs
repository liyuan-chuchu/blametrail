import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = new URL("../dist/", import.meta.url);
const directoryPath = fileURLToPath(directory);
const tests = (await readdir(directory))
  .filter((entry) => entry.endsWith(".test.js"))
  .sort()
  .map((entry) => path.join(directoryPath, entry));

if (tests.length === 0) {
  console.error("No compiled test files were found in dist/.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...tests], {
    stdio: "inherit",
  });

  process.exitCode = result.status ?? 1;
}
