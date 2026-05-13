/* Metro config — stable defaults for Expo (also helps avoid Windows path quirks in tooling). */
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
