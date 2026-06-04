import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function debug() {
    const data = new Uint8Array(fs.readFileSync('C:\\Users\\acer\\Downloads\\1029321SI2600516.pdf'));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    
    // Group by unique Y values
    const byY = new Map();
    for (const item of tc.items) {
        if (!item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y).push({ str: item.str, x: Math.round(item.transform[4]) });
    }
    
    // Print sorted by Y descending (top to bottom in PDF coords)
    const sorted = [...byY.entries()].sort((a, b) => b[0] - a[0]);
    for (const [y, items] of sorted) {
        const row = items.sort((a, b) => a.x - b.x);
        const line = row.map(i => `"${i.str}"`).join(' | ');
        console.log(`Y=${y}: ${line}`);
    }
}
debug().catch(console.error);
