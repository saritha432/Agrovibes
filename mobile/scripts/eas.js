#!/usr/bin/env node
/* eslint-disable */
/**
 * Thin wrapper around `eas` that forces the file-based archive workflow
 * (EAS_NO_VCS=1) and pins the archive root to this app folder.
 * EAS CLI may otherwise walk up to the git repo root and upload the whole
 * monorepo (backend + mobile), producing multi‑GB archives. Use an absolute
 * EAS_PROJECT_ROOT — relative paths are unreliable in monorepos (eas-cli#2938).
 *
 * Usage examples (from mobile/):
 *   node scripts/eas.js build --platform android --profile preview
 *   node scripts/eas.js build --platform ios --profile preview
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

process.env.EAS_NO_VCS = "1";
process.env.EAS_PROJECT_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const isWindows = process.platform === "win32";
const bin = isWindows ? "eas.cmd" : "eas";

const child = spawn(bin, args, {
  stdio: "inherit",
  shell: isWindows,
  env: process.env,
  cwd: path.resolve(__dirname, ".."),
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
