import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testDirectories = ["tests/chromium", "tests/firefox"];
const testFiles = (await Promise.all(testDirectories.map(async (directory) => (
  (await readdir(resolve(root, directory)))
    .filter((file) => file.endsWith(".test.js"))
    .map((file) => resolve(root, directory, file))
)))).flat();

const child = spawn(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });
child.on("exit", (code) => process.exitCode = code ?? 1);
