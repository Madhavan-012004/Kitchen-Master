const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'mjs' to resolver
config.resolver.sourceExts.push('mjs');

// To fix import.meta error we force all modules (even node_modules)
// to go through our Babel configuration containing `babel-plugin-transform-import-meta`
const { transformer } = config;
config.transformer = {
    ...transformer,
    getTransformOptions: async () => ({
        transform: {
            experimentalImportSupport: false,
            inlineRequires: true,
        },
    }),
};

// Expo SDK 50+ fix for engine.io-client / socket.io-client import.meta
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
