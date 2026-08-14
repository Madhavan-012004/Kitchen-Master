let fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // the method starts at: const connectScale = async () => {
    let startFn = content.indexOf('const connectScale = async () => {');
    let endFn = content.indexOf('// Desktop browser fallback', startFn);
    if (endFn == -1) endFn = content.indexOf('if (!("serial" in navigator))', startFn);
    if (endFn == -1) endFn = content.indexOf('if (!navigator.serial)', startFn);

    if (startFn > -1 && endFn > -1) {
        let newBlock = `const connectScale = async () => {
        const isAndroidApp = /android/i.test(navigator.userAgent) && window.location.hostname === 'localhost';

        if (isAndroidApp || (window.Capacitor && window.Capacitor.isNative)) {
            if (window.UsbScaleBridge) {
                const connected = window.UsbScaleBridge.connect(9600);
                if (connected) {
                    try { setIsScaleConnected(true); } catch(e) {}
                    try { setScalePort(true); } catch(e) {}
                    
                    keepReadingRef.current = true;
                    if (!window.__scaleBuffer) window.__scaleBuffer = '';
                    
                    window.onScaleData = (data) => {
                        if (!keepReadingRef.current) return;
                        window.__scaleBuffer += String(data);
                        if (window.__scaleBuffer.includes('\\n') || window.__scaleBuffer.includes('\\r')) {
                            const lines = window.__scaleBuffer.split(/[\\r\\n]+/);
                            window.__scaleBuffer = lines.pop(); 
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                const match = line.match(/[-+]?\\d*\\.?\\d+/);
                                if (match) {
                                    const val = parseFloat(match[0]);
                                    if (!isNaN(val)) {
                                        try { setScaleWeight(Math.abs(val)); } catch(e) {}
                                        try { setScaleData(Math.abs(val)); } catch(e) {}
                                    }
                                }
                            }
                        }
                    };
                } else {
                    alert('Bridge connection failed! Make sure scale is plugged in and NO OTHER APP is using it.');
                }
            } else {
                alert('Native Scale Bridge missing. Rebuild APK.');
            }
            return;
        }

        `;
        content = content.substring(0, startFn) + newBlock + content.substring(endFn);
    }

    // disconnectScale fix
    let dStart = content.indexOf('const disconnectScale = async () => {');
    let dEnd = content.indexOf('// Desktop browser fallback', dStart);
    if (dEnd == -1) dEnd = content.indexOf('if (!("serial" in navigator))', dStart);
    if (dEnd == -1) dEnd = content.indexOf('if (!navigator.serial)', dStart);
    if (dEnd == -1) {
        // sometimes it's at the end of the react component
        // we can just find 'try { if (port) { await port.close(); } }'
        dEnd = content.indexOf('try {', dStart);
        if (content.substring(dStart, dEnd).includes('port.close')) {
            // ...
        }
    }

    // Actually, disconnectScale just takes exactly:
    let matchDesc = content.substring(dStart, dStart + 800);
    let capacitorClose = matchDesc.indexOf('if (capacitorSerial');
    if (capacitorClose > -1) {
        // we can just replace everything in disconnectScale before the desktop fallback
        let desktopFallback = matchDesc.indexOf('try {');
        let newDisconnect = `const disconnectScale = async () => {
        keepReadingRef.current = false;
        if (/android/i.test(navigator.userAgent) && window.location.hostname === 'localhost' || (window.Capacitor && window.Capacitor.isNative)) {
            if (window.UsbScaleBridge) {
                window.UsbScaleBridge.disconnect();
                try { setIsScaleConnected(false); } catch(e) {}
                try { setScalePort(null); } catch(e) {}
            }
            return;
        }
        
        `;
        content = content.substring(0, dStart) + newDisconnect + matchDesc.substring(desktopFallback) + content.substring(dStart + 800);
    }

    fs.writeFileSync(file, content, 'utf8');
}

fix('c:/FILES/Probloom/web/src/pages/SupermarketPOS.jsx');
fix('c:/FILES/Probloom/web/src/pages/POS.jsx');
fix('c:/FILES/Probloom/web/src/pages/PoultryPOS.jsx');
fix('c:/FILES/Probloom/web/src/pages/Inventory.jsx');
