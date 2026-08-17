// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads its SQLite engine as a .wasm
// asset (see docs.expo.dev/versions/latest/sdk/sqlite/#web-setup) — Metro
// doesn't treat that extension as an asset by default. Getting SQLite
// fully working on `expo start --web` also needs the page's top-level
// document response to carry Cross-Origin-Opener-Policy/
// Cross-Origin-Embedder-Policy headers (for SharedArrayBuffer), which
// isn't reachable from a plain metro.config.js — `server.enhanceMiddleware`
// only wraps Metro's own bundle-serving middleware, not Expo CLI's static
// document handler that answers the initial page load. expo-sqlite's web
// support is documented as alpha; this app's real target is Expo Go on a
// phone, so that gap is left as a known web-preview-only limitation
// rather than patching Expo CLI internals.
config.resolver.assetExts.push("wasm");

module.exports = config;
