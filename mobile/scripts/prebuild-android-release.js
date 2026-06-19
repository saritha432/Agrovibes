#!/usr/bin/env node
/** Release Android prebuild — excludes dev client and applies lean native config. */
const { execSync } = require("node:child_process");
const path = require("node:path");

process.env.EAS_BUILD_PROFILE = "preview";
require("./eas-build-pre-install");

execSync("npx expo prebuild --platform android --clean", {
  stdio: "inherit",
  cwd: path.resolve(__dirname, "..")
});
