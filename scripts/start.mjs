import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || "10000";
const standaloneServer = path.resolve(process.cwd(), ".next", "standalone", "server.js");
const nextBin = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const childArgs = existsSync(standaloneServer)
  ? [standaloneServer]
  : [nextBin, "start", "-H", host, "-p", port];

console.log(`[start] Booting Next.js on ${host}:${port}`);

const child = spawn(process.execPath, childArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: host,
    HOSTNAME: host,
    PORT: port
  },
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error("[start] Failed to launch Next.js", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
