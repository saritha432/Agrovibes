const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TARGET =
  "node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt";

const REPLACEMENTS = [
  [
    "if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeLast()",
    "if (drawingOpPool.isEmpty()) DrawingOp() else drawingOpPool.removeAt(drawingOpPool.lastIndex)",
  ],
  [
    "drawingOpPool.removeLast()",
    "drawingOpPool.removeAt(drawingOpPool.lastIndex)",
  ],
];

/**
 * compileSdk 35: Kotlin resolves removeLast() to JDK List API, which is absent on
 * Android 14 and below. react-native-screens < 3.33 crashes during screen draw.
 * Remove when react-native-screens is upgraded and verified on API 34 devices.
 */
function withRnScreensApi35Fix(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = path.join(cfg.modRequest.projectRoot, TARGET);
      if (!fs.existsSync(file)) {
        return cfg;
      }
      let content = fs.readFileSync(file, "utf8");
      for (const [oldText, newText] of REPLACEMENTS) {
        if (content.includes(oldText) && !content.includes(newText)) {
          content = content.replaceAll(oldText, newText);
        }
      }
      fs.writeFileSync(file, content);
      return cfg;
    },
  ]);
}

module.exports = withRnScreensApi35Fix;
