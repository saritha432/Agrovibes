const { withDangerousMod, withAppBuildGradle } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const CHANNEL_META = "com.google.firebase.messaging.default_notification_channel_id";
const COLOR_META = "com.google.firebase.messaging.default_notification_color";

function patchMetaDataTag(contents, metaName, replaceAttr) {
  const nameNeedle = `android:name="${metaName}"`;
  const nameIndex = contents.indexOf(nameNeedle);
  if (nameIndex === -1) {
    return contents;
  }

  const tagStart = contents.lastIndexOf("<meta-data", nameIndex);
  const tagEnd = contents.indexOf("/>", nameIndex);
  if (tagStart === -1 || tagEnd === -1) {
    return contents;
  }

  const tag = contents.slice(tagStart, tagEnd + 2);
  if (tag.includes("tools:replace")) {
    return contents;
  }

  const patchedTag = tag.replace("/>", ` tools:replace="${replaceAttr}"/>`);
  return contents.slice(0, tagStart) + patchedTag + contents.slice(tagEnd + 2);
}

function patchManifestContents(contents) {
  if (!contents.includes('xmlns:tools="http://schemas.android.com/tools"')) {
    contents = contents.replace(
      "<manifest ",
      '<manifest xmlns:tools="http://schemas.android.com/tools" '
    );
  }

  if (!contents.includes(CHANNEL_META)) {
    contents = contents.replace(
      /<application([^>]*)>/,
      `<application$1>\n    <meta-data android:name="${CHANNEL_META}" android:value="default" tools:replace="android:value"/>`
    );
  } else {
    contents = patchMetaDataTag(contents, CHANNEL_META, "android:value");
  }

  return patchMetaDataTag(contents, COLOR_META, "android:resource");
}

async function patchManifestFile(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const contents = await fs.promises.readFile(manifestPath, "utf8");
  const patched = patchManifestContents(contents);
  if (patched !== contents) {
    await fs.promises.writeFile(manifestPath, patched);
  }
}

const GRADLE_PATCH_MARKER = "// @generated withFcmManifestMergeFix";
const GRADLE_PATCH_BLOCK = `
${GRADLE_PATCH_MARKER}
tasks.configureEach { task ->
    if (task.name == "processReleaseMainManifest" || task.name == "processDebugMainManifest") {
        task.doFirst {
            def manifestFile = file("src/main/AndroidManifest.xml")
            if (!manifestFile.exists()) {
                return
            }
            def contents = manifestFile.getText("UTF-8")
            def channelMeta = 'android:name="com.google.firebase.messaging.default_notification_channel_id"'
            def colorMeta = 'android:name="com.google.firebase.messaging.default_notification_color"'
            if (!contents.contains('xmlns:tools')) {
                contents = contents.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ')
            }
            if (!contents.contains(channelMeta)) {
                contents = contents.replace(
                    /<application([^>]*)>/,
                    '<application$1>\\n    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="default" tools:replace="android:value"/>'
                )
            } else {
                contents = patchFcmMeta(contents, channelMeta, "android:value")
            }
            contents = patchFcmMeta(contents, colorMeta, "android:resource")
            manifestFile.write(contents, "UTF-8")
        }
    }
}

def patchFcmMeta(String contents, String nameNeedle, String replaceAttr) {
    def nameIndex = contents.indexOf(nameNeedle)
    if (nameIndex < 0) {
        return contents
    }
    def tagStart = contents.lastIndexOf('<meta-data', nameIndex)
    def tagEnd = contents.indexOf('/>', nameIndex)
    if (tagStart < 0 || tagEnd < 0) {
        return contents
    }
    def tag = contents.substring(tagStart, tagEnd + 2)
    if (tag.contains('tools:replace')) {
        return contents
    }
    def patchedTag = tag.replace('/>', ' tools:replace="' + replaceAttr + '"/>')
    return contents.substring(0, tagStart) + patchedTag + contents.substring(tagEnd + 2)
}
`;

/** Resolve manifest merger conflicts between expo-notifications and @react-native-firebase/messaging. */
module.exports = function withFcmManifestMergeFix(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      await patchManifestFile(
        path.join(cfg.modRequest.platformProjectRoot, "app/src/main/AndroidManifest.xml")
      );
      return cfg;
    }
  ]);

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      return cfg;
    }
    if (!cfg.modResults.contents.includes(GRADLE_PATCH_MARKER)) {
      cfg.modResults.contents += GRADLE_PATCH_BLOCK;
    }
    return cfg;
  });
};
