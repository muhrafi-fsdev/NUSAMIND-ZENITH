import fs from "node:fs";
import { spawnSync } from "node:child_process";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const checks = [
  ["release version", pkg.version === "1.4.1"],
  ["native alias", String(pkg.devDependencies?.["@typescript/native"] || "").includes("typescript@^7.0.2")],
  ["compatibility alias", String(pkg.devDependencies?.typescript || "").includes("@typescript/typescript6")],
  ["native check", pkg.scripts?.check === "tsc --noEmit"],
  ["legacy check", pkg.scripts?.["check:legacy"] === "tsc6 --noEmit"],
  ["dual check", Boolean(pkg.scripts?.["check:dual"])],
  ["migration documentation", fs.existsSync("docs/typescript-7-n1.4.1.md")],
  ["stale lock removed", !fs.existsSync("package-lock.json")],
];
for (const [name, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`RESULT ${checks.length-failed.length}/${checks.length}`);
process.exit(failed.length ? 1 : 0);
