/**
 * printerUtils.js — Unified Printer Utility for ProBloom
 *
 * Supports ALL connection types:
 *  - "imin_builtin"  → iMin D1 built-in thermal printer via iMin JS SDK (WebView only)
 *  - "network"       → Backend TCP/IP socket to printer at port 9100 (ESC/POS)
 *  - "usb"           → Backend javax.print with USB-connected named printer
 *  - "default"       → Backend javax.print with the OS default printer
 *  - "bluetooth"     → Cordova bluetoothSerial plugin (Android APK) OR Web Bluetooth (Chrome/desktop)
 *  - "mini_bt"       → Mini 2-inch Bluetooth thermal printer (same BT stack, 32-char width template)
 */

import api from './client';
import { getProcessedLogoEscPosBytes, processLogoForThermalCanvas } from '../utils/logoPrinterUtils';


// ─────────────────────────────────────────────────────────────────────────────
// DETECT: Is the iMin SDK available? (only in iMin Android WebView APK)
// iMin may inject the SDK under several names depending on SDK version.
// ─────────────────────────────────────────────────────────────────────────────
export function isIMinAvailable() {
    return !!(
        window.iMin ||
        window.imin ||
        window.iMinPrinter ||
        window.iminPrinter ||
        window.IminPrinter
    );
}

