const { withDangerousMod } = require("@expo/config-plugins");
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

/** Resolve manifest merger conflicts between expo-notifications and @react-native-firebase/messaging. */
module.exports = function withFirebaseMessagingManifestMergeFix(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/AndroidManifest.xml"
      );
      let contents = await fs.promises.readFile(manifestPath, "utf8");

      if (!contents.includes('xmlns:tools="http://schemas.android.com/tools"')) {
        contents = contents.replace(
          "<manifest ",
          '<manifest xmlns:tools="http://schemas.android.com/tools" '
        );
      }

      contents = patchMetaDataTag(contents, CHANNEL_META, "android:value");
      contents = patchMetaDataTag(contents, COLOR_META, "android:resource");

      await fs.promises.writeFile(manifestPath, contents);
      return cfg;
    }
  ]);
};
