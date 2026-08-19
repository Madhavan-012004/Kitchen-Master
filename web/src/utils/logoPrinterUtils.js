/**
 * logoPrinterUtils.js — Thermal Printer Logo Processing & ESC/POS Raster Generator
 *
 * Provides:
 *  1. Monochrome processing with transparency removal & contrast optimization
 *  2. Proportional resizing tailored to 2-inch (384px) & 3-inch (576px) paper widths
 *  3. Centered alignment calculation
 *  4. ESC/POS 'GS v 0' raster bit-image command generation
 */

// Cache for processed logo ESC/POS bytes to prevent re-canvas processing on every print
const logoCache = new Map();

/**
 * Load image from URL / Data URL / Blob
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('No logo source provided'));
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error('Failed to load logo image: ' + (err.message || 'Image error')));
        img.src = src;
    });
}

/**
 * Process raw logo into a high-contrast monochrome canvas optimized for thermal printers.
 *
 * @param {string|HTMLImageElement} logoInput - Logo URL or Image element
 * @param {number} paperWidthDots - Total paper width in dots (384 for 2-inch, 576 for 3-inch)
 * @returns {Promise<{ canvas: HTMLCanvasElement, width: number, height: number, dataUrl: string, imgData: ImageData }>}
 */
export async function processLogoForThermalCanvas(logoInput, paperWidthDots = 576) {
    const img = typeof logoInput === 'string' ? await loadImage(logoInput) : logoInput;

    // Target max width for logo: ~70% of printable area for clean margins
    // 2-inch (384 dots total) -> max logo width ~256 dots
    // 3-inch (576 dots total) -> max logo width ~384 dots
    const maxLogoWidth = Math.round(paperWidthDots * 0.70);
    const maxLogoHeight = 140; // Max height to avoid eating too much paper height

    let width = img.naturalWidth || img.width || 200;
    let height = img.naturalHeight || img.height || 100;

    // Calculate proportional scale
    let scale = 1;
    if (width > maxLogoWidth) {
        scale = maxLogoWidth / width;
    }
    if (height * scale > maxLogoHeight) {
        scale = maxLogoHeight / height;
    }

    // Ensure width is a multiple of 8 (required for byte-aligned ESC/POS raster lines)
    width = Math.max(16, Math.floor((width * scale) / 8) * 8);
    height = Math.max(16, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // 1. Fill solid white background (removes transparent dark background issues)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw scaled image
    ctx.drawImage(img, 0, 0, width, height);

    // 3. Get pixel data & apply high-contrast monochrome thresholding
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Luminance & high-contrast thresholding with alpha handling
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];

        // If pixel is semi-transparent, blend with white background
        if (alpha < 255) {
            const factor = alpha / 255;
            data[i] = r * factor + 255 * (1 - factor);
            data[i + 1] = g * factor + 255 * (1 - factor);
            data[i + 2] = b * factor + 255 * (1 - factor);
            data[i + 3] = 255;
        }

        // Grayscale conversion using ITU-R BT.601 formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Thresholding at 170 (slightly biased towards white to keep background clean & text crisp)
        const bw = gray < 170 ? 0 : 255;

        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
    }

    ctx.putImageData(imgData, 0, 0);

    return {
        canvas,
        width,
        height,
        dataUrl: canvas.toDataURL('image/png'),
        imgData,
    };
}

/**
 * Generate ESC/POS 'GS v 0' raster bit-image commands from canvas.
 * Centered horizontally across target paper width.
 *
 * @param {HTMLCanvasElement} canvas - Processed monochrome canvas
 * @param {number} paperWidthDots - Total printable width (384 for 2", 576 for 3")
 * @returns {Uint8Array} - ESC/POS byte array ready for transmission
 */
export function generateEscPosRasterLogo(canvas, paperWidthDots = 576) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height).data;

    // Calculate horizontal centering padding in bytes
    // Paper width in bytes (e.g. 576 / 8 = 72 bytes; 384 / 8 = 48 bytes)
    const paperWidthBytes = Math.floor(paperWidthDots / 8);
    const logoWidthBytes = Math.floor(width / 8);
    const leftPadBytes = Math.max(0, Math.floor((paperWidthBytes - logoWidthBytes) / 2));

    const totalLineWidthBytes = leftPadBytes + logoWidthBytes;

    // ESC/POS command: GS v 0 0 pL pH yL yH
    // pL, pH: number of bytes per line (xL, xH)
    // yL, yH: height in dots
    const pL = totalLineWidthBytes & 0xFF;
    const pH = (totalLineWidthBytes >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;

    const header = [
        0x1B, 0x61, 0x01,                   // Align Center
        0x1D, 0x76, 0x30, 0x00,             // GS v 0 0 (Raster bit image normal mode)
        pL, pH,                             // Width in bytes per line
        yL, yH                              // Height in dots
    ];

    const rasterBytes = [];

    for (let y = 0; y < height; y++) {
        // Add left padding bytes (white space = 0x00) for centering
        for (let pad = 0; pad < leftPadBytes; pad++) {
            rasterBytes.push(0x00);
        }

        // Convert image row pixels to bits (1 = black/print, 0 = white/skip)
        for (let xByte = 0; xByte < logoWidthBytes; xByte++) {
            let byteVal = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = xByte * 8 + bit;
                if (x < width) {
                    const idx = (y * width + x) * 4;
                    const r = imgData[idx];
                    // Black pixel in image -> set bit to 1 for thermal print
                    if (r < 128) {
                        byteVal |= (1 << (7 - bit));
                    }
                }
            }
            rasterBytes.push(byteVal);
        }
    }

    // Add trailing line feeds & reset alignment to left
    const footer = [
        0x1B, 0x61, 0x00                     // Align Left reset
    ];

    return new Uint8Array([...header, ...rasterBytes, ...footer]);
}

/**
 * Get processed logo ESC/POS raster bytes (cached).
 */
export async function getProcessedLogoEscPosBytes(logoUrl, paperWidthDots = 576) {
    if (!logoUrl) return null;
    const cacheKey = `${logoUrl}_${paperWidthDots}`;
    if (logoCache.has(cacheKey)) {
        return logoCache.get(cacheKey);
    }

    try {
        const processed = await processLogoForThermalCanvas(logoUrl, paperWidthDots);
        const bytes = generateEscPosRasterLogo(processed.canvas, paperWidthDots);
        logoCache.set(cacheKey, bytes);
        return bytes;
    } catch (e) {
        console.warn('Failed to generate thermal logo bytes:', e);
        return null;
    }
}