function getIMin() {
    return (
        window.iMin ||
        window.imin ||
        window.iMinPrinter ||
        window.iminPrinter ||
        window.IminPrinter ||
        null
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECT: Which Bluetooth backend is available?
//   1. window.BluetoothPrintBridge → Native Android JS interface (Capacitor APK) ← BEST
//   2. Cordova bluetoothSerial plugin → Android APK (Capacitor/Cordova WebView)
//   3. Web Bluetooth API             → Chrome/Edge browser on desktop or Android
// ─────────────────────────────────────────────────────────────────────────────
function getBluetoothBackend() {
    if (window.BluetoothPrintBridge) return 'native';
    if (window.bluetoothSerial) return 'cordova';
    if (navigator.bluetooth) return 'web';
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// USB PRINTER BRIDGE — Pure JS, no backend
//   Android APK  → window.UsbPrintBridge (Java JavascriptInterface, auto-detect + auto-connect)
//   Web/Desktop  → navigator.usb  (WebUSB API, Chrome/Edge)
// Connection is kept alive across prints (persistent singleton).
// ─────────────────────────────────────────────────────────────────────────────

// ESC/POS command constants
const ESC = 0x1B;
const GS = 0x1D;
const ESC_INIT = [ESC, 0x40];          // Initialize printer
const ESC_BOLD = [ESC, 0x45, 0x01];    // Bold ON
const ESC_UNBOLD = [ESC, 0x45, 0x00];   // Bold OFF
const ESC_CENTER = [ESC, 0x61, 0x01];   // Align center
const ESC_LEFT = [ESC, 0x61, 0x00];   // Align left
const ESC_CUT = [GS, 0x56, 0x41, 0x10]; // Cut paper
const ESC_FEED = [ESC, 0x64, 0x04];   // Feed 4 lines

function textToBytes(text) {
    return new TextEncoder().encode(text);
}

function mergeBytes(...arrays) {
    const parts = arrays.map(a => a instanceof Uint8Array ? a : new Uint8Array(a));
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) { out.set(p, offset); offset += p.length; }
    return out;
}

// Persistent USB state
let _usbDevice = null;         // WebUSB UsbDevice
let _usbEndpoint = null;       // bulk-OUT endpoint number
let _usbInterface = null;      // claimed interface number
let _nativeUsbConnected = false; // Android UsbPrintBridge connected flag

/**
 * Returns true if a native Android USB printer bridge is available
 */
function hasNativeUsbBridge() {
    return !!(window.UsbPrintBridge && typeof window.UsbPrintBridge.getConnectedDevices === 'function');
}

/**
 * Auto-connect to the first detected USB printer on Android.
 * Idempotent — safe to call before every print.
 */
function ensureNativeUsbConnected() {
    if (!hasNativeUsbBridge()) throw new Error('UsbPrintBridge not available in this environment.');
    if (_nativeUsbConnected && window.UsbPrintBridge.isConnected()) return;

    let devices;
    try {
        devices = JSON.parse(window.UsbPrintBridge.getConnectedDevices());
    } catch (e) {
        throw new Error('Could not list USB devices: ' + e.message);
    }

    if (!devices || devices.length === 0) {
        throw new Error('No USB Printer detected. Please connect a thermal printer via OTG cable and try again.');
    }

    // Auto-pick: prefer saved name, else first device
    const settings = getPrinterSettings();
    const target = devices.find(d => d.name === settings.billPrinterName) || devices[0];
    const result = window.UsbPrintBridge.connect(target.address);

    if (result.startsWith('error:')) {
        // Permission request was triggered — the user must accept the dialog then retry
        throw new Error(result.replace('error:', '').trim() + ' — Please tap OK on the USB permission popup and try printing again.');
    }

    _nativeUsbConnected = true;
}

/**
 * Send raw bytes to the native Android USB printer (UsbPrintBridge).
 * Accepts Uint8Array or string.
 */
function nativeUsbWrite(data) {
    ensureNativeUsbConnected();
    let result;
    if (typeof data === 'string') {
        result = window.UsbPrintBridge.print(data);
    } else {
        // Convert Uint8Array → hex string for printHex
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
        result = window.UsbPrintBridge.printHex(hex);
    }
    if (result && result.startsWith('error:')) {
        _nativeUsbConnected = false;
        throw new Error('USB Print failed: ' + result.replace('error:', '').trim());
    }
}

// WebUSB — ESC/POS printer vendor class is 7 (PRINTER)
const WEBUSB_PRINTER_CLASS = 7;

async function getWebUsbDevice() {
    if (_usbDevice && _usbDevice.opened) return _usbDevice;

    // Try previously granted devices first (no popup needed)
    if (navigator.usb) {
        const granted = await navigator.usb.getDevices();
        const thermal = granted.find(d => {
            for (let c = 0; c < d.configurations.length; c++) {
                for (const intf of d.configurations[c].interfaces) {
                    if (intf.alternates.some(a => a.interfaceClass === WEBUSB_PRINTER_CLASS)) return true;
                }
            }
            return true; // accept any USB device if no class info available
        });
        if (thermal) {
            _usbDevice = thermal;
        }
    }

    if (!_usbDevice) {
        // Show device picker — user must select the printer
        _usbDevice = await navigator.usb.requestDevice({ filters: [] });
    }

    if (!_usbDevice.opened) await _usbDevice.open();
    if (_usbDevice.configuration === null) await _usbDevice.selectConfiguration(1);

    // Find bulk-OUT endpoint
    _usbEndpoint = null;
    _usbInterface = null;
    outer:
    for (const intf of _usbDevice.configuration.interfaces) {
        for (const alt of intf.alternates) {
            for (const ep of alt.endpoints) {
                if (ep.direction === 'out' && ep.type === 'bulk') {
                    _usbInterface = intf.interfaceNumber;
                    _usbEndpoint = ep.endpointNumber;
                    break outer;
                }
            }
        }
    }

    if (_usbEndpoint === null) throw new Error('No bulk-OUT endpoint found on this USB device. Is it an ESC/POS compatible printer?');

    try { await _usbDevice.claimInterface(_usbInterface); } catch (e) { /* already claimed */ }
    return _usbDevice;
}

async function webUsbWrite(data) {
    const device = await getWebUsbDevice();
    const bytes = data instanceof Uint8Array ? data : textToBytes(data);
    const result = await device.transferOut(_usbEndpoint, bytes);
    if (result.status !== 'ok') throw new Error('WebUSB transferOut status: ' + result.status);
}

/**
 * Universal USB write — picks the right backend automatically.
 * Android APK → UsbPrintBridge  |  Desktop/Web → WebUSB
 */
async function usbWrite(data) {
    if (hasNativeUsbBridge()) {
        nativeUsbWrite(data);
    } else if (navigator.usb) {
        await webUsbWrite(data);
    } else {
        throw new Error('USB printing is not supported in this environment. On desktop, use Chrome or Edge. On Android, use the ProBloom APK.');
    }
}

/**
 * Build a full ESC/POS bill receipt as Uint8Array from an order object.
 * Matches the 3-inch (48-char) reference bill design:
 *   CUSTOMER COPY banner → Shop Name (bold) → Address → Bill No / Date →
 *   Item | Qty | Rate | Amount columns → Subtotal → Total (bold+tall) →
 *   Items count → Thank You → Powered by ProBloom
 */
async function buildUsbBillBytes(order) {
    const user = JSON.parse(localStorage.getItem('km_user') || '{}');
    const settings = getPrinterSettings();
    const printGst = order.printWithGst || (order.taxAmount && order.taxAmount > 0);
    const shopName = user.restaurantName || user.shopName || 'SHOP';

    // 3-inch = 48 chars at normal font
    const W = 48;
    const DIV = '-'.repeat(W);
    const ESC_SIZE_NORMAL = [ESC, 0x21, 0x00];
    const GS_SIZE_NORMAL = [0x1D, 0x21, 0x00];
    const GS_SIZE_DOUBLE = [0x1D, 0x21, 0x11];

    function splitLayout(left, right, width = W) {
        const l = String(left);
        const r = String(right);
        const spaces = Math.max(1, width - l.length - r.length);
        return l + ' '.repeat(spaces) + r + '\n';
    }

    function billRowVerbose(name, qty, rate, total) {
        const c1 = String(name).substring(0, 24).padEnd(24);
        const c2 = String(qty).padStart(5);
        const c3 = String(rate).padStart(8);
        const c4 = String(total).padStart(11);
        return c1 + c2 + c3 + c4 + '\n';
    }

    function itemsSummaryRow(count, q, label, val) {
        const c1 = `Items: ${count}`.padEnd(14);
        const c2 = `Qty: ${Number(q).toFixed(2)}`.padEnd(16);
        const c3 = String(label).padEnd(10);
        const c4 = String(val).padStart(8);
        return c1 + c2 + c3 + c4 + '\n';
    }

    const d = order.createdAt ? new Date(order.createdAt) : new Date();
    const dateStr = d.toLocaleDateString('en-GB').replace(/\//g, '-');
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
    const billNoVal = order.orderNumber || order._id || 'N/A';

    // Check if there is an explicit serial number logic in the order, otherwise generic fallback
    const serialNo = order.serialNumber || order.receiptNumber || '1';

    const bytes = [
        ...ESC_INIT,
    ];

    // ── Insert Centered Thermal Logo if Enabled ──
    if (settings.printLogoOnBill && settings.logoUrl) {
        try {
            const logoBytes = await getProcessedLogoEscPosBytes(settings.logoUrl, 576);
            if (logoBytes) {
                bytes.push(...logoBytes);
            }
        } catch (e) {
            console.warn('USB Logo print failed:', e);
        }
    }

    bytes.push(
        ...ESC_SIZE_NORMAL,
        ...GS_SIZE_NORMAL,

        // ── Logo area / Shop Name
        ...ESC_CENTER,
        ...GS_SIZE_DOUBLE,
        ...ESC_BOLD,
        ...textToBytes(shopName + '\n'),
        ...GS_SIZE_NORMAL,
        ...ESC_UNBOLD,
        ...textToBytes('TAX INVOICE\n\n'),
        ...ESC_LEFT,


        // ── Headers Left / Right
        ...textToBytes(splitLayout('SERIAL NO ' + serialNo, dateStr)),
        ...textToBytes(splitLayout('BILL NO ' + billNoVal, timeStr)),
        ...textToBytes(DIV + '\n'),

        // ── Columns
        ...textToBytes(billRowVerbose('ITEM_NAME', 'QTY', 'RATE', 'TOTAL')),
        ...textToBytes(DIV + '\n')
    );


    let itemCount = 0;
    let totalQty = 0;
    (order.items || []).forEach(item => {
        const qty = parseFloat(item.quantity || 1);
        const rate = parseFloat(item.price || 0);
        const amt = (qty * rate).toFixed(2);
        const name = item.name || '';
        bytes.push(...textToBytes(billRowVerbose(name, qty % 1 === 0 ? Math.round(qty) : qty.toFixed(3), rate.toFixed(2), amt)));
        if (item.notes) bytes.push(...textToBytes('  * ' + item.notes + '\n'));
        itemCount++;
        totalQty += qty;
    });

    const subtotal = parseFloat(order.subtotal || 0);
    const discount = parseFloat(order.discountAmount || 0);
    const tax = printGst ? parseFloat(order.taxAmount || 0) : 0;
    const total = subtotal + tax - discount;

    bytes.push(
        ...textToBytes(DIV + '\n'),
        ...textToBytes(itemsSummaryRow(itemCount, totalQty, 'SUB TOTAL', subtotal.toFixed(2)))
    );

    if (discount > 0) {
        bytes.push(...textToBytes(splitLayout('DISCOUNT', '(-)      ' + discount.toFixed(2))));
    }
    if (printGst && tax > 0) {
        bytes.push(
            ...textToBytes(splitLayout('SGST', '(+)      ' + (tax / 2).toFixed(2))),
            ...textToBytes(splitLayout('CGST', '(+)      ' + (tax / 2).toFixed(2)))
        );
    }

    // Explicit round off calculation to match receipt visual logic if applicable
    const roundedTotal = Math.round(total);
    const roundOff = roundedTotal - total;
    if (Math.abs(roundOff) > 0.001) {
        const sign = roundOff > 0 ? '(+)      ' : '(-)      ';
        bytes.push(...textToBytes(splitLayout('ROUND OFF', sign + Math.abs(roundOff).toFixed(2))));
    }

    bytes.push(
        ...textToBytes(DIV + '\n'),
        ...GS_SIZE_DOUBLE,
        ...ESC_BOLD,
        ...textToBytes(splitLayout('NET TOTAL', roundedTotal.toFixed(2), 24)),
        ...GS_SIZE_NORMAL,
        ...ESC_UNBOLD,
        ...textToBytes(DIV + '\n'),
    );

    const payLabel = order.paymentMethod || order.payment || 'CASH';
    bytes.push(
        ...ESC_CENTER,
        ...textToBytes('PAYMENT MODE : ' + String(payLabel).toUpperCase() + '\n'),
        ...textToBytes(DIV + '\n'),
        ...textToBytes('THANK YOU ! VISIT AGAIN\n'),
        ...ESC_LEFT,
        ...ESC_FEED,
        ...ESC_CUT,
    );

    return new Uint8Array(bytes);
}

/**
 * Build ESC/POS test page bytes — matches the same 3-inch design style.
 */
async function buildUsbTestBytes() {
    const user = JSON.parse(localStorage.getItem('km_user') || '{}');
    const settings = getPrinterSettings();
    const shopName = user.restaurantName || user.shopName || 'SHOP';
    const address = user.address || '';
    const phone = user.phone || '';
    const W = 48;
    const DIV = '-'.repeat(W);

    function center(str) {
        str = String(str);
        const pad = Math.max(0, Math.floor((W - str.length) / 2));
        return ' '.repeat(pad) + str + '\n';
    }

    const bytes = [
        ...ESC_INIT,
    ];

    if (settings.printLogoOnBill && settings.logoUrl) {
        try {
            const logoBytes = await getProcessedLogoEscPosBytes(settings.logoUrl, 576);
            if (logoBytes) {
                bytes.push(...logoBytes);
            }
        } catch (e) {
            console.warn('USB test logo error:', e);
        }
    }

    bytes.push(
        ...ESC_CENTER, ...ESC_BOLD,
        ...textToBytes('** TEST PRINT **\n'),
        ...ESC_UNBOLD,
        ...ESC_BOLD, ...textToBytes(center(shopName)), ...ESC_UNBOLD,
        ...ESC_CENTER,

        ...(address ? textToBytes(address + '\n') : []),
        ...(phone ? textToBytes('Ph: ' + phone + '\n') : []),
        ...ESC_LEFT,
        ...textToBytes(DIV + '\n'),
        ...textToBytes('ProBloom USB Printer Ready\n'),
        ...textToBytes('If you can read this, your\n'),
        ...textToBytes('printer is working correctly!\n'),
        ...textToBytes(DIV + '\n'),
        ...ESC_CENTER,
        ...textToBytes('Thank You! Visit Again!\n'),
        ...textToBytes('Powered by ProBloom\n'),
        ...ESC_LEFT,
        ...ESC_FEED,
        ...ESC_CUT
    );
    return new Uint8Array(bytes);

}

// ─────────────────────────────────────────────────────────────────────────────
// Cordova bluetoothSerial helpers
// Wraps the Cordova callback-based API in Promises
// ─────────────────────────────────────────────────────────────────────────────
function btSerialConnect(address) {
    return new Promise((resolve, reject) => {
        window.bluetoothSerial.connect(address, resolve, reject);
    });
}

function btSerialWrite(data) {
    return new Promise((resolve, reject) => {
        const bytes = typeof data === 'string' ? data : new TextDecoder().decode(data);
        window.bluetoothSerial.write(bytes, resolve, reject);
    });
}

function btSerialDisconnect() {
    return new Promise((resolve) => {
        // window.bluetoothSerial.disconnect(resolve, resolve); // Disabled: keep connection permanently open as requested
        resolve();
    });
}

function btSerialIsConnected() {
    return new Promise((resolve) => {
        window.bluetoothSerial.isConnected(
            () => resolve(true),
            () => resolve(false)
        );
    });
}

async function ensureCordovaBtConnected(address) {
    const connected = await btSerialIsConnected();
    if (!connected) {
        if (!address) throw new Error('No Bluetooth device address saved. Please set the device address in Printer Settings.');
        await btSerialConnect(address);
    }
}

// Write raw bytes via Cordova bluetoothSerial
async function btSerialWriteRaw(dataOrString) {
    const text = typeof dataOrString === 'string'
        ? dataOrString
        : Array.from(dataOrString).map(b => String.fromCharCode(b)).join('');
    await btSerialWrite(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PRINTER SETTINGS from current user session
// ─────────────────────────────────────────────────────────────────────────────
export function getPrinterSettings() {
    try {
        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const local = JSON.parse(localStorage.getItem('km_printer_settings') || '{}');

        return {
            connectionType: local.printerConnectionType || user.printerConnectionType || 'network',
            billPrinterName: local.billPrinterName || user.billPrinterName || '',
            kotPrinterName: local.kotPrinterName || user.kotPrinterName || '',
            iminPaperWidth: local.iminPaperWidth || user.iminPaperWidth || 58,
            btPrinterAddress: local.btPrinterAddress || user.btPrinterAddress || '',
            kitchenPrinterIp: local.kitchenPrinterIp || user.kitchenPrinterIp || '',
            counterPrinterIp: local.counterPrinterIp || user.counterPrinterIp || '',
            printLogoOnBill: local.printLogoOnBill !== undefined ? local.printLogoOnBill : (user.printLogoOnBill !== undefined ? user.printLogoOnBill : true),
            logoUrl: local.logoUrl || user.logoUrl || user.logo || user.restaurantLogo || '',
        };
    } catch {
        return { connectionType: 'network', printLogoOnBill: true };
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZE PRINTER ON APP LOAD (keeps connection persistent)
// ─────────────────────────────────────────────────────────────────────────────
export async function initBluetoothPrinters() {
    try {
        const settings = getPrinterSettings();
        if (!settings || !settings.btPrinterAddress) return;

        const backend = getBluetoothBackend();
        if (backend === 'native') {
            if (window.BluetoothPrintBridge && !window.BluetoothPrintBridge.isConnected()) {
                window.BluetoothPrintBridge.connect(settings.btPrinterAddress);
            }
        } else if (backend === 'cordova') {
            await ensureCordovaBtConnected(settings.btPrinterAddress);
        }
    } catch (e) {
        console.warn('Silent print init fail:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT BILL — called from POS / SupermarketPOS on bill finalization
// orderId: number — the order's DB ID
// options: { connectionType?, printerIp?, printerName?, printWithGst? }
// ─────────────────────────────────────────────────────────────────────────────
export async function printBill(orderIdOrObject, options = {}) {
    const settings = getPrinterSettings();
    const connectionType = options.connectionType || settings.connectionType;

    const getOrderDetails = async () => {
        if (typeof orderIdOrObject === 'object' && orderIdOrObject !== null) {
            return orderIdOrObject;
        }
        const res = await api.get(`orders/${orderIdOrObject}`);
        const order = res.data?.data;
        if (!order) throw new Error('Order not found');
        return order;
    };

    // iMin built-in: frontend generates ESC/POS and sends via iMin SDK
    if (connectionType === 'imin_builtin') {
        try {
            const order = await getOrderDetails();
            return await iMinPrintBill(order, settings.iminPaperWidth);
        } catch (e) {
            console.error('iMin bill print error:', e);
            return { success: false, message: e.message };
        }
    }

    // Bluetooth: handled fully on frontend
    if (connectionType === 'bluetooth') {
        try {
            const order = await getOrderDetails();

            const user = JSON.parse(localStorage.getItem('km_user') || '{}');
            const template = order.billTemplate || user.basicBillTemplate || 'standard';
            const enrichedOrder = { ...order, ...options };

            if (template === '2inch') {
                return await miniBluetoothPrintBill(enrichedOrder);
            }
            return await bluetoothPrintBill(enrichedOrder);
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    // Mini Bluetooth (2-inch): handled fully on frontend
    if (connectionType === 'mini_bt') {
        try {
            const order = await getOrderDetails();
            const enrichedOrder = { ...order, ...options };
            return await miniBluetoothPrintBill(enrichedOrder);
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    // USB — handled fully in browser (Android: UsbPrintBridge, Web: WebUSB)
    if (connectionType === 'usb') {
        try {
            const order = await getOrderDetails();
            const bytes = await buildUsbBillBytes({ ...order, ...options });
            await usbWrite(bytes);
            return { success: true, message: 'Bill sent to USB printer.' };
        } catch (e) {
            console.error('USB print error:', e);
            return { success: false, message: e.message };
        }
    }


    // Network / Default — send to backend
    try {
        const payload = {
            orderId: typeof orderIdOrObject === 'string' ? orderIdOrObject : (orderIdOrObject._id || orderIdOrObject.id),
            connectionType,
            printerIp: options.printerIp || settings.counterPrinterIp,
            printerName: options.printerName || settings.billPrinterName,
        };
        // Fallback for passing raw offline object: Backend CANNOT print offline bills it doesn't know about over network. 
        if (options.printWithGst !== undefined) payload.printWithGst = options.printWithGst;
        const res = await api.post('print/bill', payload);
        return res.data;
    } catch (e) {
        return { success: false, message: e.response?.data?.message || e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT KOT — called from POS on order creation / acknowledgement
// ─────────────────────────────────────────────────────────────────────────────
export async function printKOT(orderId, options = {}) {
    const settings = getPrinterSettings();
    const connectionType = options.connectionType || settings.connectionType;

    const applyDelta = (order) => {
        if (options.itemsToPrint && options.itemsToPrint.length > 0) {
            order.items = order.items.map(dbItem => {
                const diffItem = options.itemsToPrint.find(d =>
                    (d._id && dbItem._id && String(d._id) === String(dbItem._id)) ||
                    (dbItem.menuItemId && (String(d.menuItemId?._id || d.menuItemId) === String(dbItem.menuItemId)))
                );
                if (diffItem) return { ...dbItem, quantity: diffItem.quantity };
                return null;
            }).filter(Boolean);
        }
    };

    if (connectionType === 'imin_builtin') {
        try {
            const res = await api.get(`orders/${orderId}`);
            const order = res.data?.data;
            if (!order) throw new Error('Order not found');
            applyDelta(order);
            if (options.itemsToPrint && order.items.length === 0) return { success: true, message: 'Nothing to print' };
            return await iMinPrintKOT(order);
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    if (connectionType === 'bluetooth') {
        try {
            const res = await api.get(`orders/${orderId}`);
            const order = res.data?.data;
            if (!order) throw new Error('Order not found');
            applyDelta(order);
            if (options.itemsToPrint && order.items.length === 0) return { success: true, message: 'Nothing to print' };

            const enrichedOrder = { ...order, ...options };
            const user = JSON.parse(localStorage.getItem('km_user') || '{}');
            const template = order.billTemplate || user.basicBillTemplate || 'standard';
            if (template === '2inch') {
                return await miniBluetoothPrintKOT(enrichedOrder);
            }
            return await bluetoothPrintKOT(enrichedOrder);
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    if (connectionType === 'mini_bt') {
        try {
            const res = await api.get(`orders/${orderId}`);
            const order = res.data?.data;
            if (!order) throw new Error('Order not found');
            applyDelta(order);
            if (options.itemsToPrint && order.items.length === 0) return { success: true, message: 'Nothing to print' };
            const enrichedOrder = { ...order, ...options };
            return await miniBluetoothPrintKOT(enrichedOrder);
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    // USB — handled fully in browser
    if (connectionType === 'usb') {
        try {
            // For KOT, just print a simple text receipt
            const res = await api.get(`orders/${orderId}`);
            const order = res.data?.data;
            if (!order) throw new Error('Order not found');
            applyDelta(order);
            if (options.itemsToPrint && order.items.length === 0) return { success: true, message: 'Nothing to print' };

            const user = JSON.parse(localStorage.getItem('km_user') || '{}');
            const W = 32;
            const line = '-'.repeat(W);
            const kotLines = [
                ...ESC_INIT,
                ...ESC_CENTER, ...ESC_BOLD, ...textToBytes('KOT\n'), ...ESC_UNBOLD,
                ...ESC_LEFT,
                ...textToBytes(line + '\n'),
                ...textToBytes('Order: ' + (order.orderNumber || order._id || 'N/A') + '\n'),
                ...textToBytes('Date : ' + new Date(order.createdAt || Date.now()).toLocaleTimeString() + '\n'),
                ...textToBytes((order.waiterName ? 'Staff: ' + order.waiterName + '\n' : '')),
                ...textToBytes(line + '\n'),
            ];
            (order.items || []).forEach(item => {
                const qty = Math.round(item.quantity || 1);
                kotLines.push(...textToBytes((item.name || '').substring(0, 24).padEnd(24) + ' x' + qty + '\n'));
                if (item.notes) kotLines.push(...textToBytes('  *' + item.notes + '\n'));
            });
            kotLines.push(...textToBytes(line + '\n'), ...ESC_FEED, ...ESC_CUT);
            await usbWrite(new Uint8Array(kotLines));
            return { success: true, message: 'KOT sent to USB printer.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    // Network / Default
    try {
        const res = await api.post('print/kot', {
            orderId,
            connectionType,
            printerIp: options.printerIp || settings.kitchenPrinterIp,
            printerName: options.printerName || settings.kotPrinterName,
        });
        return res.data;
    } catch (e) {
        return { success: false, message: e.response?.data?.message || e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST PRINT — from PrinterSettingsModal "Test" button
// ─────────────────────────────────────────────────────────────────────────────
export async function testPrint(connectionType, options = {}) {
    const settings = getPrinterSettings();

    if (connectionType === 'imin_builtin') return await iMinTestPrint();
    if (connectionType === 'bluetooth') return await bluetoothTestPrint(options.btAddress || settings.btPrinterAddress);
    if (connectionType === 'mini_bt') return await miniBluetoothTestPrint(options.btAddress || settings.btPrinterAddress);

    // USB — handled fully in browser
    if (connectionType === 'usb') {
        try {
            const bytes = await buildUsbTestBytes();
            await usbWrite(bytes);
            return { success: true, message: 'Test page sent to USB printer successfully!' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }


    try {
        const res = await api.post('print/test', {
            connectionType,
            printerIp: options.printerIp || settings.counterPrinterIp || settings.kitchenPrinterIp,
            printerName: options.printerName || settings.billPrinterName || '',
        });
        return res.data;
    } catch (e) {
        return { success: false, message: e.response?.data?.message || e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST OS PRINTERS (USB / Default) — from backend
// ─────────────────────────────────────────────────────────────────────────────
export async function listOsPrinters() {
    try {
        const res = await api.get('print/list');
        return res.data?.printers || [];
    } catch (e) {
        console.warn('Could not fetch printer list:', e);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// iMIN BUILT-IN PRINTER HELPERS (iMin D1 — WebView SDK)
// Docs: https://developer.imin.sg/en/resource/api
// ─────────────────────────────────────────────────────────────────────────────

async function iMinPrintKOT(order) {
    const sdk = getIMin();
    if (!sdk) return { success: false, message: 'iMin SDK not available. Are you running on the iMin device APK?' };

    try {
        sdk.printerInit();
        sdk.setAlignment(1); // center
        sdk.setTextSizeMultiple(1, 1);
        sdk.printText('KOT\n');
        sdk.setAlignment(0); // left
        sdk.printText('--------------------------------\n');
        sdk.printText(`Order: ${order.orderNumber || order._id || 'N/A'}\n`);
        sdk.printText(`Loc  : ${getDisplayName(order)}\n`);
        sdk.printText(`Date : ${formatDate(order.createdAt)}\n`);
        if (order.waiterName) sdk.printText(`Staff: ${order.waiterName}\n`);
        sdk.printText('--------------------------------\n');
        sdk.setTextSizeMultiple(1, 1);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        (order.items || []).forEach(item => {
            const qty = Math.round(item.quantity || 1);
            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');
            sdk.printText(`${displayName.substring(0, 24).padEnd(24)} x${qty}\n`);
            if (item.notes) sdk.printText(`  *${item.notes}\n`);
        });

        sdk.printText('--------------------------------\n');
        sdk.printAndFeedPaper(100);
        sdk.cutPaper(1);
        return { success: true, message: 'KOT printed on iMin built-in printer' };
    } catch (e) {
        return { success: false, message: `iMin KOT error: ${e.message}` };
    }
}

async function iMinPrintBill(order, paperWidth = 58) {
    const sdk = getIMin();
    if (!sdk) return { success: false, message: 'iMin SDK not available. Are you running on the iMin device APK?' };

    try {
        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const printGst = order.printWithGst || (order.taxAmount && order.taxAmount > 0);

        sdk.printerInit();
        const settings = getPrinterSettings();
        if (settings.printLogoOnBill && settings.logoUrl) {
            try {
                sdk.setAlignment(1);
                const pWidth = paperWidth === 80 ? 576 : 384;
                const processed = await processLogoForThermalCanvas(settings.logoUrl, pWidth);
                if (typeof sdk.printSingleBitmap === 'function') {
                    sdk.printSingleBitmap(processed.dataUrl);
                }
            } catch (e) {
                console.warn('iMin logo print error:', e);
            }
        }
        sdk.setAlignment(1); // center
        sdk.setTextSizeMultiple(1, 1);
        sdk.printText((user.restaurantName || 'RESTAURANT') + '\n');

        sdk.setAlignment(0);
        if (user.address) sdk.printText(user.address + '\n');
        if (user.phone) sdk.printText('Ph: ' + user.phone + '\n');
        if (printGst && user.gstNumber) sdk.printText('GSTIN: ' + user.gstNumber + '\n');
        sdk.printText('--------------------------------\n');
        sdk.setAlignment(1);
        sdk.printText(printGst ? 'TAX INVOICE\n' : 'RETAIL BILL\n');
        sdk.setAlignment(0);
        sdk.printText('--------------------------------\n');
        sdk.printText(`Bill   : ${order.orderNumber || order._id}\n`);
        sdk.printText(`Date   : ${formatDate(order.createdAt)}\n`);
        sdk.printText('--------------------------------\n');
        sdk.printText(`${'Item'.padEnd(19)} ${'Qty'.padStart(4)} ${'Amt'.padStart(8)}\n`);
        sdk.printText('--------------------------------\n');

        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        (order.items || []).forEach(item => {
            const qty = item.quantity || 1;
            const price = item.price || 0;
            const amt = (qty * price).toFixed(2);

            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');
            const name = displayName.substring(0, 19).padEnd(19);

            const qtyStr = String(Math.round(qty)).padStart(4);
            sdk.printText(`${name}${qtyStr} ${String(amt).padStart(8)}\n`);
        });

        sdk.printText('--------------------------------\n');
        sdk.setAlignment(2); // right
        const subtotal = order.subtotal || 0;
        const discount = order.discountAmount || 0;
        const tax = printGst ? (order.taxAmount || 0) : 0;
        const total = subtotal + tax - discount;
        sdk.printText(`Subtotal: ${subtotal.toFixed(2)}\n`);
        if (printGst && tax > 0) {
            sdk.printText(`SGST:  ${(tax / 2).toFixed(2)}\n`);
            sdk.printText(`CGST:  ${(tax / 2).toFixed(2)}\n`);
        }
        if (discount > 0) sdk.printText(`Discount: -${discount.toFixed(2)}\n`);
        sdk.printText('--------------------------------\n');
        sdk.setTextSizeMultiple(1, 1);
        sdk.printText(`TOTAL: ${total.toFixed(2)}\n`);
        sdk.printText('--------------------------------\n');
        sdk.setAlignment(1);
        sdk.printText(`Payment: ${getPaymentLabel(order)}\n`);
        sdk.printText('\nThank You! Visit Again.\n');
        sdk.printText('Software by ProBloom\n');
        sdk.printAndFeedPaper(100);
        sdk.cutPaper(1);
        return { success: true, message: 'Bill printed on iMin built-in printer' };
    } catch (e) {
        return { success: false, message: `iMin Bill error: ${e.message}` };
    }
}

async function iMinTestPrint() {
    const sdk = getIMin();
    if (!sdk) return { success: false, message: 'iMin SDK not available. Are you running on the iMin device APK?' };
    try {
        sdk.printerInit();
        sdk.setAlignment(1);
        sdk.setTextSizeMultiple(1, 1);
        sdk.printText('TEST PRINT\n');
        sdk.setAlignment(0);
        sdk.printText('--------------------------------\n');
        sdk.printText('ProBloom POS System\n');
        sdk.printText('iMin D1 Built-in Printer\n');
        sdk.printText('--------------------------------\n');
        sdk.printText('If you can read this,\nyour printer is working!\n');
        sdk.printText('--------------------------------\n');
        sdk.printAndFeedPaper(100);
        sdk.cutPaper(1);
        return { success: true, message: 'Test print sent to iMin built-in printer' };
    } catch (e) {
        return { success: false, message: `iMin test error: ${e.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLUETOOTH PRINTER HELPERS (Web Bluetooth API)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Web Bluetooth helpers (Chrome/Edge on desktop or Android browser)
// ─────────────────────────────────────────────────────────────────────────────
let _btDevice = null;
let _btCharacteristic = null;

// BT printer service/char UUIDs for common ESC/POS printers
const BT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const BT_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

async function getBtCharacteristic() {
    if (_btCharacteristic && _btDevice?.gatt?.connected) return _btCharacteristic;
    if (!navigator.bluetooth) throw new Error('Bluetooth not supported in this browser. Use the ProBloom APK on the iMin device.');

    _btDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BT_SERVICE_UUID],
    });
    const server = await _btDevice.gatt.connect();
    const service = await server.getPrimaryService(BT_SERVICE_UUID);
    _btCharacteristic = await service.getCharacteristic(BT_CHAR_UUID);
    return _btCharacteristic;
}

async function webBtWrite(data) {
    const char = await getBtCharacteristic();
    const bytes = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;
    // Web BT has 512-byte MTU limit — chunk it
    const CHUNK = 200;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        await char.writeValue(bytes.slice(i, i + CHUNK));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESC/POS RASTER IMAGE GENERATOR (TEXT TO BITMAP)
// ─────────────────────────────────────────────────────────────────────────────
async function printRowAsImage(textObjList, paperWidthDots, btAddress) {
    const canvas = document.createElement('canvas');
    canvas.width = paperWidthDots;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');

    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';

    for (const item of textObjList) {
        ctx.font = item.font || '22px "Noto Sans Tamil", "Mukta Malar", "Latha", sans-serif';
        ctx.textAlign = item.align || 'left';
        ctx.fillText(item.text, item.x, canvas.height / 2 + 2);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bytesWidth = Math.ceil(canvas.width / 8);

    // GS v 0 0 pL pH yL yH
    const payload = [0x1D, 0x76, 0x30, 0];
    payload.push(bytesWidth & 0xFF);
    payload.push((bytesWidth >> 8) & 0xFF);
    payload.push(canvas.height & 0xFF);
    payload.push((canvas.height >> 8) & 0xFF);

    for (let y = 0; y < canvas.height; y++) {
        for (let xBytes = 0; xBytes < bytesWidth; xBytes++) {
            let b = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = xBytes * 8 + bit;
                if (x < canvas.width) {
                    const idx = (y * canvas.width + x) * 4;
                    // Check if pixel is dark (r < 128)
                    if (imgData[idx] < 128) {
                        b |= (1 << (7 - bit));
                    }
                }
            }
            payload.push(b);
        }
    }

    await btWrite(new Uint8Array(payload), btAddress);
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified btWrite — routes to: Native Bridge → Cordova → Web Bluetooth
// ─────────────────────────────────────────────────────────────────────────────
let _cordovaBtAddress = null;
let _nativeBtAddress = null;

async function btWrite(data, btAddress) {
    const backend = getBluetoothBackend();

    if (backend === 'native') {
        // Android APK: use window.BluetoothPrintBridge (RFCOMM/SPP — most reliable)
        const address = btAddress || _nativeBtAddress || getPrinterSettings().btPrinterAddress;
        if (!address) throw new Error('No Bluetooth device address saved. Please enter the printer\'s MAC address in Printer Settings.');
        if (address !== _nativeBtAddress || !window.BluetoothPrintBridge.isConnected()) {
            const result = window.BluetoothPrintBridge.connect(address);
            if (result && result.startsWith('error:')) throw new Error(result.substring(6));
            _nativeBtAddress = address;
        }
        // For Uint8Array (ESC/POS bytes), send as hex string
        let writeResult;
        if (data instanceof Uint8Array) {
            const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            writeResult = window.BluetoothPrintBridge.printHex(hex);
        } else {
            writeResult = window.BluetoothPrintBridge.print(data);
        }
        if (writeResult && writeResult.startsWith('error:')) throw new Error(writeResult.substring(6));
        return;
    }

    if (backend === 'cordova') {
        // Android APK: use cordova-plugin-bluetooth-serial
        const address = btAddress || _cordovaBtAddress || getPrinterSettings().btPrinterAddress;
        if (address) _cordovaBtAddress = address;
        await ensureCordovaBtConnected(address);
        await btSerialWriteRaw(data);
        return;
    }

    if (backend === 'web') {
        await webBtWrite(data);
        return;
    }

    throw new Error('Bluetooth adapter not available. On the iMin tablet, make sure the ProBloom APK has Bluetooth permission granted in Settings.');
}

async function bluetoothTestPrint(btAddress) {
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);
        const backend = getBluetoothBackend();
        if (!backend) throw new Error('No Bluetooth backend available. Bluetooth adapter not found or permission denied.');
        await btWrite(ESC_INIT, btAddress);
        await btWrite('TEST PRINT\n--------------------------------\nProBloom Bluetooth Printer\nIf you can read this, BT works!\n--------------------------------\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (backend === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Bluetooth test print sent successfully!' };
    } catch (e) {
        return { success: false, message: `Bluetooth error: ${e.message}` };
    }
}

async function bluetoothPrintBill(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
        const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const printGst = order.printWithGst || (order.taxAmount && order.taxAmount > 0);

        const W = 48; // 3-inch paper width is usually 48 characters
        const SOLID_SEP = '-'.repeat(W) + '\n';
        const DASH_SEP = '- '.repeat(Math.floor(W / 2)) + '\n';

        await btWrite(ESC_INIT, btAddress);

        // ── Print Logo if enabled ──
        if (settings.printLogoOnBill && settings.logoUrl) {
            try {
                const logoBytes = await getProcessedLogoEscPosBytes(settings.logoUrl, 576);
                if (logoBytes) await btWrite(logoBytes, btAddress);
            } catch (e) {
                console.warn('3-inch BT logo print error:', e);
            }
        }

        // ── Header ──
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);

        await btWrite(`${user.restaurantName || 'SHOP'}\n`, btAddress);
        await btWrite(BOLD_OFF, btAddress);

        const gstinStr = (printGst && user.gstNumber) ? `GSTIN: ${user.gstNumber}` : 'GSTIN: N/A';
        await btWrite(`${gstinStr}\n`, btAddress);

        await btWrite(ALIGN_LEFT, btAddress);
        await btWrite(SOLID_SEP, btAddress);

        // ── Bill Info ──
        const billNoStr = `Bill No: ${order.orderNumber || order._id || ''}`;
        let locStr = '';
        if (order.tableId) locStr = `Table: ${order.tableId.name}`;

        if (locStr) {
            await btWrite(rPad(billNoStr, locStr, W) + '\n', btAddress);
        } else {
            await btWrite(billNoStr + '\n', btAddress);
        }
        await btWrite(SOLID_SEP, btAddress);

        const dateStr = `Date: ${new Date(order.createdAt || Date.now()).toLocaleString()}`;
        // toLocaleString produces format akin to 8/4/2026, 6:08:15 AM based on environment, but typically suffices.
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(`${dateStr}\n`, btAddress);

        await btWrite(ALIGN_LEFT, btAddress);
        await btWrite(SOLID_SEP, btAddress);

        // ── Items Header ──
        const iHead = 'Item'.padEnd(21) + 'Qty'.padStart(7) + 'Price'.padStart(10) + 'Amt'.padStart(10);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(iHead + '\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(SOLID_SEP, btAddress);

        // ── Items ──
        let totalItems = 0;
        let totalQty = 0;
        const taxType = order.taxType || 'Exclusive';
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = item.quantity || 1;
            let price = item.price || 0;

            if (printGst && taxType === 'Inclusive') {
                if (item.tax !== undefined && item.total !== undefined) {
                    price = (item.total - item.tax) / qty;
                } else if (item.taxRate) {
                    price = price / (1 + (item.taxRate / 100));
                } else if (order.taxRate) {
                    price = price / (1 + (order.taxRate / 100));
                }
            }

            const amt = (qty * price).toFixed(2);
            const rateStr = price.toFixed(2);
            const fQty = (qty % 1 !== 0 || (item.unit && String(item.unit).toLowerCase().startsWith('m')))
                ? `1(${qty}m)` : String(qty);

            const tName = item.tamilName || null;
            if (printLang === 'ta' && tName) {
                // RENDER TAMIL AS IMAGE
                const pWidth = 576; // 3-inch 80mm dots
                await printRowAsImage([
                    { text: tName.substring(0, 20), x: 0, align: 'left', font: 'bold 22px "Noto Sans Tamil", "Mukta Malar", "Latha", sans-serif' },
                    { text: fQty, x: 300, align: 'center', font: '22px monospace' },
                    { text: rateStr, x: 440, align: 'right', font: '22px monospace' },
                    { text: amt, x: 560, align: 'right', font: '22px monospace' }
                ], pWidth, btAddress);
            } else {
                const displayName = item.name || '';
                const nmLines = wrapText(displayName, 20);
                for (let i = 0; i < nmLines.length; i++) {
                    const namePart = nmLines[i].padEnd(21);
                    if (i === nmLines.length - 1) {
                        const qtyStr = fQty.padStart(7);
                        const pStr = rateStr.padStart(10);
                        const aStr = amt.padStart(10);
                        await btWrite(namePart + qtyStr + pStr + aStr + '\n', btAddress);
                    } else {
                        await btWrite(namePart + '\n', btAddress);
                    }
                }
            }

            totalItems++;
            totalQty += qty;
        }
        await btWrite(DASH_SEP, btAddress);

        // ── Totals ──
        const subtotal = order.subtotal || 0;
        const discount = order.discountAmount || 0;
        const netAfterDiscount = subtotal - discount;

        let taxableValue = netAfterDiscount;
        let taxAmount = printGst ? (order.taxAmount || 0) : 0;
        let grandTotal = netAfterDiscount + taxAmount;
        let taxRate = order.taxRate || 5;

        // Adjust if inclusive
        if (printGst && taxType === 'Inclusive') {
            taxableValue = netAfterDiscount - taxAmount;
            grandTotal = netAfterDiscount;
        }

        await btWrite(rPad('Gross Total:', 'Rs. ' + taxableValue.toFixed(2), W) + '\n', btAddress);

        if (printGst && taxAmount > 0) {
            await btWrite(DASH_SEP, btAddress);
            await btWrite(rPad('Taxable Value:', 'Rs. ' + taxableValue.toFixed(2), W) + '\n', btAddress);
            await btWrite(rPad(`SGST (${(taxRate / 2).toFixed(1)}%):`, 'Rs. ' + (taxAmount / 2).toFixed(2), W) + '\n', btAddress);
            await btWrite(rPad(`CGST (${(taxRate / 2).toFixed(1)}%):`, 'Rs. ' + (taxAmount / 2).toFixed(2), W) + '\n', btAddress);
        }

        await btWrite(SOLID_SEP, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(rPad('GRAND TOTAL:', 'Rs. ' + grandTotal.toFixed(2), W) + '\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(DASH_SEP, btAddress);

        await btWrite(`Total Items: ${totalItems}\n`, btAddress);
        await btWrite(`Payment: ${getPaymentLabel(order)}\n`, btAddress);
        await btWrite(DASH_SEP, btAddress);

        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite('Thank You! Visit Again\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);

        await btWrite(centerText('Software by ProBloom', W) + '\n', btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);

        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Bill printed via Bluetooth' };
    } catch (e) {
        return { success: false, message: `Bluetooth Bill error: ${e.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI BLUETOOTH (2-inch) PRINTER HELPERS
// 32-character width template, no staff name, shop info from company profile
// ─────────────────────────────────────────────────────────────────────────────

const MINI_SEP = '--------------------------------\n'; // 32 dashes

async function miniBluetoothTestPrint(btAddress) {
    const settings = getPrinterSettings();
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ESC_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const ESC_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);
        const backend = getBluetoothBackend();
        if (!backend) throw new Error('No Bluetooth backend available.');
        await btWrite(ESC_INIT, btAddress);
        if (settings.printLogoOnBill && settings.logoUrl) {
            try {
                const logoBytes = await getProcessedLogoEscPosBytes(settings.logoUrl, 384);
                if (logoBytes) await btWrite(logoBytes, btAddress);
            } catch (e) { console.warn('Mini test print logo error:', e); }
        }
        await btWrite(ESC_ALIGN_CENTER, btAddress);
        await btWrite('TEST PRINT\n', btAddress);
        await btWrite(ESC_ALIGN_LEFT, btAddress);
        await btWrite(MINI_SEP, btAddress);
        await btWrite('ProBloom Mini BT Printer\n', btAddress);
        await btWrite('2-inch thermal — 32 chars/line\n', btAddress);
        await btWrite(MINI_SEP, btAddress);
        await btWrite('If you can read this, BT works!\n', btAddress);
        await btWrite(MINI_SEP, btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (backend === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Mini BT test print sent!' };
    } catch (e) {
        return { success: false, message: `Mini BT error: ${e.message}` };
    }
}

async function miniBluetoothPrintBill(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const W = 32; // 2-inch paper: 32 chars per line
        const MINI_SEP = '- - - - - - - - - - - - - - - -\n';

        await btWrite(ESC_INIT, btAddress);

        // ── Print Logo if enabled ──
        if (settings.printLogoOnBill && settings.logoUrl) {
            try {
                const logoBytes = await getProcessedLogoEscPosBytes(settings.logoUrl, 384);
                if (logoBytes) await btWrite(logoBytes, btAddress);
            } catch (e) {
                console.warn('2-inch BT logo print error:', e);
            }
        }

        // ── Shop Header ──
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite((user.restaurantName || 'SHOP') + '\n', btAddress);
        if (user.address) {
            wrapText(user.address, W).forEach(line => btWrite(line + '\n', btAddress));
        }
        if (user.phone) await btWrite(user.phone + '\n', btAddress);
        await btWrite(ALIGN_LEFT, btAddress);

        // ── Bill Info ──
        const d = new Date(order.createdAt || Date.now());
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const dateStr = `${day}/${month}/${year} ${hrs}:${mins}`;

        // Ensure orderID is a string like '2'
        const orderIdStr = String(order.orderNumber || order._id || '');
        const billNoStr = `BILL NO: ${orderIdStr}`;

        const spacesForBillRow = Math.max(0, W - billNoStr.length - dateStr.length);
        await btWrite(billNoStr + ' '.repeat(spacesForBillRow) + dateStr + '\n', btAddress);

        await btWrite(MINI_SEP, btAddress);

        // ── Items Header ──
        await btWrite('ITEM     QTY        RATE   AMOUNT\n', btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Items ──
        let totalItems = 0;
        let totalQty = 0;
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = item.quantity || 1;
            const price = item.price || 0;

            const amt = (qty * price).toFixed(2);
            const rateStr = price.toFixed(2);

            const fQty = (qty % 1 !== 0 || (item.unit && String(item.unit).toLowerCase().startsWith('m')))
                ? `1(${qty}m)` : String(qty);

            const tName = item.tamilName || null;
            if (printLang === 'ta' && tName) {
                // RENDER TAMIL AS IMAGE
                const pWidth = 384;
                await printRowAsImage([
                    { text: tName.substring(0, 15), x: 0, align: 'left', font: 'bold 24px "Noto Sans Tamil", "Mukta Malar", "Latha", sans-serif' },
                    { text: fQty, x: 220, align: 'center', font: '22px monospace' },
                    { text: rateStr, x: 300, align: 'right', font: '22px monospace' },
                    { text: amt, x: 380, align: 'right', font: '22px monospace' }
                ], pWidth, btAddress);
            } else {
                const displayName = item.name || '';
                const name = displayName.substring(0, 8).padEnd(8);
                const qtyStr = fQty.padEnd(8);
                const rateStrPad = String(rateStr).padStart(7);
                const amtStr = String(amt).padStart(9);
                await btWrite(`${name}${qtyStr}${rateStrPad}${amtStr}\n`, btAddress);
            }
            totalItems++;
            totalQty += qty;
        }
        await btWrite(MINI_SEP, btAddress);

        await btWrite(`ITEM: ${totalItems} QTY: ${totalQty}\n`, btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Totals ──
        const subtotal = order.subtotal || 0;
        const discount = order.discountAmount || 0;
        const tax = order.taxAmount || 0;
        const total = subtotal + tax - discount;

        await btWrite(`GRAND TOTAL : ` + `Rs. `.padEnd(5) + String(total.toFixed(2)).padStart(13) + '\n', btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Footer ──
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite('         THANK YOU\n', btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);

        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Bill printed via Mini Bluetooth' };
    } catch (e) {
        return { success: false, message: `Mini BT Bill error: ${e.message}` };
    }
}

async function miniBluetoothPrintKOT(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
        const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');

        await btWrite(ESC_INIT, btAddress);
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite('KOT\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        if (user.restaurantName) await btWrite(user.restaurantName + '\n', btAddress);
        await btWrite(ALIGN_LEFT, btAddress);
        await btWrite(MINI_SEP, btAddress);
        await btWrite(`Order: ${order.orderNumber || order._id || 'N/A'}\n`, btAddress);
        await btWrite(`Loc  : ${getDisplayName(order)}\n`, btAddress);
        await btWrite(`Date : ${formatDate(order.createdAt)}\n`, btAddress);
        await btWrite(MINI_SEP, btAddress);

        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = Math.round(item.quantity || 1);
            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');

            await btWrite(BOLD_ON, btAddress);
            await btWrite(`${displayName.substring(0, 26).padEnd(26)} x${qty}\n`, btAddress);
            await btWrite(BOLD_OFF, btAddress);
            if (item.notes) await btWrite(`  * ${item.notes}\n`, btAddress);
        }
        await btWrite(MINI_SEP, btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'KOT printed via Mini Bluetooth' };
    } catch (e) {
        return { success: false, message: `Mini BT KOT error: ${e.message}` };
    }
}

async function bluetoothPrintKOT(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ESC_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ESC_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        await btWrite(ESC_INIT, btAddress);
        await btWrite(ESC_ALIGN_CENTER, btAddress);
        await btWrite('KOT\n', btAddress);
        await btWrite(ESC_ALIGN_LEFT, btAddress);
        await btWrite('--------------------------------\n', btAddress);
        await btWrite(`Order: ${order.orderNumber || order._id || 'N/A'}\n`, btAddress);
        await btWrite(`Loc  : ${getDisplayName(order)}\n`, btAddress);
        await btWrite(`Date : ${formatDate(order.createdAt)}\n`, btAddress);
        await btWrite('--------------------------------\n', btAddress);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = Math.round(item.quantity || 1);
            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');

            await btWrite(`${displayName.substring(0, 24).padEnd(24)} x${qty}\n`, btAddress);
            if (item.notes) await btWrite(`  *${item.notes}\n`, btAddress);
        }
        await btWrite('--------------------------------\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'KOT printed via Bluetooth' };
    } catch (e) {
        return { success: false, message: `Bluetooth KOT error: ${e.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getDisplayName(order) {
    if (order?.tableNumber) return `Table ${order.tableNumber}`;
    if (order?.tokenNumber) return `Token ${order.tokenNumber}`;
    return 'Takeaway';
}

function formatDate(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Formats a date string (YYYY-MM-DD or Date) to DD-MM-YYYY */
function formatShortDate(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d)) return String(dt);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/**
 * Smart payment label: reads selectedPaymentLabel from order first (user's explicit choice),
 * then falls back to auto-detecting from tenderCash/tenderUPI/tenderCard amounts.
 */
function getPaymentLabel(order) {
    // Explicit user selection takes highest priority
    if (order?.selectedPaymentLabel) return order.selectedPaymentLabel;

    const cash = parseFloat(order?.tenderCash) || 0;
    const upi = parseFloat(order?.tenderUPI) || 0;
    const card = parseFloat(order?.tenderCard) || 0;
    const parts = [];
    if (cash > 0) parts.push(`CASH ${cash.toFixed(0)}`);
    if (upi > 0) parts.push(`UPI ${upi.toFixed(0)}`);
    if (card > 0) parts.push(`CARD ${card.toFixed(0)}`);
    if (parts.length > 0) return parts.join(' + ');
    // Fallback to whatever the backend stored
    return (order?.paymentMethod || 'CASH').toUpperCase();
}

/** Center-align text within a given width */
function centerText(text, width) {
    const t = String(text || '').substring(0, width);
    const pad = Math.max(0, Math.floor((width - t.length) / 2));
    return ' '.repeat(pad) + t;
}

/** Right-pad a label and right-align a value within given width: "Label      value" */
function rPad(label, value, width) {
    const l = String(label);
    const v = String(value);
    const space = width - l.length - v.length;
    return l + ' '.repeat(Math.max(1, space)) + v;
}

/** Word-wrap text at maxWidth characters */
function wrapText(text, maxWidth) {
    const words = String(text || '').split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        if ((current + (current ? ' ' : '') + word).length <= maxWidth) {
            current += (current ? ' ' : '') + word;
        } else {
            if (current) lines.push(current);
            current = word.substring(0, maxWidth);
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

// ─────────────────────────────────────────────────────────────────────────────
// STITCHING BILL — Mini BT 2-inch printer only
// Shows: shop info, customer, items, amount paid, balance, delivery date
// ─────────────────────────────────────────────────────────────────────────────

async function bluetoothPrintStitchingBill(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
        const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const W = 48;
        const SEP = '-'.repeat(48) + '\n';

        const total = parseFloat(order.total || order.subtotal || 0);
        const amountPaid = parseFloat(order.amountPaid || 0);
        const balanceAmount = parseFloat(order.balanceAmount ?? Math.max(0, total - amountPaid));
        const deliveryDate = order.deliveryDate || '';

        await btWrite(ESC_INIT, btAddress);
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(`${user.restaurantName || 'SHOP'}\n`, btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(ALIGN_LEFT, btAddress);
        if (user.phone) await btWrite('Ph: ' + user.phone + '\n', btAddress);
        await btWrite(SEP, btAddress);

        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite('STITCHING BILL\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(ALIGN_LEFT, btAddress);
        await btWrite(SEP, btAddress);

        await btWrite(`Bill No : ${order.orderNumber || order.billNo || order._id}\n`, btAddress);
        await btWrite(`Date    : ${formatDate(order.createdAt)}\n`, btAddress);
        if (order.customerName) await btWrite(`Cust    : ${String(order.customerName).substring(0, 35)}\n`, btAddress);
        if (order.customerPhone) await btWrite(`Ph      : ${order.customerPhone}\n`, btAddress);
        if (deliveryDate) await btWrite(`Deliv.  : ${formatShortDate(deliveryDate)}\n`, btAddress);
        await btWrite(SEP, btAddress);

        const iHead = 'Item'.padEnd(20) + ' ' + 'Qty'.padStart(5) + ' ' + 'Rate'.padStart(9) + ' ' + 'Amt'.padStart(10);
        await btWrite(iHead + '\n', btAddress);
        await btWrite(SEP, btAddress);
        const taxType = order.taxType || 'Inclusive';
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.printLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = item.quantity || 1;
            let price = item.price || 0;

            if (order.printWithGst && taxType === 'Inclusive' && item.taxRate) {
                price = price / (1 + (item.taxRate / 100));
            } else if (order.printWithGst && taxType === 'Inclusive' && order.taxType === 'Inclusive') {
                const tr = typeof order.taxRate === 'number' ? order.taxRate : 18;
                price = price / (1 + (tr / 100));
            }

            const amt = (qty * price).toFixed(2);
            const rateStr = price.toFixed(2);

            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');

            const name = displayName.substring(0, 20).padEnd(20);
            const qtyStr = String(Math.round(qty)).padStart(5);
            const rateStrPad = String(rateStr).padStart(9);
            const amtStr = String(amt).padStart(10);

            await btWrite(`${name} ${qtyStr} ${rateStrPad} ${amtStr}\n`, btAddress);
        }
        await btWrite(SEP, btAddress);

        await btWrite(rPad('Total', total.toFixed(2), W) + '\n', btAddress);
        await btWrite(SEP, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(rPad('Paid', amountPaid.toFixed(2), W) + '\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        if (balanceAmount > 0) {
            await btWrite(BOLD_ON, btAddress);
            await btWrite(rPad('Balance Due', balanceAmount.toFixed(2), W) + '\n', btAddress);
            await btWrite(BOLD_OFF, btAddress);
        } else {
            await btWrite(rPad('Balance', '0.00', W) + '\n', btAddress);
        }
        await btWrite(SEP, btAddress);

        await btWrite(ALIGN_CENTER, btAddress);
        if (deliveryDate) {
            await btWrite(`Delivery: ${formatShortDate(deliveryDate)}\n`, btAddress);
        }
        await btWrite('\nThank You! Visit Again.\n', btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Stitching bill printed via Bluetooth' };
    } catch (e) {
        return { success: false, message: `Stitching bill error: ${e.message}` };
    }
}

async function miniBluetoothPrintStitchingBill(order) {
    const settings = getPrinterSettings();
    const btAddress = settings.btPrinterAddress;
    try {
        const ESC_INIT = new Uint8Array([0x1b, 0x40]);
        const ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        const ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01]);
        const BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00]);
        const CUT = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);

        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        const W = 32;

        const total = parseFloat(order.total || order.subtotal || 0);
        const amountPaid = parseFloat(order.amountPaid || 0);
        const balanceAmount = parseFloat(order.balanceAmount ?? Math.max(0, total - amountPaid));
        const deliveryDate = order.deliveryDate || '';

        await btWrite(ESC_INIT, btAddress);

        // ── Shop Header ──
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(centerText(user.restaurantName || 'SHOP', W) + '\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(ALIGN_LEFT, btAddress);
        if (user.phone) await btWrite('Ph: ' + user.phone + '\n', btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Title ──
        await btWrite(ALIGN_CENTER, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite('STITCHING BILL\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        await btWrite(ALIGN_LEFT, btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Bill Info ──
        await btWrite(`Bill : ${order.orderNumber || order.billNo || order._id}\n`, btAddress);
        await btWrite(`Date : ${formatDate(order.createdAt)}\n`, btAddress);
        if (order.customerName) await btWrite(`Cust : ${String(order.customerName).substring(0, 24)}\n`, btAddress);
        if (order.customerPhone) await btWrite(`Ph   : ${order.customerPhone}\n`, btAddress);
        if (deliveryDate) await btWrite(`Del  : ${formatShortDate(deliveryDate)}\n`, btAddress);
        await btWrite(MINI_SEP, btAddress);

        // ── Items ──
        const iHead = 'Item'.padEnd(12) + ' ' + 'Qty'.padStart(3) + ' ' + 'Rate'.padStart(7) + ' ' + 'Amt'.padStart(7);
        await btWrite(iHead + '\n', btAddress);
        await btWrite(MINI_SEP, btAddress);
        const taxType = order.taxType || 'Inclusive';
        const printLang = order.printLang || localStorage.getItem('printLanguage') || user.defaultPrintLanguage || 'en';

        for (const item of (order.items || [])) {
            const qty = item.quantity || 1;
            let price = item.price || 0;

            if (order.printWithGst && taxType === 'Inclusive' && item.taxRate) {
                price = price / (1 + (item.taxRate / 100));
            } else if (order.printWithGst && taxType === 'Inclusive' && order.taxType === 'Inclusive') {
                const tr = typeof order.taxRate === 'number' ? order.taxRate : 18;
                price = price / (1 + (tr / 100));
            }

            const amt = (qty * price).toFixed(2);
            const rateStr = price.toFixed(2);

            const tName = item.tamilName || null;
            const displayName = (printLang === 'ta' && tName) ? tName : (item.name || '');

            const name = displayName.substring(0, 12).padEnd(12);
            const qtyStr = String(Math.round(qty)).padStart(3);
            const rateStrPad = String(rateStr).padStart(7);
            const amtStr = String(amt).padStart(7);

            await btWrite(`${name} ${qtyStr} ${rateStrPad} ${amtStr}\n`, btAddress);
        }
        await btWrite(MINI_SEP, btAddress);

        // ── Totals ──
        await btWrite(rPad('Total', total.toFixed(2), W) + '\n', btAddress);
        await btWrite(MINI_SEP, btAddress);
        await btWrite(BOLD_ON, btAddress);
        await btWrite(rPad('Paid', amountPaid.toFixed(2), W) + '\n', btAddress);
        await btWrite(BOLD_OFF, btAddress);
        if (balanceAmount > 0) {
            await btWrite(BOLD_ON, btAddress);
            await btWrite(rPad('Balance Due', balanceAmount.toFixed(2), W) + '\n', btAddress);
            await btWrite(BOLD_OFF, btAddress);
        } else {
            await btWrite(rPad('Balance', '0.00', W) + '\n', btAddress);
        }
        await btWrite(MINI_SEP, btAddress);

        // ── Footer ──
        await btWrite(ALIGN_CENTER, btAddress);
        if (deliveryDate) {
            await btWrite(`Delivery: ${formatShortDate(deliveryDate)}\n`, btAddress);
        }
        await btWrite('\nThank You! Visit Again.\n', btAddress);
        await btWrite('\n\n\n\n', btAddress);
        await btWrite(CUT, btAddress);
        if (getBluetoothBackend() === 'cordova') await btSerialDisconnect();
        return { success: true, message: 'Stitching bill printed via Mini Bluetooth' };
    } catch (e) {
        return { success: false, message: `Stitching bill error: ${e.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT STITCHING BILL — public export
// Always uses mini_bt printer (2-inch BT)
// ─────────────────────────────────────────────────────────────────────────────

export async function printStitchingBill(orderOrId, options = {}) {
    let order = orderOrId;
    if (typeof orderOrId === 'number' || typeof orderOrId === 'string') {
        const res = await api.get(`orders/${orderOrId}`);
        order = res.data?.data;
        if (!order) return { success: false, message: 'Order not found' };
    }
    const enrichedOrder = { ...order, ...options };

    const settings = getPrinterSettings();
    const connectionType = options.connectionType || settings.connectionType;
    const user = JSON.parse(localStorage.getItem('km_user') || '{}');
    const template = order.billTemplate || user.basicBillTemplate || 'standard';

    if (connectionType === 'mini_bt' || template === '2inch') {
        return await miniBluetoothPrintStitchingBill(enrichedOrder);
    }

    // Default to Bluetooth 3-inch or fallback layout logic
    return await bluetoothPrintStitchingBill(enrichedOrder);
}
