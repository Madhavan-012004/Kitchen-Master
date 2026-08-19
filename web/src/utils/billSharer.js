import { jsPDF } from 'jspdf';

/**
 * Utility to format order receipts, generate PDF/Image Invoices, and share via WhatsApp or SMS.
 */

export function resolveDealerName(storeName) {
    if (storeName && storeName !== 'ProBloom Store' && storeName !== 'ProBloom') {
        return storeName;
    }
    try {
        const u = JSON.parse(localStorage.getItem('km_user') || '{}');
        const name = u.restaurantName || u.name || u.businessName;
        if (name && name.trim()) return name.trim();
    } catch (e) { }
    return 'DISTRIBUTOR STORE';
}

export function formatBillReceiptText(order, restaurantName) {
    if (!order) return '';

    const dealerName = resolveDealerName(restaurantName);
    const orderNo = order.orderNumber || order.billNumber || order.offlineId || order.id || 'N/A';
    const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
    const customer = order.customerName || 'Customer';
    const total = Number(order.total || order.grandTotal || 0).toFixed(2);
    const discount = Number(order.discount || 0).toFixed(2);
    const netTotal = (Number(order.total || order.grandTotal || 0) - Number(order.discount || 0)).toFixed(2);
    const paymentMethod = order.paymentMethod || 'CASH';

    let text = `🧾 *${dealerName}*
--------------------------------
*Bill No:* ${orderNo}
*Date:* ${dateStr}
*Customer:* ${customer}
--------------------------------\n`;

    if (Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach(item => {
            const name = item.name || item.itemName || 'Item';
            const qty = item.qty || item.quantity || 1;
            const price = Number(item.price || 0).toFixed(2);
            const lineTotal = (qty * price).toFixed(2);
            text += `• ${name} x${qty} @ ₹${price} = ₹${lineTotal}\n`;
        });
        text += `--------------------------------\n`;
    }

    if (Number(discount) > 0) {
        text += `Subtotal: ₹${total}\nDiscount: -₹${discount}\n`;
    }

    text += `*Grand Total: ₹${netTotal}*\n`;
    text += `*Status:* PAID (${paymentMethod})\n`;
    text += `--------------------------------\n`;
    text += `Thank you for your business! 🙏\n`;
    text += `_Powered by ProBloom_`;

    return text;
}

export function cleanPhoneNumber(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
        digits = '91' + digits; // Default India country code if 10 digits
    }
    return digits;
}

/**
 * Renders an offscreen HTML5 canvas receipt image and returns a PNG Blob
 */
export function generateInvoiceImageBlob(order, storeName) {
    return new Promise((resolve) => {
        const dealerName = resolveDealerName(storeName);
        const orderNo = order?.orderNumber || order?.billNumber || order?.offlineId || order?.id || 'N/A';
        const dateStr = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
        const customer = order?.customerName || 'Walk-in Customer';
        const total = Number(order?.total || order?.grandTotal || 0);
        const discount = Number(order?.discount || 0);
        const netTotal = total - discount;
        const paymentMethod = order?.paymentMethod || 'CASH';
        const items = order?.items || [];

        const width = 600;
        const minHeight = 420 + (items.length * 36);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = minHeight;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, minHeight);

        // Top Header Banner
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(dealerName.toUpperCase(), 30, 48);

        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('TAX INVOICE / RECEIPT', width - 30, 48);
        ctx.textAlign = 'left';

        // Meta info
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Invoice No: ${orderNo}`, 30, 115);
        ctx.fillText(`Date: ${dateStr}`, 30, 138);

        ctx.textAlign = 'right';
        ctx.fillText(`Customer: ${customer}`, width - 30, 115);
        ctx.fillText(`Payment: ${paymentMethod} (PAID)`, width - 30, 138);
        ctx.textAlign = 'left';

        // Table Header
        let y = 170;
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(30, y, width - 60, 34);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('ITEM DESCRIPTION', 45, y + 22);
        ctx.textAlign = 'center';
        ctx.fillText('QTY', 360, y + 22);
        ctx.textAlign = 'right';
        ctx.fillText('RATE (₹)', 460, y + 22);
        ctx.fillText('TOTAL (₹)', width - 45, y + 22);
        ctx.textAlign = 'left';

        y += 44;
        ctx.fillStyle = '#0f172a';
        ctx.font = '13px sans-serif';

        items.forEach((item, index) => {
            const name = item.name || item.itemName || `Item ${index + 1}`;
            const qty = item.qty || item.quantity || 1;
            const price = Number(item.price || 0).toFixed(2);
            const lineTotal = (qty * Number(item.price || 0)).toFixed(2);

            ctx.fillText(name.substring(0, 35), 45, y);
            ctx.textAlign = 'center';
            ctx.fillText(String(qty), 360, y);
            ctx.textAlign = 'right';
            ctx.fillText(price, 460, y);
            ctx.fillText(lineTotal, width - 45, y);
            ctx.textAlign = 'left';

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(30, y + 10);
            ctx.lineTo(width - 30, y + 10);
            ctx.stroke();

            y += 34;
        });

        y += 10;
        if (discount > 0) {
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Subtotal: ₹${total.toFixed(2)}`, width - 45, y);
            y += 22;
            ctx.fillText(`Discount: -₹${discount.toFixed(2)}`, width - 45, y);
            y += 26;
            ctx.textAlign = 'left';
        }

        // Grand Total Banner
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(width - 270, y, 240, 42);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`GRAND TOTAL: ₹${netTotal.toFixed(2)}`, width - 150, y + 27);
        ctx.textAlign = 'left';

        // Footer
        y += 75;
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Thank you for your business! 🙏', width / 2, y);

        y += 22;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText('Powered by ProBloom', width / 2, y);

        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Generates a clean PDF Invoice document using jsPDF
 */
