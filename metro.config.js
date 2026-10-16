// Metro config. The only customisation is for `npx expo start --web` (UI review).
//
// On web, `expo-sqlite` is swapped for preview/web/expo-sqlite-web.js, a sql.js
// adapter. expo-sqlite's own web build needs SharedArrayBuffer, i.e. a
// cross-origin-isolated page, which Expo's dev server doesn't provide for the
// HTML document. It also can't work inside an iframe preview, so the app hung
// on its splash screen. Android/iOS resolve the real expo-sqlite, unchanged.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const WEB_SQLITE_SHIM = path.resolve(__dirname, 'preview/web/expo-sqlite-web.js');
// sql.js' asm build has a Node-only branch that requires these built-ins.
const NODE_ONLY_IN_SQLJS = new Set(['fs', 'path', 'crypto']);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'expo-sqlite') {
      return { type: 'sourceFile', filePath: WEB_SQLITE_SHIM };
    }
    if (NODE_ONLY_IN_SQLJS.has(moduleName) && /[\\/]sql\.js[\\/]/.test(context.originModulePath)) {
      return { type: 'empty' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
