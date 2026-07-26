import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

// ── Unique code generator ─────────────────────────────────────────────────────
const usedCodes = new Set();

export function generateUniqueCode() {
    let code;
    do {
        // 12-digit numeric barcode (EAN-13 style length but pure numeric)
        code = String(Math.floor(100000000000 + Math.random() * 900000000000));
    } while (usedCodes.has(code));
    usedCodes.add(code);
    return code;
}

/** Attach a unique label code to each item (use existing barcode if present, else generate one) */
export function assignLabelCodes(items) {
    usedCodes.clear();
    // First pass: register existing barcodes so generated ones won't clash
    items.forEach(item => {
        if (item.barcode && item.barcode.trim()) {
            usedCodes.add(item.barcode.trim());
        }
    });
    // Second pass: assign
    return items.map(item => ({
        ...item,
        labelCode: item.barcode?.trim() || generateUniqueCode()
    }));
}

// ── Barcode canvas helper ─────────────────────────────────────────────────────
function barcodeToDataURL(value, widthPx = 160, heightPx = 45) {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    try {
        JsBarcode(canvas, String(value), {
            format: 'CODE128',
            width: 1.4,
            height: heightPx,
            displayValue: false,
            fontSize: 9,
            margin: 2,
            background: '#ffffff',
            lineColor: '#000000',
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.warn('Barcode generation failed for', value, e);
        return null;
    }
}

// ── Layout constants (all in mm) ──────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 5;
const ROWS = 13;
const LABELS_PER_PAGE = COLS * ROWS; // 65

const MARGIN_X = 5;    // left/right page margin
const MARGIN_Y = 5;    // top/bottom page margin
const GAP_X = 2;       // horizontal gap between labels
const GAP_Y = 2;       // vertical gap between labels

const LABEL_W = (PAGE_W - MARGIN_X * 2 - GAP_X * (COLS - 1)) / COLS;  // ~37.6mm
const LABEL_H = (PAGE_H - MARGIN_Y * 2 - GAP_Y * (ROWS - 1)) / ROWS;  // ~21.38mm

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Generate and download an A4 PDF of stock labels.
 * @param {Array} items     - Array of inventory items (with .labelCode, .printQty, .name, .price, .currentStock, .unit)
 * @param {string} shopName - Shop name to show on each label
 */
export function generateAndDownloadA4Labels(items, shopName = 'ProBloom') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Build flat list of label slots
    const labelSlots = [];
    items.forEach(item => {
        const qty = Math.max(1, parseInt(item.printQty) || 1);
        for (let i = 0; i < qty; i++) {
            labelSlots.push(item);
        }
    });

    let currentPage = 0;

    labelSlots.forEach((item, idx) => {
        const pageIdx = Math.floor(idx / LABELS_PER_PAGE);
        const slotIdx = idx % LABELS_PER_PAGE;

        // Add new page
        if (pageIdx > currentPage) {
            doc.addPage();
            currentPage = pageIdx;
        }

        const col = slotIdx % COLS;
        const row = Math.floor(slotIdx / COLS);

        const x = MARGIN_X + col * (LABEL_W + GAP_X);
        const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

        drawLabel(doc, x, y, LABEL_W, LABEL_H, item, shopName);
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`stock_labels_${dateStr}.pdf`);
}

// ── Draw single label ─────────────────────────────────────────────────────────
function drawLabel(doc, x, y, w, h, item, shopName) {
    const padding = 1.2;

    // Border with rounded corners
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 1.2, 1.2, 'S');

    let curY = y + padding + 0.5;

    //── SHOP NAME ──────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    const shopDisplay = (shopName || 'SHOP').toUpperCase().slice(0, 30);
    doc.text(shopDisplay, x + w / 2, curY, { align: 'center' });
    curY += 2.8;

    // ── PRODUCT NAME ───────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    const productName = (item.name || 'PRODUCT').slice(0, 28);
    doc.text(productName, x + padding, curY);
    curY += 3.2;

    // ── BARCODE ────────────────────────────────────────────────────────────
    const barcodeW = w - 2; // leave 1mm each side
    const barcodeH = 6.5;   // mm
    const barcodeDataURL = barcodeToDataURL(item.labelCode, 300, 110);
    if (barcodeDataURL) {
        doc.addImage(barcodeDataURL, 'PNG', x + 1, curY, barcodeW, barcodeH);
    } else {
        // Fallback: print the code as text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text(String(item.labelCode), x + w / 2, curY + 3, { align: 'center' });
    }
    curY += barcodeH + 2.8;

    // ── BARCODE NUMBER ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(String(item.labelCode), x + w / 2, curY, { align: 'center' });
    curY += 2.8;

    // ── PRICE (bottom right) ───────────────────────────────────────────────
    const price = item.price !== undefined ? `Rs. ${parseFloat(item.price).toFixed(2)}` : '';
    if (price) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const rightX = x + w - padding;
        doc.text(price, rightX, curY, { align: 'right' });
    }
}
