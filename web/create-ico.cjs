// create-ico.cjs — Creates a proper .ico file from the ProBloom logo
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const sizes = [16, 24, 32, 48, 64, 128, 256];

async function main() {
    const srcImg = path.join(__dirname, "src", "assets", "LOGO.jpeg");
    const destIco = path.join(__dirname, "build", "icon.ico");
    const tempDir = path.join(__dirname, "build", "ico_temp");

    if (!fs.existsSync(srcImg)) {
        throw new Error("Source logo not found: " + srcImg);
    }

    if (!fs.existsSync(path.join(__dirname, "build"))) fs.mkdirSync(path.join(__dirname, "build"), { recursive: true });
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Use PowerShell to resize the logo to multiple sizes
    for (const size of sizes) {
        const outFile = path.join(tempDir, `icon_${size}.png`);
        const psScript = [
            'Add-Type -AssemblyName System.Drawing',
            `$src = [System.Drawing.Image]::FromFile("${srcImg.replace(/\\/g, "\\\\")}")`,
            `$bmp = New-Object System.Drawing.Bitmap ${size}, ${size}`,
            '$g = [System.Drawing.Graphics]::FromImage($bmp)',
            '$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
            '$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality',
            `$g.DrawImage($src, 0, 0, ${size}, ${size})`,
            `$bmp.Save("${outFile.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)`,
            '$g.Dispose()',
            '$bmp.Dispose()',
            '$src.Dispose()',
        ].join("\n");
        const psFile = path.join(tempDir, `resize_${size}.ps1`);
        fs.writeFileSync(psFile, psScript);
        execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: "pipe" });
        console.log(`   ✓ Created ${size}x${size} icon`);
    }

    // Build ICO file from PNG files
    const pngBuffers = sizes.map(size => {
        return fs.readFileSync(path.join(tempDir, `icon_${size}.png`));
    });

    const numImages = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dataOffset = headerSize + (dirEntrySize * numImages);

    let currentOffset = dataOffset;
    const offsets = pngBuffers.map(buf => {
        const offset = currentOffset;
        currentOffset += buf.length;
        return offset;
    });

    const totalSize = currentOffset;
    const ico = Buffer.alloc(totalSize);

    ico.writeUInt16LE(0, 0);
    ico.writeUInt16LE(1, 2);
    ico.writeUInt16LE(numImages, 4);

    for (let i = 0; i < numImages; i++) {
        const entryOffset = headerSize + (i * dirEntrySize);
        const size = sizes[i];
        ico.writeUInt8(size >= 256 ? 0 : size, entryOffset);
        ico.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
        ico.writeUInt8(0, entryOffset + 2);
        ico.writeUInt8(0, entryOffset + 3);
        ico.writeUInt16LE(1, entryOffset + 4);
        ico.writeUInt16LE(32, entryOffset + 6);
        ico.writeUInt32LE(pngBuffers[i].length, entryOffset + 8);
        ico.writeUInt32LE(offsets[i], entryOffset + 12);
    }

    for (let i = 0; i < numImages; i++) {
        pngBuffers[i].copy(ico, offsets[i]);
    }

    fs.writeFileSync(destIco, ico);
    console.log(`\n✅ Created ${destIco} (${(ico.length / 1024).toFixed(1)} KB) with ${numImages} sizes`);

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch(err => {
    console.error("Failed:", err.message);
    process.exit(1);
});
