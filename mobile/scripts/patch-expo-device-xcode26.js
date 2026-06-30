#!/usr/bin/env node
/**
 * Xcode 26 removes TARGET_OS_SIMULATOR from Swift. expo-device@6 still uses it.
 */
const fs = require("fs");
const path = require("path");

const swiftPath = path.join(__dirname, "..", "node_modules", "expo-device", "ios", "UIDevice.swift");
if (!fs.existsSync(swiftPath)) {
  process.exit(0);
}

const oldBlock = "  var isSimulator: Bool {\n    return TARGET_OS_SIMULATOR != 0\n  }";
const newBlock = `  var isSimulator: Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }`;

const swift = fs.readFileSync(swiftPath, "utf8");
if (swift.includes(oldBlock) && !swift.includes("targetEnvironment(simulator)")) {
  fs.writeFileSync(swiftPath, swift.replace(oldBlock, newBlock));
  // eslint-disable-next-line no-console
  console.log("[patch-expo-device-xcode26] applied UIDevice.swift fix");
}
