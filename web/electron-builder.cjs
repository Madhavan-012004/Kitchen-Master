// electron-builder.cjs — JS config that merges with package.json "build" block
// The only purpose of this file is to provide a custom `sign` function
// that completely skips Windows code-signing so the build doesn't hang.

const packageJson = require('./package.json');

module.exports = {
    ...packageJson.build,
    // Override the sign function to skip code signing entirely
    win: {
        ...packageJson.build.win,
        sign: async () => {
            // no-op: skip all signtool calls
        },
        signAndEditExecutable: false,
    },
};
