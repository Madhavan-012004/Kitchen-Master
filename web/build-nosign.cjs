// build-nosign.cjs — Custom build script that skips code signing and avoids EBUSY using robocopy
const builder = require("electron-builder");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const pkg = require("./package.json");

// ── Step 1: Kill any running Java processes that may be locking the JAR ────
function killJavaProcesses() {
    console.log("🔪 Stopping any running Java/backend processes...");
    try {
        execSync("taskkill /F /IM java.exe /T", { stdio: "pipe" });
        console.log("   ✓ Java processes stopped.");
    } catch (e) {
        console.log("   ℹ No Java processes were running.");
    }
    const start = Date.now();
    while (Date.now() - start < 1500) { /* busy-wait 1.5s */ }
}

// ── Robust copy for single file with rename and retries ────
async function copyFileWithRetries(src, dest, retries = 5, delayMs = 1000) {
    console.log(`   Copying single file: ${path.basename(src)} -> ${path.basename(dest)}...`);
    for (let i = 0; i < retries; i++) {
        try {
            fs.copyFileSync(src, dest);
            return;
        } catch (err) {
            if (err.code === "EBUSY" || err.code === "EPERM") {
                console.warn(`   ⚠ File locked (${err.code}), retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(res => setTimeout(res, delayMs));
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Failed to copy file after ${retries} retries: ${src}`);
}

// ── Robust directory copy with robocopy (handles Windows Defender locks) ────
function robustCopy(src, dest, isDir = true) {
    console.log(`   Copying: ${path.basename(src)}...`);
    try {
        if (isDir) {
            execSync(`robocopy "${src}" "${dest}" /E /R:5 /W:2 /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: "pipe" });
        } else {
            const srcDir = path.dirname(src);
            const fileName = path.basename(src);
            execSync(`robocopy "${srcDir}" "${dest}" "${fileName}" /R:5 /W:2 /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: "pipe" });
        }
    } catch (err) {
        // Robocopy exit codes: 1, 2, 3 are success/skip codes. 4+ means failure.
        if (err.status >= 4) {
            throw new Error(`Robocopy failed with exit code ${err.status} for ${src}`);
        }
    }
}

// ── Build config ────────────────────────────────────────────────────────────
const config = JSON.parse(JSON.stringify(pkg.build));
config.win = config.win || {};
config.win.signAndEditExecutable = false;
config.win.verifyUpdateCodeSignature = false;
config.forceCodeSigning = false;
config.directories = config.directories || {};
config.directories.output = path.join(__dirname, "dist-electron");

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    killJavaProcesses();

    const outDir = path.join(__dirname, "dist-electron");
    if (fs.existsSync(outDir)) {
        console.log("🗑  Moving old dist-electron to avoid EPERM locks...");
        try {
            fs.renameSync(outDir, outDir + "-old-" + Date.now());
        } catch (e) {
            console.warn("   ⚠ Could not rename dist-electron, trying to clean inside it...");
            try {
                fs.rmSync(outDir, { recursive: true, force: true });
            } catch(e2) {
                console.warn("   ⚠ Failed to clean dist-electron. Assuming it's safe to overwrite.");
            }
        }
    }

    console.log("\n🚀 Stage 1: Building unpacked app (dir)...");
    await builder.build({
        projectDir: __dirname,
        targets: builder.Platform.WINDOWS.createTarget("dir", builder.Arch.x64),
        config: config,
        publish: "never",
    });

    console.log("\n📦 Stage 1.5: Injecting extra resources safely using robocopy...");
    const resDir = path.join(outDir, "win-unpacked", "resources");
    
    // Copy the JAR and rename it to exactly backend2.jar
    await copyFileWithRetries(
        path.join(__dirname, "..", "api", "target", "backend2-1.0.0.jar"),
        path.join(resDir, "backend2.jar")
    );

    // Copy the heavy directories with robocopy
    robustCopy(path.join(__dirname, "jre"), path.join(resDir, "jre"), true);
    robustCopy(path.join(__dirname, "pgsql"), path.join(resDir, "pgsql"), true);
    robustCopy(path.join(__dirname, "python"), path.join(resDir, "python"), true);

    // Copy app icon for BrowserWindow
    await copyFileWithRetries(
        path.join(__dirname, "build", "icon.png"),
        path.join(resDir, "app-icon.png")
    );

    console.log("\n🚀 Stage 2: Packaging NSIS installer...");
    await builder.build({
        projectDir: __dirname,
        prepackaged: path.join(outDir, "win-unpacked"),
        targets: builder.Platform.WINDOWS.createTarget("nsis", builder.Arch.x64),
        config: config,
        publish: "never",
    });

    console.log("\n✅ Build complete!");
    console.log("   📦 Installer: dist-electron/ProBloom_Setup_" + pkg.version + ".exe");
}

main().catch((err) => {
    console.error("\n❌ Build failed:", err.message || err);
    process.exit(1);
});
