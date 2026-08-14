import sys
import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the start of the Native scale block: "    const connectScale ="
    # We will replace everything from "const isAndroidApp" inside it, up to desktop fallback.
    
    # We know the block starts with "const isAndroidApp = /android/i.test..."
    # And ends before "if (!("serial" in navigator))" or "if (!navigator.serial)"
    
    pattern1 = re.compile(r'const isAndroidApp.*?return;\n\s*\}', re.DOTALL)
    
    if pattern1.search(content):
        content = pattern1.sub('''const isAndroidApp = /android/i.test(navigator.userAgent) && window.location.hostname === 'localhost';

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
                            window.__scaleBuffer = lines.pop(); // keep partial block
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
                    alert('Bridge connection failed! Make sure scale is plugged in and no other apps are using it.');
                }
            } else {
                alert('Native Scale Bridge missing. Rebuild the APK!');
            }
            return;
        }''', content, count=1)

    # Disconnect block Fix
    pattern2 = re.compile(r'const disconnectScale.*?if \(!', re.DOTALL)
    # The actual disconnectScale block ends before the connectScale or desktop section.
    # Wait, lets just replace capacitorSerial.close() logic with UsbScaleBridge logic.
    content = re.sub(r'const capacitorSerial =.*?;\n\s*if \(capacitorSerial.*?\}.*?\}', r'''if (window.UsbScaleBridge) {
            window.UsbScaleBridge.disconnect();
            try { setIsScaleConnected(false); } catch(e) {}
            try { setScalePort(null); } catch(e) {}
        }''', content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("DONE " + filepath)

for f in ['c:/FILES/Probloom/web/src/pages/SupermarketPOS.jsx',
          'c:/FILES/Probloom/web/src/pages/POS.jsx',
          'c:/FILES/Probloom/web/src/pages/PoultryPOS.jsx',
          'c:/FILES/Probloom/web/src/pages/Inventory.jsx']:
    try:
        patch_file(f)
    except Exception as e:
        print("ERROR in", f, e)
