exports.default = async function(configuration) {
    // Completely skip code signing to prevent signtool from hanging.
    console.log("Skipping code signing for: " + configuration.path);
    return true;
};
