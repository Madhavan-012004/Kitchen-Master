const fs = require('fs');
const files = [
    'src/pages/POS.jsx',
    'src/pages/PoultryPOS.jsx',
    'src/pages/SupermarketPOS.jsx',
    'src/pages/Inventory.jsx'
];
let changed = 0;
for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let c = fs.readFileSync(f, 'utf8');

    c = c.replace(/const connected = window\.UsbScaleBridge\.connect\(9600\);/g, 'const connected = window.UsbScaleBridge.connect(baudRate);');

    const injectTarget1 = `            try {
                const connected = window.UsbScaleBridge.connect(baudRate);`;

    const injected = `            const capSer = window.serial || (window.cordova && window.cordova.plugins && window.cordova.plugins.serial);
            if (capSer) {
                try {
                    await new Promise((resolve) => {
                        capSer.requestPermission({ baudRate }, resolve, resolve);
                    });
                } catch(e) {}
            }
            try {
                const connected = window.UsbScaleBridge.connect(baudRate);`;

    if (c.includes(injectTarget1)) {
        c = c.replace(injectTarget1, injected);
    } else {
        c = c.replace(/try\s*\{\s*const connected = window\.UsbScaleBridge\.connect\(baudRate\);/, injected.trim());
    }

    // Fix exact match in PoultryPOS.jsx
    c = c.replace('{scaleConnected && (\n                                    <select\n                                        value={baudRate}', '{!scaleConnected && (\n                                    <select\n                                        value={baudRate}');

    fs.writeFileSync(f, c);
    changed++;
}
console.log('Patched ' + changed + ' files.');
