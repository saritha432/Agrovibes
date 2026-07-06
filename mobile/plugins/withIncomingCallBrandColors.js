const { withAndroidColors, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LIB_JAVA = path.join(
  "node_modules",
  "react-native-full-screen-notification-incoming-call",
  "android",
  "src",
  "main",
  "java",
  "com",
  "reactnativefullscreennotificationincomingcall",
  "IncomingCallService.java"
);

const LIB_DRAWABLE = path.join(
  "node_modules",
  "react-native-full-screen-notification-incoming-call",
  "android",
  "src",
  "main",
  "res",
  "drawable"
);

const ASSET_DIR = path.join(__dirname, "call-notification");
const PATCH_MARKER = "CROPVIBE_CALL_BRAND_PATCH";

function patchIncomingCallService(contents) {
  if (contents.includes(PATCH_MARKER)) {
    return contents;
  }

  contents = contents.replace(
    "private int getColorForResourceName(Context context, String colorPath) {\n // java",
    `private int getColorForResourceName(Context context, String colorPath) {\n // ${PATCH_MARKER}\n if (colorPath != null && colorPath.startsWith("#")) {\n return Color.parseColor(colorPath);\n }\n // java`
  );

  contents = contents.replace(
    "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {",
    `if (false && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // ${PATCH_MARKER}: use branded action icons`
  );

  return contents;
}

function copyBrandedCallIcons(projectRoot) {
  const targetDir = path.join(projectRoot, LIB_DRAWABLE);
  if (!fs.existsSync(targetDir)) {
    return;
  }

  for (const name of ["ic_answer.xml", "ic_decline.xml"]) {
    const source = path.join(ASSET_DIR, name);
    const target = path.join(targetDir, name);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
    }
  }

  for (const legacy of ["ic_answer.png", "ic_decline.png"]) {
    const legacyPath = path.join(targetDir, legacy);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
  }
}

function applyCallBrandPatch(projectRoot) {
  const javaPath = path.join(projectRoot, LIB_JAVA);
  if (fs.existsSync(javaPath)) {
    const next = patchIncomingCallService(fs.readFileSync(javaPath, "utf8"));
    fs.writeFileSync(javaPath, next);
  }
  copyBrandedCallIcons(projectRoot);
}

module.exports = function withIncomingCallBrandColors(config) {
  config = withAndroidColors(config, {
    cropvibe_call_accent: "#C9FF35",
    cropvibe_call_decline: "#E53935"
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      applyCallBrandPatch(config.modRequest.projectRoot);
      return config;
    }
  ]);
};
