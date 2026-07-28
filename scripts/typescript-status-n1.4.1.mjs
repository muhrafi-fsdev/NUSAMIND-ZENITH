import { spawnSync } from "node:child_process";

function version(command) {
  const r = spawnSync(command, ["--version"], { encoding: "utf8", shell: true });
  return { ok: r.status === 0, output: (r.stdout || r.stderr || "").trim() };
}

const native = version("tsc");
const legacy = version("tsc6");
console.log(JSON.stringify({
  release: "N1.4.1",
  primaryCompiler: "TypeScript 7 native",
  native,
  compatibilityCompiler: "TypeScript 6",
  legacy,
  dualCheckReady: native.ok && legacy.ok
}, null, 2));
process.exit(native.ok && legacy.ok ? 0 : 1);
