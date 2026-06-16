import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const nextBin = "./node_modules/next/dist/bin/next";
const args = [nextBin, "build"];

if (isWindows) {
  args.push("--experimental-build-mode", "compile");
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit"
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);
