const { withAndroidColors, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
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
const LIB_HANDLER = path.join(
  "node_modules",
  "react-native-full-screen-notification-incoming-call",
  "android",
  "src",
  "main",
  "java",
  "com",
  "reactnativefullscreennotificationincomingcall",
  "NotificationReceiverHandler.java"
);

const PATCH_MARKER = "CROPVIBE_CALL_BRAND_PATCH";

function patchIncomingCallService(contents) {
  if (!contents.includes(PATCH_MARKER)) {
    contents = contents.replace(
      "private int getColorForResourceName(Context context, String colorPath) {\n // java",
      `private int getColorForResourceName(Context context, String colorPath) {\n // ${PATCH_MARKER}\n if (colorPath != null && colorPath.startsWith("#")) {\n return Color.parseColor(colorPath);\n }\n // java`
    );
  }

  // Branded vector icons cannot be decoded with BitmapFactory — use IconCompat.createWithResource.
  const legacyActions =
    'IconCompat.createWithBitmap(BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_decline))';
  if (contents.includes(legacyActions)) {
    contents = contents.replace(
      /NotificationCompat\.Action declineAction = new NotificationCompat\.Action\.Builder\(IconCompat\.createWithBitmap\(BitmapFactory\.decodeResource\(context\.getResources\(\), R\.drawable\.ic_decline\)\),\s*bundle\.getString\("declineText"\),\s*onButtonNotificationClick\(0, Constants\.ACTION_PRESS_DECLINE_CALL, Constants\.RNNotificationEndCallAction\)\)\.build\(\);\s*NotificationCompat\.Action answerAction = new NotificationCompat\.Action\.Builder\(IconCompat\.createWithBitmap\(BitmapFactory\.decodeResource\(context\.getResources\(\), R\.drawable\.ic_answer\)\),\s*bundle\.getString\("answerText"\),\s*onButtonNotificationClick\(0, Constants\.ACTION_PRESS_ANSWER_CALL, Constants\.RNNotificationAnswerAction\)\)\.build\(\);/s,
      `// ${PATCH_MARKER}: vector drawables\n    NotificationCompat.Action declineAction = new NotificationCompat.Action.Builder(IconCompat.createWithResource(context, R.drawable.ic_decline),\n        bundle.getString("declineText", "Decline"),\n        onButtonNotificationClick(0, Constants.ACTION_PRESS_DECLINE_CALL, Constants.RNNotificationEndCallAction)).build();\n\n    NotificationCompat.Action answerAction = new NotificationCompat.Action.Builder(IconCompat.createWithResource(context, R.drawable.ic_answer),\n        bundle.getString("answerText", "Answer"),\n        onButtonNotificationClick(1, Constants.ACTION_PRESS_ANSWER_CALL, Constants.RNNotificationAnswerAction)).build();`
    );
  }

  // Undo prior patch that forced pre-Android-12 action buttons on all API levels.
  contents = contents.replace(
    `if (false && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // ${PATCH_MARKER}: use branded action icons`,
    "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {"
  );

  return contents;
}

function patchNotificationReceiverHandler(contents) {
  if (contents.includes(`${PATCH_MARKER}_NULL_ACTION`)) {
    return contents;
  }

  return contents.replace(
    "String action= intent.getAction();\n    switch (action) {",
    `String action = intent.getAction();\n    if (action == null) return; // ${PATCH_MARKER}_NULL_ACTION\n    switch (action) {`
  );
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
  const handlerPath = path.join(projectRoot, LIB_HANDLER);
  if (fs.existsSync(handlerPath)) {
    const next = patchNotificationReceiverHandler(fs.readFileSync(handlerPath, "utf8"));
    fs.writeFileSync(handlerPath, next);
  }
  copyBrandedCallIcons(projectRoot);
}

module.exports = function withIncomingCallBrandColors(config) {
  config = withAndroidColors(config, (modConfig) => {
    AndroidConfig.Colors.assignColorValue(modConfig.modResults, {
      name: "cropvibe_call_accent",
      value: "#C9FF35"
    });
    AndroidConfig.Colors.assignColorValue(modConfig.modResults, {
      name: "cropvibe_call_decline",
      value: "#E53935"
    });
    return modConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      applyCallBrandPatch(config.modRequest.projectRoot);
      return config;
    }
  ]);
};
