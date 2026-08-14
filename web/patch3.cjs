const fs = require('fs');

function patch(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let startFn = content.indexOf('const connectScale = async () => {');
    if (startFn === -1) return;

    let endFn = content.indexOf('// Desktop browser fallback', startFn);
    if (endFn === -1) endFn = content.indexOf('if (!("serial" in navigator))', startFn);
    if (endFn === -1) endFn = content.indexOf('if (!navigator.serial)', startFn);

    let replacementConnect = `const connectScale = async () => {
        const isAndroidApp = /android/i.test(navigator.userAgent) && window.location.hostname === 'localhost';

        if (isAndroidApp || (window.Capacitor && window.Capacitor.isNative)) {
            if (!window.UsbScaleBridge) {
                alert('Native Scale bridge missing. Rebuild APK.');
                return;
            }
            try {
                const connected = window.UsbScaleBridge.connect(9600);
                if (connected) {
                    try { setIsScaleConnected(true); } catch(e){}
                    keepReadingRef.current = true;
                    if (!window.__scaleBuffer) window.__scaleBuffer = '';
                    
                    window.onScaleData = (data) => {
                        if (!keepReadingRef.current) return;
                        window.__scaleBuffer += String(data);
                        if (window.__scaleBuffer.includes('\\n') || window.__scaleBuffer.includes('\\r')) {
                            const lines = window.__scaleBuffer.split(/[\\r\\n]+/);
                            window.__scaleBuffer = lines.pop(); // keep partial block
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                const match = line.match(/[-+]?\\d*\\.?\\d+/);
                                if (match) {
                                    const val = parseFloat(match[0]);
                                    if (!isNaN(val)) {
                                        try { setScaleWeight(Math.abs(val)); } catch(e){}
                                        try { setScaleData(Math.abs(val)); } catch(e){}
                                    }
                                }
                            }
                        }
                    };
                } else {
                    alert('Scale connection failed! Ensure scale is connected and no other apps are using it.');
                }
            } catch(e) {
                alert('Error: ' + e.message);
            }
            return;
        }

        `;

    content = content.substring(0, startFn) + replacementConnect + content.substring(endFn);

    let dStart = content.indexOf('const disconnectScale = async () => {');
    if (dStart > -1) {
        let dEnd = content.indexOf('// Desktop browser fallback', dStart);
        if (dEnd === -1) dEnd = content.indexOf('if (!("serial" in navigator))', dStart);
        if (dEnd === -1) dEnd = content.indexOf('if (!navigator.serial)', dStart);
        if (dEnd === -1) dEnd = content.indexOf('try {', dStart);

        let replacementDisconnect = `const disconnectScale = async () => {
        keepReadingRef.current = false;
        const isAndroidApp = /android/i.test(navigator.userAgent) && window.location.hostname === 'localhost';
        if (isAndroidApp || (window.Capacitor && window.Capacitor.isNative)) {
            if (window.UsbScaleBridge) {
                window.UsbScaleBridge.disconnect();
                try { setIsScaleConnected(false); } catch(e){}
            }
            return;
        }
        
        `;
        content = content.substring(0, dStart) + replacementDisconnect + content.substring(dEnd);
    }

    fs.writeFileSync(filepath, content, 'utf8');
}

patch('c:/FILES/Probloom/web/src/pages/SupermarketPOS.jsx');
patch('c:/FILES/Probloom/web/src/pages/POS.jsx');
patch('c:/FILES/Probloom/web/src/pages/PoultryPOS.jsx');
patch('c:/FILES/Probloom/web/src/pages/Inventory.jsx');