export function generateInvoicePDFDoc(order, storeName) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const dealerName = resolveDealerName(storeName);
    const orderNo = order?.orderNumber || order?.billNumber || order?.offlineId || order?.id || 'N/A';
    const dateStr = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
    const customer = order?.customerName || 'Walk-in Customer';
    const total = Number(order?.total || order?.grandTotal || 0);
    const discount = Number(order?.discount || 0);
    const netTotal = total - discount;
    const paymentMethod = order?.paymentMethod || 'CASH';
    const items = order?.items || [];

    // Header styling
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(dealerName.toUpperCase(), 14, 16);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('TAX INVOICE / RECEIPT', 196, 16, { align: 'right' });

    // Meta details
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice No: ${orderNo}`, 14, 38);
    doc.text(`Date: ${dateStr}`, 14, 44);

    doc.text(`Customer: ${customer}`, 196, 38, { align: 'right' });
    doc.text(`Payment: ${paymentMethod} (PAID)`, 196, 44, { align: 'right' });

    // Table Header
    let y = 52;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    doc.text('ITEM DESCRIPTION', 18, y + 5.5);
    doc.text('QTY', 120, y + 5.5, { align: 'center' });
    doc.text('RATE (₹)', 150, y + 5.5, { align: 'right' });
    doc.text('TOTAL (₹)', 192, y + 5.5, { align: 'right' });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    items.forEach((item, index) => {
        if (y > 260) {
            doc.addPage();
            y = 20;
        }
        const name = item.name || item.itemName || `Item ${index + 1}`;
        const qty = item.qty || item.quantity || 1;
        const price = Number(item.price || 0).toFixed(2);
        const lineTotal = (qty * Number(item.price || 0)).toFixed(2);

        doc.text(name.substring(0, 45), 18, y);
        doc.text(String(qty), 120, y, { align: 'center' });
        doc.text(price, 150, y, { align: 'right' });
        doc.text(lineTotal, 192, y, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(14, y + 2, 196, y + 2);
        y += 7;
    });

    // Summary Box
    y += 4;
    doc.setFont('helvetica', 'bold');
    if (discount > 0) {
        doc.text(`Subtotal: ₹${total.toFixed(2)}`, 192, y, { align: 'right' });
        y += 6;
        doc.text(`Discount: -₹${discount.toFixed(2)}`, 192, y, { align: 'right' });
        y += 6;
    }

    doc.setFillColor(34, 197, 94);
    doc.rect(130, y, 66, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(`GRAND TOTAL: ₹${netTotal.toFixed(2)}`, 163, y + 6.5, { align: 'center' });

    // Footer
    y += 24;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you for your business! 🙏', 105, y, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Powered by ProBloom', 105, y + 5, { align: 'center' });

    return doc;
}

export function downloadInvoicePDF(order, storeName = 'ProBloom Store') {
    if (!order) return;
    const doc = generateInvoicePDFDoc(order, storeName);
    const orderNo = order.orderNumber || order.billNumber || order.offlineId || order.id || 'N/A';
    doc.save(`Invoice_${orderNo}.pdf`);
}

/**
 * Direct 1-Click WhatsApp Share targeting client phone number directly
 */
export async function shareViaWhatsApp(phone, order, storeName = 'ProBloom Store') {
    if (!order) return;

    // 1. Resolve recipient phone number automatically from input, order, or shop
    const rawPhone = phone || order.customerPhone || order.shopPhone || order.phone || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);
    const text = formatBillReceiptText(order, storeName);

    // 2. Automatically generate and download the PDF invoice document
    try {
        downloadInvoicePDF(order, storeName);
    } catch (e) {
        console.warn('Failed to download PDF invoice:', e);
    }

    // 3. Generate PNG Receipt Image & copy directly to system clipboard for 1-click Ctrl+V pasting in WhatsApp Web
    try {
        const imageBlob = await generateInvoiceImageBlob(order, storeName);
        if (imageBlob && navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': imageBlob })
            ]);
        }
    } catch (e) {
        console.warn('Clipboard image write skipped:', e);
    }

    // 4. Direct 1-Click WhatsApp launch targeting client phone number directly
    let url = '';
    if (cleanPhone) {
        url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    } else {
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }

    window.open(url, '_blank');
}

export function shareViaSMS(phone, order, restaurantName) {
    const text = formatBillReceiptText(order, restaurantName);
    const cleanPhone = cleanPhoneNumber(phone);
    const url = `sms:${cleanPhone || ''}?body=${encodeURIComponent(text)}`;
    window.location.href = url;
}

export default {
    formatBillReceiptText,
    cleanPhoneNumber,
    generateInvoiceImageBlob,
    generateInvoicePDFDoc,
    downloadInvoicePDF,
    shareViaWhatsApp,
    shareViaSMS,
};
