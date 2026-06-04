import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import api from '../api/client.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
    bg:         'rgba(15, 23, 42, 0.98)',
    surface:    'rgba(30, 41, 59, 0.90)',
    surfaceAlt: 'rgba(255, 255, 255, 0.03)',
    border:     'rgba(255, 255, 255, 0.08)',
    accent:     '#C6F53D',
    accentDark: '#a8d92e',
    text:       '#f1f5f9',
    textMuted:  'rgba(255,255,255,0.55)',
    green:      '#10b981',
    red:        '#ef4444',
    blue:       '#60a5fa',
    amber:      '#fbbf24',
    headBg:     'rgba(198,245,61,0.08)',
};
const inputStyle = {
    width: '100%', padding: '4px 8px',
    background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`,
    borderRadius: '4px', color: C.text, fontSize: '12px',
    outline: 'none', boxSizing: 'border-box',
};
const thStyle = {
    padding: '9px 8px', fontWeight: '700', fontSize: '11px',
    color: C.accent, textTransform: 'uppercase', letterSpacing: '0.5px',
    whiteSpace: 'nowrap', textAlign: 'left',
    background: C.headBg, borderBottom: `1px solid ${C.border}`,
};
const tdStyle = { padding: '6px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, verticalAlign: 'middle' };
const num = (v) => parseFloat(v) || 0;

// ─── Unit-of-Measure tokens to skip (never numeric values) ───────────────────
const UOM_TOKENS = new Set([
    'crt','crts','carton','cartons','pkt','pkts','packet','packets',
    'kg','kgs','gm','gms','gram','grams','mg','mgs',
    'l','ltr','ltrs','litre','litres','liter','liters','ml','mls',
    'n','nos','no','pcs','pc','piece','pieces','unit','units',
    'box','boxes','bag','bags','roll','rolls','bundle','bundles',
    'doz','dozen','dozens','pair','pairs','set','sets',
    'tab','tabs','tablet','tablets','cap','caps','capsule','capsules',
    'strip','strips','bottle','bottles','tube','tubes','can','cans',
    'ea','each','nos.','pcs.','un','mtr','mtrs','meter','meters',
    'sqft','sft','sqm','sqmtr','rft','rmt',
]);

// Remove UoM tokens from a raw text array, returning only numeric-parseable parts
function filterNumericTokens(tokens) {
    return tokens
        .filter(t => !UOM_TOKENS.has(t.toLowerCase().replace(/\.$/,'')))
        .map(t => { const v = parseFloat(t.replace(/[,₹]/g, '')); return isNaN(v) ? null : v; })
        .filter(v => v !== null && v <= 999999);
}

// ─── Smart column mapper: mathematically validates candidate layout ────────────
function mapNumTokens(numTokens) {
    let cases = 0, qty = 1, mrp = 0, costPerUnit = 0, free = 0, discount = 0, sgst = 0, cgst = 0, totalAmount = 0;
    const n = numTokens;
    const len = n.length;

    // Helper: check if qty * rate ≈ expected total (within 1%)
    const matchesQtyRate = (q, r, t) => q > 0 && r > 0 && Math.abs(q * r - t) < Math.max(1, t * 0.015);

    if (len >= 9) {
        // Standard 9-col: Cases, Qty, MRP, Rate, Free, Discount, SGST, CGST, Total
        [cases, qty, mrp, costPerUnit, free, discount, sgst, cgst, totalAmount] = n;

    } else if (len === 8) {
        // Standard 8-col: Cases, Qty, MRP, Rate, Discount, SGST, CGST, Total
        [cases, qty, mrp, costPerUnit, discount, sgst, cgst, totalAmount] = n;

    } else if (len === 7) {
        // Standard 7-col: Cases, Qty, MRP, Rate, SGST, CGST, Total
        [cases, qty, mrp, costPerUnit, sgst, cgst, totalAmount] = n;

    } else if (len === 6) {
        // Try: Qty, Rate, Total, Discount, SGST, CGST  (no MRP)
        const tryA = matchesQtyRate(n[0], n[1], n[2]);
        // Try: Cases, Qty, Rate, Total, SGST, CGST
        const tryB = matchesQtyRate(n[1], n[2], n[3]);
        // Try Hatsun 6-col: TaxRate, Qty, Rate, Total, Discount, TaxableValue
        const tryC = matchesQtyRate(n[1], n[2], n[3]);

        if (tryB) {
            [cases, qty, costPerUnit, totalAmount, sgst, cgst] = n;
            mrp = costPerUnit;
        } else if (tryA) {
            [qty, costPerUnit, totalAmount, discount, sgst, cgst] = n;
            mrp = costPerUnit;
        } else if (tryC) {
            // Hatsun: TaxRate(skip), Qty, Rate, Total, Discount, TaxableValue
            qty = n[1]; costPerUnit = n[2]; mrp = n[2];
            discount = n[4]; totalAmount = n[5];
        } else {
            [qty, mrp, costPerUnit, sgst, cgst, totalAmount] = n;
        }

    } else if (len === 5) {
        // Try Hatsun 5-col: Qty, Rate, Total, Discount, TaxableValue
        // Hatsun layout: qty*rate ≈ total
        const tryHatsun = matchesQtyRate(n[0], n[1], n[2]);
        // Try standard 5-col: Qty, MRP, Rate, SGST/CGST, Total
        const tryStd = matchesQtyRate(n[0], n[2], n[4]);

        if (tryHatsun) {
            qty = n[0]; costPerUnit = n[1]; mrp = n[1];
            discount = n[3]; totalAmount = n[4];
        } else if (tryStd) {
            [qty, mrp, costPerUnit, sgst, totalAmount] = n;
            cgst = sgst;
        } else {
            // Fallback: treat last as total
            qty = n[0]; costPerUnit = n[1]; mrp = n[1];
            discount = n[3]; totalAmount = n[4];
        }

    } else if (len === 4) {
        // Qty, Rate, Discount, Total  OR  Qty, MRP, Rate, Total
        const tryA = matchesQtyRate(n[0], n[1], n[3]);
        const tryB = matchesQtyRate(n[0], n[2], n[3]);
        if (tryA) {
            [qty, costPerUnit, discount, totalAmount] = n; mrp = costPerUnit;
        } else if (tryB) {
            [qty, mrp, costPerUnit, totalAmount] = n;
        } else {
            [qty, mrp, costPerUnit, totalAmount] = n;
        }

    } else if (len === 3) {
        // Qty, Rate, Total
        [qty, costPerUnit, totalAmount] = n; mrp = costPerUnit;

    } else if (len === 2) {
        [qty, costPerUnit] = n; mrp = costPerUnit;
        totalAmount = qty * costPerUnit;

    } else if (len === 1) {
        qty = n[0];
    }

    // Final fallback: compute total if still zero
    if (totalAmount === 0 && qty > 0 && costPerUnit > 0) {
        totalAmount = parseFloat((qty * costPerUnit + sgst + cgst - discount).toFixed(2));
    }

    return { cases, qty, mrp, costPerUnit, free, discount, sgst, cgst, totalAmount };
}

// ═════════════════════════════════════════════════════════════════════════════
// COLUMN HEADER KEYWORD → FIELD MAPPING TABLE
// Used like a mini-ML model: read actual header labels from the PDF,
// then map each column's data to the correct field using these rules.
// ═════════════════════════════════════════════════════════════════════════════
const COLUMN_KEYWORDS = {
    // Product name / description
    'material': 'name', 'description': 'name', 'item description': 'name',
    'particulars': 'name', 'item': 'name', 'product': 'name', 'goods': 'name',
    'material description': 'name', 'item name': 'name', 'product name': 'name',
    'product description': 'name', 'commodity': 'name', 'name': 'name',
    // HSN / SAC
    'hsn': 'hsnCode', 'hsn code': 'hsnCode', 'hsn/sac': 'hsnCode',
    'hsn/sac code': 'hsnCode', 'sac': 'hsnCode', 'hsn no': 'hsnCode',
    'sac code': 'hsnCode', 'hsn number': 'hsnCode', 'hsn sac': 'hsnCode',
    'code': 'hsnCode',
    // Tax Rate (skip – often empty for exempt goods like milk)
    'tax rate': null, 'gst rate': null, 'gst%': null, 'tax%': null,
    'tax': null, 'gst rate%': null, '%': null, 'rate%': null,
    // Cases
    'cases': 'cases', 'case': 'cases', 'cas': 'cases', 'cs': 'cases',
    'boxes': 'cases', 'cartons': 'cases', 'cas / ea': 'cases', 'ctn': 'cases',
    // Unit of Measure (skip – textual, not numeric)
    'uom': null, 'u.o.m': null, 'u.m': null, 'unit': null, 'units': null,
    'unit of measure': null, 'unit of measurement': null,
    // Quantity / Pieces
    'qty': 'qty', 'pcs': 'qty', 'pieces': 'qty', 'nos': 'qty',
    'quantity': 'qty', 'ea': 'qty', 'no of pcs': 'qty',
    'pcs / ea': 'qty', 'ordered qty': 'qty', 'order qty': 'qty',
    // MRP
    'mrp': 'mrp', 'max retail price': 'mrp', 'listed price': 'mrp',
    'm.r.p': 'mrp', 'max. retail price': 'mrp',
    // Rate / Cost per Unit
    'rate': 'costPerUnit', 'price': 'costPerUnit', 'cost': 'costPerUnit',
    'unit price': 'costPerUnit', 'basic rate': 'costPerUnit',
    'selling rate': 'costPerUnit', 'rate/unit': 'costPerUnit',
    'unit rate': 'costPerUnit', 'basic': 'costPerUnit',
    'purchase rate': 'costPerUnit', 'buy rate': 'costPerUnit',
    // Free / Bonus
    'free': 'free', 'free qty': 'free', 'bonus': 'free', 'free goods': 'free',
    'free pcs': 'free', 'free units': 'free',
    // Discount
    'dis': 'discount', 'disc': 'discount', 'discount': 'discount',
    'dis. amt': 'discount', 'discount amt': 'discount',
    'disc. amt': 'discount', 'rebate': 'discount', 'dis.amt': 'discount',
    'scheme discount': 'discount', 'cd': 'discount', 'trade discount': 'discount',
    // SGST
    'sgst': 'sgst', 'sgst %': 'sgst', 'sgst amt': 'sgst',
    'state gst': 'sgst', 's.gst': 'sgst', 'sgst amount': 'sgst',
    // CGST
    'cgst': 'cgst', 'cgst %': 'cgst', 'cgst amt': 'cgst',
    'central gst': 'cgst', 'c.gst': 'cgst', 'cgst amount': 'cgst',
    // IGST
    'igst': 'igst', 'igst amt': 'igst', 'igst amount': 'igst',
    // Taxable Value (Hatsun / most formats) — use as totalAmount priority
    'taxable value': 'taxableAmount', 'taxable amount': 'taxableAmount',
    'taxable val': 'taxableAmount', 'taxable': 'taxableAmount',
    'assessable value': 'taxableAmount', 'assessable amt': 'taxableAmount',
    'net value': 'taxableAmount', 'basic amount': 'taxableAmount',
    // Gross Total / Row total
    'total': 'totalAmount', 'total amt': 'totalAmount',
    'total amount': 'totalAmount', 'amount': 'totalAmount',
    'net amount': 'totalAmount', 'net amt': 'totalAmount',
    'gross total': 'totalAmount', 'gross amt': 'totalAmount',
    'value': 'totalAmount', 'line total': 'totalAmount',
    // Serial / Row number → skip
    's. no': null, 's.no': null, 'sr': null, 'sr.': null, 'sl.no': null,
    '#': null, 'sno': null, 's no': null, 'sl no': null, 'sr no': null,
    'serial': null, 'serial no': null, 'sr.no': null,
};

// Detect which field a text string maps to (returns null if no match)
function detectFieldFromText(text) {
    const t = text.toLowerCase().trim().replace(/[₹\s]+/g, ' ').trim();
    // Exact match first
    if (t in COLUMN_KEYWORDS) return COLUMN_KEYWORDS[t];
    // Partial match: check if the text contains a keyword
    for (const [kw, field] of Object.entries(COLUMN_KEYWORDS)) {
        if (kw && (t === kw || t.startsWith(kw + ' ') || t.endsWith(' ' + kw) || t.includes(kw))) {
            return field;
        }
    }
    return undefined; // undefined = not a column header at all
}

// ═════════════════════════════════════════════════════════════════════════════
// UNIVERSAL PDF INVOICE PARSER
// Strategy:
//  1. Collect all text items with (str, x, y) positions
//  2. Group by Y (within 8px tolerance)
//  3. For each Y-group, detect column headers using COLUMN_KEYWORDS table
//  4. Mode A (Row-based): find a header row, use X-positions to assign values per row
//  5. Mode B (Column-based): each column is at the same Y; use keyword-labeled groups
// ═════════════════════════════════════════════════════════════════════════════
async function parsePdfInvoice(file) {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Step 1: Collect all items with position
    const allItems = [];
    for (let pi = 1; pi <= doc.numPages; pi++) {
        const page = await doc.getPage(pi);
        const tc = await page.getTextContent();
        for (const item of tc.items) {
            if (!item.str.trim()) continue;
            allItems.push({
                str: item.str.trim(),
                x: Math.round(item.transform[4]),
                y: Math.round(item.transform[5]),
                page: pi,
            });
        }
    }

    const flatText = allItems.map(i => i.str).join(' ');

    // ── Metadata ──────────────────────────────────────────────────────────────
    let invoiceNo = '', supplier = '', date = new Date().toISOString().split('T')[0];

    // ── Invoice Number ─────────────────────────────────────────────────────────
    const invMatch = flatText.match(/Invoice\s*No\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{2,20})/i)
        || flatText.match(/Invoice\s*(?:Number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{2,20})/i)
        || flatText.match(/Bill\s*No\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{2,20})/i)
        || flatText.match(/Inv\.?\s*No\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/-]{2,20})/i)
        || flatText.match(/(?:Invoice|Bill)\s*#\s*([A-Z0-9][A-Z0-9/-]{2,20})/i)
        // Pure numeric invoice number (Hatsun: "Invoice No. : 9126306530")
        || flatText.match(/Invoice\s*No[^:]*:\s*(\d{6,})/i);
    if (invMatch) invoiceNo = invMatch[1].replace(/\s/g, '');

    // ── Invoice Date (supports DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD) ─
    const dateMatch = flatText.match(/Invoice\s*Date\s*[:\-]?\s*(\d{2}[.\-\/]\d{2}[.\-\/]\d{4})/i)
        || flatText.match(/Bill\s*Date\s*[:\-]?\s*(\d{2}[.\-\/]\d{2}[.\-\/]\d{4})/i)
        || flatText.match(/Date\s*[:\-]?\s*(\d{2}[.\-\/]\d{2}[.\-\/]\d{4})/i)
        || flatText.match(/(\d{4}-\d{2}-\d{2})/)
        || flatText.match(/(\d{2}[.\-\/]\d{2}[.\-\/]\d{4})/);
    if (dateMatch) {
        // Normalize DD.MM.YYYY → DD/MM/YYYY for consistency
        date = dateMatch[1].replace(/\./g, '/');
    }

    // ── Supplier Name ──────────────────────────────────────────────────────────
    const suppMatch = flatText.match(/(?:Supplier|Firm|Distributor|From|Sold By|Manufacturer|Vendor)[:\s]+([A-Z][A-Za-z\s.&',()-]{3,60})(?=\s+(?:GSTIN|GST No|PAN|PH|Phone|Address|\d{6}))/i);
    if (suppMatch) {
        supplier = suppMatch[1].trim();
    } else {
        // Look for first prominent multi-word company name in first 20% of items
        const topItems = allItems.slice(0, Math.min(30, Math.ceil(allItems.length * 0.2)));
        for (const item of topItems) {
            // Must be title-case or all-caps company-like string
            if (
                /^[A-Z][A-Za-z\s.&',()/]{5,}(Limited|Ltd|Pvt|LLP|Corp|Inc|Industries|Products|Agencies|Traders|Distributors|Company|Co\.)?/i.test(item.str) &&
                !/(invoice|bill of supply|tax invoice|original|duplicate|triplicate|gstin|gst no|pan no|date|place|e-way|eway|valid|mobile|phone|fax|email|www|support|ref|order|state|district)/i.test(item.str)
            ) {
                supplier = item.str.trim(); break;
            }
        }
    }

    // Step 2: Group by Y (within 8px tolerance)
    const Y_TOL = 8;
    const yGroups = new Map(); // canonicalY → items[]
    for (const item of allItems) {
        let canon = null;
        for (const k of yGroups.keys()) {
            if (Math.abs(item.y - k) <= Y_TOL) { canon = k; break; }
        }
        if (canon === null) yGroups.set(item.y, [item]);
        else yGroups.get(canon).push(item);
    }
    // Sort each group L→R
    for (const [, g] of yGroups) g.sort((a, b) => a.x - b.x);

    // Step 3: Tag each Y-group with detected field (if it's a header group)
    // Also count how many keyword matches each group has
    const groupTags = new Map(); // canonicalY → { fields: Set<string>, hasKeywords: bool }
    for (const [y, g] of yGroups) {
        const detectedFields = new Set();
        let keywordCount = 0;
        for (const item of g) {
            const field = detectFieldFromText(item.str);
            if (field !== undefined) {
                keywordCount++;
                if (field !== null) detectedFields.add(field);
            }
        }
        groupTags.set(y, { fields: detectedFields, keywordCount, items: g });
    }

    // ── Determine Mode: A (row-based) or B (column-based) ────────────────────
    // Mode B indicator: a Y-group with 5+ identical HSN-like codes
    let modeBHsnGroup = null;
    for (const [y, g] of yGroups) {
        const hsnItems = g.filter(i => /^\d{6,8}$/.test(i.str));
        if (hsnItems.length >= 5) { modeBHsnGroup = hsnItems; break; }
    }
    const isModeB = modeBHsnGroup !== null;

    let productRows = [];

    if (isModeB) {
        // ════════════════════════════════════════════════════════════════════
        // MODE B: Column-at-same-Y layout
        // Each field's data lives at the same Y coordinate across all products.
        // Strategy:
        //   a) Find keyword-labeled Y-groups → field name is known
        //   b) For each labeled group, extract numeric data (sorted by X)
        //   c) Product i's value = the i-th numeric item in that field's group
        // ════════════════════════════════════════════════════════════════════

        const N = modeBHsnGroup.length; // number of product rows

        // Build field → [sorted numeric items] map
        // For each Y-group that has detected field keywords, collect its numbers
        const fieldData = new Map(); // field → numeric items sorted by X

        for (const [y, { fields, items }] of groupTags) {
            if (fields.size === 0) continue;
            const nums = items.filter(i => /^[\d.]+$/.test(i.str)).sort((a, b) => a.x - b.x);
            if (nums.length < 1) continue;

            for (const field of fields) {
                if (!fieldData.has(field)) fieldData.set(field, []);
                const existing = fieldData.get(field);
                // Merge and re-sort by X
                fieldData.set(field, [...existing, ...nums].sort((a, b) => a.x - b.x));
            }
        }

        // Handle CGST / SGST that may be labeled as "CGST Total Amt" in one group
        // If 'cgst' and 'totalAmount' both appeared in same group, separate by size
        // (leave as-is; user can correct in UI)

        // For unlabeled numeric-only groups, try value-range heuristics
        for (const [y, { fields, items }] of groupTags) {
            if (fields.size > 0) continue; // already labeled
            const nums = items.filter(i => /^[\d.]+$/.test(i.str));
            if (nums.length < Math.min(3, N * 0.2)) continue;
            const values = nums.map(i => parseFloat(i.str)).filter(v => !isNaN(v));
            if (values.length === 0) continue;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const max = Math.max(...values);
            const allIntegers = values.every(v => Number.isInteger(v));

            // Heuristic classification
            let guessField = null;
            if (!fieldData.has('cases') && allIntegers && avg < 10 && max <= 20) {
                guessField = 'cases';
            } else if (!fieldData.has('qty') && avg > 5 && avg < 500 && max < 5000) {
                guessField = 'qty';
            } else if (!fieldData.has('mrp') && avg > 5 && avg < 5000) {
                guessField = 'mrp';
            } else if (!fieldData.has('costPerUnit') && avg > 1 && avg < 2000) {
                guessField = 'costPerUnit';
            } else if (!fieldData.has('free') && allIntegers && avg < 5) {
                guessField = 'free';
            } else if (!fieldData.has('discount') && avg < 500) {
                guessField = 'discount';
            } else if (!fieldData.has('sgst') && avg < 200) {
                guessField = 'sgst';
            } else if (!fieldData.has('cgst') && avg < 200) {
                guessField = 'cgst';
            } else if (!fieldData.has('totalAmount') && avg > 100) {
                guessField = 'totalAmount';
            }

            if (guessField) {
                fieldData.set(guessField, nums.sort((a, b) => a.x - b.x));
            }
        }

        // Find product name column
        let nameItems = [];
        let bestScore = 0;
        for (const [, { items }] of groupTags) {
            const textItems = items.filter(i => i.str.length > 4 && /[a-zA-Z]{2,}/.test(i.str));
            const score = textItems.length;
            if (score > bestScore) { bestScore = score; nameItems = textItems; }
        }
        nameItems = nameItems.sort((a, b) => a.x - b.x);

        // Build product rows using field data
        const getVal = (field, i) => {
            const col = fieldData.get(field);
            if (!col) return 0;
            return parseFloat(col[i]?.str || '0') || 0;
        };

        for (let i = 0; i < N; i++) {
            const name = nameItems[i]?.str || `Product ${i + 1}`;
            if (name.length < 2) continue;

            const cases       = getVal('cases', i);
            const qty         = getVal('qty', i);
            const mrp         = getVal('mrp', i);
            const costPerUnit = getVal('costPerUnit', i);
            const free        = getVal('free', i);
            const discount    = getVal('discount', i);
            const sgst        = getVal('sgst', i);
            const cgst        = getVal('cgst', i);
            let totalAmount   = getVal('totalAmount', i);
            const hsnCode     = modeBHsnGroup[i]?.str || '';

            if (totalAmount === 0 && qty > 0 && costPerUnit > 0)
                totalAmount = parseFloat((qty * costPerUnit + sgst + cgst - discount).toFixed(2));

            productRows.push({ name, hsnCode, cases, qty, mrp, costPerUnit, free, discount, sgst, cgst, totalAmount });
        }

    } else {
        // ════════════════════════════════════════════════════════════════════
        // MODE A: Row-based layout
        // Find the header row, map X-positions to field names,
        // then assign each data cell to the nearest header column.
        // ════════════════════════════════════════════════════════════════════

        // Find the header row: Y-group with most column keyword matches
        let headerY = null;
        let headerFields = [];  // [{field, x}] sorted by x
        let maxKeywords = 1;

        for (const [y, { keywordCount, fields, items }] of groupTags) {
            if (keywordCount > maxKeywords || fields.size > maxKeywords) {
                maxKeywords = Math.max(keywordCount, fields.size);
                headerY = y;
                headerFields = [];
                for (const item of items) {
                    const field = detectFieldFromText(item.str);
                    if (field !== undefined && field !== null) {
                        headerFields.push({ field, x: item.x, label: item.str });
                    }
                }
            }
        }

        // Fallback: if no header found via keywords, use positional defaults
        if (headerFields.length < 2) {
            // Just try to parse rows that have an HSN code
            const sortedByY = [...yGroups.entries()].sort((a, b) => b[0] - a[0]);
            for (const [y, items] of sortedByY) {
                const texts = items.map(i => i.str);
                const hsnIdx = texts.findIndex(t => /^\d{4,8}$/.test(t));
                if (hsnIdx === -1) continue;
                const preHsn = texts.slice(0, hsnIdx).join(' ');
                if (!preHsn.trim() || preHsn.length < 2) continue;
                if (/(total|sub.?total|payable|grand)/i.test(texts.slice(0, 3).join(' '))) continue;

                let nameStart = /^\d{1,3}$/.test(texts[0]) ? 1 : 0;
                // Also skip any leading UoM-looking tokens in the name region
                const name = texts.slice(nameStart, hsnIdx)
                    .filter(t => !UOM_TOKENS.has(t.toLowerCase().replace(/\.$/, '')))
                    .join(' ').trim();
                if (!name || name.length < 2) continue;
                const hsnCode = texts[hsnIdx];

                // Filter out UoM tokens and parse numerics from remaining tokens
                const numParts = filterNumericTokens(texts.slice(hsnIdx + 1));

                if (numParts.length < 2) continue;
                const rowData = mapNumTokens(numParts);
                productRows.push({ name, hsnCode, ...rowData });
            }
        } else {
            // Header found → use X-proximity to assign values to fields
            headerFields.sort((a, b) => a.x - b.x);

            const assignToField = (x) => {
                // Find the header column whose X is closest to this item's X
                let best = headerFields[0];
                let bestDist = Math.abs(x - best.x);
                for (const hf of headerFields) {
                    const d = Math.abs(x - hf.x);
                    if (d < bestDist) { bestDist = d; best = hf; }
                }
                return best.field;
            };

            // Process rows below the header
            const sortedByY = [...yGroups.entries()]
                .filter(([y]) => y < (headerY ?? Infinity))
                .sort((a, b) => b[0] - a[0]); // top→bottom in PDF (high Y = higher on page)

            for (const [y, items] of sortedByY) {
                // Skip total/summary rows
                const joined = items.map(i => i.str).join(' ');
                if (/(total|sub.?total|payable|grand|amount in words|vat|cess)/i.test(joined.substring(0, 60))) continue;

                // Must have a name (alphabetic) and at least one number
                const hasAlpha = items.some(i => /[a-zA-Z]{2,}/.test(i.str));
                const hasNum = items.some(i => /^\d+\.?\d*$/.test(i.str));
                if (!hasAlpha || !hasNum) continue;

                // Build row by field
                const row = { name: '', hsnCode: '', cases: 0, qty: 0, mrp: 0, costPerUnit: 0, free: 0, discount: 0, sgst: 0, cgst: 0, totalAmount: 0, taxableAmount: 0 };
                const nameParts = [];

                for (const item of items) {
                    if (/^\d{6,8}$/.test(item.str)) {
                        row.hsnCode = item.str; continue;
                    }
                    if (/^\d{1,3}$/.test(item.str) && !row.hsnCode) continue; // serial
                    const numVal = parseFloat(item.str.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numVal) && numVal <= 500000) {
                        const field = assignToField(item.x);
                        if (field in row && field !== 'name' && field !== 'hsnCode') {
                            row[field] = numVal;
                        }
                    } else if (/[a-zA-Z]{2,}/.test(item.str)) {
                        nameParts.push(item.str);
                    }
                }
                row.name = nameParts.join(' ').trim();
                if (!row.name || row.name.length < 2) continue;
                if (row.taxableAmount > 0) {
                    row.totalAmount = row.taxableAmount;
                }
                if (row.totalAmount === 0 && row.qty > 0 && row.costPerUnit > 0)
                    row.totalAmount = parseFloat((row.qty * row.costPerUnit + row.sgst + row.cgst - row.discount).toFixed(2));
                productRows.push(row);
            }
        }
    }

    return { invoiceNo, supplier, date, productRows };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InvoiceOcrModal({ onClose, onComplete, toast }) {
    const [file, setFile]             = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [scanning, setScanning]     = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [invoiceNo, setInvoiceNo]   = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [invoiceDate, setInvoiceDate]   = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [saving, setSaving]         = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        setFile(f);
        setPreviewUrl(f.type === 'application/pdf' ? 'pdf' : URL.createObjectURL(f));
        setParsedData(null);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0]; if (!f) return;
        setFile(f);
        setPreviewUrl(f.type === 'application/pdf' ? 'pdf' : URL.createObjectURL(f));
        setParsedData(null);
    };

    const handleScan = async () => {
        if (!file) return;
        setScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await api.post('/api/inventory/scan-invoice-python', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000 // Allow up to 2 minutes for python OCR
            });

            const result = response.data;
            const items = (result.productRows || []).map(r => ({ _idx: Math.random().toString(), ...r }));

            setInvoiceNo(result.invoiceNo || 'INV-' + Math.floor(1000 + Math.random() * 9000));
            setSupplierName(result.supplier || 'LOCAL DISTRIBUTOR');
            setInvoiceDate(result.date || new Date().toISOString().split('T')[0]);
            
            if (items.length > 0) {
                setParsedData(items);
                toast?.success?.(`✅ Extracted ${items.length} line items using Offline AI!`);
            } else {
                setParsedData([{ _idx: '1', name: '', hsnCode: '', cases: 0, qty: 1, mrp: 0, costPerUnit: 0, free: 0, discount: 0, sgst: 0, cgst: 0, totalAmount: 0 }]);
                toast?.error?.('Could not detect rows. Please enter data manually.');
            }
        } catch (err) {
            console.error('Scan error:', err);
            toast?.error?.('Scan failed: ' + (err.response?.data || err.message));
        } finally { setScanning(false); }
    };

    const handleDataChange = (index, field, value) => {
        setParsedData(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };
    const handleDeleteRow = (index) => setParsedData(prev => prev.filter((_, i) => i !== index));
    const handleAddBlankRow = () => setParsedData(prev => [...prev, {
        _idx: Math.random().toString(), name: '', hsnCode: '', cases: 0, qty: 1, mrp: 0, costPerUnit: 0, free: 0, discount: 0, sgst: 0, cgst: 0, totalAmount: 0
    }]);

    const handleSaveToInventory = async () => {
        if (!parsedData || parsedData.length === 0) return;
        setSaving(true);
        try {
            const mappedItems = parsedData.map(item => ({
                name: item.name || 'Unnamed', hsnCode: item.hsnCode || '',
                qty: num(item.qty), free: num(item.free), cases: num(item.cases),
                costPerUnit: num(item.costPerUnit), price: num(item.mrp),
                discount: num(item.discount), sgst: num(item.sgst), cgst: num(item.cgst),
                totalAmount: num(item.totalAmount),
                gstPercent: (num(item.sgst) + num(item.cgst)) > 0
                    ? ((num(item.sgst) + num(item.cgst)) / (num(item.costPerUnit) * num(item.qty) || 1)) * 100 : 0,
                category: 'General', unit: 'PIECE',
                packSize: num(item.cases) > 0 ? `${item.cases}x${Math.ceil(num(item.qty) / num(item.cases) || 1)}` : '1x1',
            }));
            await api.post('/api/inventory/bulk-add', { invoiceNo, supplierName, paymentMethod, items: mappedItems });
            toast?.success?.(`💾 Invoice #${invoiceNo} saved — ${mappedItems.length} items imported!`);
            onComplete?.();
        } catch (err) {
            console.error('Save Error:', err);
            toast?.error?.(err.response?.data?.message || 'Failed to save to inventory.');
        } finally { setSaving(false); }
    };

    const calculateTotals = () => {
        if (!parsedData) return { base: '0.00', sgst: '0.00', cgst: '0.00', gstTotal: '0.00', discount: '0.00', grandTotal: '0.00' };
        let base = 0, sgstT = 0, cgstT = 0, disc = 0, total = 0;
        for (const item of parsedData) {
            const lb = num(item.costPerUnit) * num(item.qty);
            base += lb; sgstT += num(item.sgst); cgstT += num(item.cgst); disc += num(item.discount);
            total += num(item.totalAmount) || (lb + num(item.sgst) + num(item.cgst) - num(item.discount));
        }
        return { base: base.toFixed(2), sgst: sgstT.toFixed(2), cgst: cgstT.toFixed(2), gstTotal: (sgstT + cgstT).toFixed(2), discount: disc.toFixed(2), grandTotal: total.toFixed(2) };
    };
    const totals = calculateTotals();

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,30,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.6)', borderRadius: '18px', width: '100%', maxWidth: '1200px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', color: C.text, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 16px', borderBottom: `1px solid ${C.border}`, background: 'rgba(198,245,61,0.04)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #C6F53D, #a8d92e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤖</div>
                        <div>
                            <div style={{ fontWeight: '800', fontSize: '17px' }}>Smart Invoice Scanner</div>
                            <div style={{ fontSize: '12px', color: C.textMuted }}>Reads column headers → maps data to correct fields automatically</div>
                        </div>
                        <span style={{ background: 'rgba(198,245,61,0.15)', color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>OFFLINE AI</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.textMuted, cursor: 'pointer', fontSize: '18px', borderRadius: '8px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {!parsedData && !scanning && (
                        <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => !previewUrl && fileInputRef.current?.click()}
                            style={{ border: `2px dashed ${previewUrl ? C.accent + '60' : C.border}`, borderRadius: '14px', background: C.surfaceAlt, padding: previewUrl ? '24px' : '48px 24px', textAlign: 'center', cursor: previewUrl ? 'default' : 'pointer' }}>
                            {!previewUrl ? (
                                <>
                                    <div style={{ fontSize: '48px', marginBottom: '14px' }}>📄</div>
                                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>Upload Any Tax Invoice</div>
                                    <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '20px', lineHeight: '1.7' }}>
                                        Drop file or click · PDF, JPG, PNG, WEBP<br />
                                        <strong style={{ color: C.accent }}>Auto-detects column headers</strong> — works with any invoice format
                                    </div>
                                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} />
                                    <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        style={{ background: C.accent, color: '#000', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                                        Select Invoice File
                                    </button>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    {previewUrl === 'pdf'
                                        ? <div style={{ padding: '32px 48px', border: `1px solid ${C.border}`, borderRadius: '10px', background: 'rgba(198,245,61,0.05)', color: C.accent, fontSize: '48px' }}>📄</div>
                                        : <img src={previewUrl} alt="Invoice" style={{ maxHeight: '260px', maxWidth: '100%', borderRadius: '10px', border: `1px solid ${C.border}` }} />
                                    }
                                    <div style={{ color: C.text, fontWeight: '600' }}>{file?.name}</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setFile(null); setPreviewUrl(null); }} style={{ background: 'rgba(255,255,255,0.06)', color: C.text, border: `1px solid ${C.border}`, padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Change File</button>
                                        <button onClick={handleScan} style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: '#000', border: 'none', padding: '8px 24px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>🚀 Extract Data</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {scanning && (
                        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: `4px solid rgba(198,245,61,0.15)`, borderTop: `4px solid ${C.accent}`, animation: 'spin 0.9s linear infinite', margin: '0 auto 24px' }} />
                            <div style={{ fontWeight: '800', fontSize: '18px', marginBottom: '8px' }}>Reading column headers…</div>
                            <div style={{ color: C.textMuted, fontSize: '13px', lineHeight: '1.7' }}>
                                Detecting table structure, mapping column names to fields…<br />
                                100% on-device — no data leaves your machine.
                            </div>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {parsedData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* Metadata */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, padding: '16px', borderRadius: '12px' }}>
                                {[
                                    { label: 'Invoice Number', value: invoiceNo, set: setInvoiceNo },
                                    { label: 'Supplier / Distributor', value: supplierName, set: setSupplierName },
                                    { label: 'Invoice Date', value: invoiceDate, set: setInvoiceDate },
                                    { label: 'Payment Method', isSelect: true },
                                ].map(({ label, value, set, isSelect }) => (
                                    <div key={label}>
                                        <label style={{ display: 'block', fontSize: '11px', color: C.textMuted, marginBottom: '5px', fontWeight: '700' }}>{label}</label>
                                        {isSelect
                                            ? <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ ...inputStyle, padding: '6px 10px' }}>
                                                {['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Credit'].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
                                            </select>
                                            : <input value={value} onChange={e => set(e.target.value)} style={{ ...inputStyle, padding: '6px 10px' }} />
                                        }
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ background: 'rgba(16,185,129,0.12)', color: C.green, border: '1px solid rgba(16,185,129,0.25)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '700' }}>
                                    ✅ {parsedData.length} line items extracted
                                </span>
                                <span style={{ color: C.textMuted, fontSize: '12px' }}>Review & edit any values before importing</span>
                            </div>

                            {/* Table */}
                            <div style={{ border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.15)' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead><tr>
                                            <th style={{ ...thStyle, width: '30px' }}>#</th>
                                            <th style={{ ...thStyle, minWidth: '180px' }}>Material Description</th>
                                            <th style={{ ...thStyle, width: '80px' }}>HSN Code</th>
                                            <th style={{ ...thStyle, width: '55px' }}>Cases</th>
                                            <th style={{ ...thStyle, width: '55px' }}>Qty</th>
                                            <th style={{ ...thStyle, width: '75px' }}>MRP</th>
                                            <th style={{ ...thStyle, width: '75px' }}>Rate</th>
                                            <th style={{ ...thStyle, width: '50px' }}>Free</th>
                                            <th style={{ ...thStyle, width: '75px' }}>Dis. Amt</th>
                                            <th style={{ ...thStyle, width: '70px' }}>SGST ₹</th>
                                            <th style={{ ...thStyle, width: '70px' }}>CGST ₹</th>
                                            <th style={{ ...thStyle, width: '85px', color: C.accent }}>Total Amt ₹</th>
                                            <th style={{ ...thStyle, width: '36px' }}></th>
                                        </tr></thead>
                                        <tbody>
                                            {parsedData.map((item, index) => (
                                                <tr key={item._idx || index} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                                                    <td style={{ ...tdStyle, color: C.textMuted, fontWeight: '700', fontSize: '11px' }}>{index + 1}</td>
                                                    <td style={tdStyle}><input value={item.name || ''} onChange={e => handleDataChange(index, 'name', e.target.value)} style={{ ...inputStyle, minWidth: '160px' }} /></td>
                                                    <td style={tdStyle}><input value={item.hsnCode || ''} onChange={e => handleDataChange(index, 'hsnCode', e.target.value)} style={inputStyle} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" value={item.cases ?? 0} onChange={e => handleDataChange(index, 'cases', e.target.value)} style={inputStyle} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" value={item.qty ?? 0} onChange={e => handleDataChange(index, 'qty', e.target.value)} style={inputStyle} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.mrp ?? 0} onChange={e => handleDataChange(index, 'mrp', e.target.value)} style={{ ...inputStyle, color: C.blue }} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.costPerUnit ?? 0} onChange={e => handleDataChange(index, 'costPerUnit', e.target.value)} style={inputStyle} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" value={item.free ?? 0} onChange={e => handleDataChange(index, 'free', e.target.value)} style={{ ...inputStyle, color: C.green }} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.discount ?? 0} onChange={e => handleDataChange(index, 'discount', e.target.value)} style={{ ...inputStyle, color: C.amber }} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.sgst ?? 0} onChange={e => handleDataChange(index, 'sgst', e.target.value)} style={{ ...inputStyle, color: C.textMuted }} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.cgst ?? 0} onChange={e => handleDataChange(index, 'cgst', e.target.value)} style={{ ...inputStyle, color: C.textMuted }} /></td>
                                                    <td style={tdStyle}><input type="number" min="0" step="0.01" value={item.totalAmount ?? 0} onChange={e => handleDataChange(index, 'totalAmount', e.target.value)} style={{ ...inputStyle, color: C.accent, fontWeight: '700' }} /></td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                        <button onClick={() => handleDeleteRow(index)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: '14px' }}>🗑</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr><td colSpan="13" style={{ padding: '8px' }}>
                                                <button onClick={handleAddBlankRow} style={{ background: 'rgba(255,255,255,0.06)', color: C.textMuted, border: `1px dashed ${C.border}`, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', width: '100%' }}>+ Add Missing Row</button>
                                            </td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals */}
                            <div style={{ alignSelf: 'flex-end', width: '340px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                <div style={{ fontWeight: '800', fontSize: '13px', marginBottom: '4px', color: C.textMuted }}>INVOICE SUMMARY</div>
                                {[
                                    { label: 'Taxable Base Total', value: `₹${totals.base}` },
                                    { label: 'Total SGST', value: `₹${totals.sgst}`, color: C.textMuted },
                                    { label: 'Total CGST', value: `₹${totals.cgst}`, color: C.textMuted },
                                    { label: 'Total GST', value: `₹${totals.gstTotal}` },
                                    { label: 'Total Discount', value: `-₹${totals.discount}`, color: C.green },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: C.textMuted }}>{label}</span>
                                        <strong style={{ color: color || C.text }}>{value}</strong>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '10px', fontSize: '16px', marginTop: '2px' }}>
                                    <span style={{ fontWeight: '700' }}>Net Payable Total</span>
                                    <strong style={{ color: C.accent, fontSize: '18px' }}>₹{totals.grandTotal}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{ color: C.textMuted, fontSize: '12px' }}>
                        {parsedData ? `${parsedData.length} items ready · Edit any field if values need correction` : 'Upload any invoice — the scanner reads column headers automatically'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onClose} disabled={saving} style={{ background: 'rgba(255,255,255,0.06)', color: C.text, border: `1px solid ${C.border}`, padding: '9px 20px', borderRadius: '9px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
                        {parsedData && (
                            <button onClick={handleSaveToInventory} disabled={saving || parsedData.length === 0}
                                style={{ background: saving ? 'rgba(198,245,61,0.5)' : `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: '#000', border: 'none', padding: '9px 24px', borderRadius: '9px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {saving ? <><span style={{ width: 14, height: 14, border: '2px solid #00000040', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.9s linear infinite', display: 'inline-block' }} />Saving…</> : `💾 Verify & Import ${parsedData.length} Items`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
