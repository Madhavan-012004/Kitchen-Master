import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extract() {
    const data = new Uint8Array(fs.readFileSync('C:\\Users\\acer\\Downloads\\1029321SI2600516.pdf'));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => item.str);
    console.log(strings.join(' '));
}
extract().catch(console.error);
