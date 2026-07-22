// Expo's default Metro config detects the pnpm workspace and watches the
// shared packages (content/types/ui tokens) automatically.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
