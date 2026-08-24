const { withAppBuildGradle, withGradleProperties } = require("@expo/config-plugins");

const CMAKE_PAGE_SIZE_FLAG = "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON";
const LINKER_PAGE_SIZE_FLAG = "-Wl,-z,max-page-size=16384";
const NDK_R28 = "28.2.13676358";

/**
 * Google Play requires 16 KB ELF/zip alignment for native .so files.
 * NDK r28 defaults to 16 KB; these flags also cover CMake/ndk-build libs
 * compiled during the app build. Expo SDK 53 / RN 0.79 core libs are
 * 16 KB-aligned; third-party .so files still need these NDK/linker flags.
 */
function withAndroid16KbPageSize(config) {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const setProp = (key, value) => {
      const existing = props.find((item) => item.type === "property" && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: "property", key, value });
      }
    };
    setProp("android.ndkVersion", NDK_R28);
    setProp("android.native.buildOutput", "verbose");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes("ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES")) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "${CMAKE_PAGE_SIZE_FLAG}", "-DCMAKE_SHARED_LINKER_FLAGS=${LINKER_PAGE_SIZE_FLAG}"
            }
            ndkBuild {
                arguments "APP_SUPPORT_FLEXIBLE_PAGE_SIZES=true"
            }
        }`
      );
    }
    if (!contents.includes("jniLibs.useLegacyPackaging")) {
      if (/packagingOptions\s*\{/.test(contents)) {
        contents = contents.replace(
          /packagingOptions\s*\{/,
          `packagingOptions {
        jniLibs {
            useLegacyPackaging false
        }`
        );
      } else if (/android\s*\{/.test(contents)) {
        contents = contents.replace(
          /android\s*\{/,
          `android {
    packaging {
        jniLibs {
            useLegacyPackaging false
        }
    }`
        );
      }
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroid16KbPageSize;
