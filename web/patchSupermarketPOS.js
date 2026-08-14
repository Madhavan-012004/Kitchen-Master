const fs = require('fs');
let c = fs.readFileSync('src/pages/SupermarketPOS.jsx');
let isUTF16 = c[0] === 0xff && c[1] === 0xfe;
let txt = c.toString(isUTF16 ? 'utf16le' : 'utf8');

const targetConnect = `
    const connectScale = async () => {
        if (!("serial" in navigator)) {
            alert("Web Serial API not supported in your browser. Use Chrome or Edge.");
            return;
        }

        try {
            // Ensure any old port is closed first
            if (port) {
                try { await port.close(); } catch (e) { }
            }

            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate: baudRate });
            setPort(newPort);
            setIsScaleConnected(true);
            keepReadingRef.current = true;

            const reader = newPort.readable.getReader();
            readerRef.current = reader;
            const decoder = new TextDecoder();

            let buffer = '';
            try {
                while (keepReadingRef.current) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    if (buffer.includes('\\n') || buffer.includes('\\r')) {
                        const lines = buffer.split(/[\\r\\n]+/);
                        buffer = lines.pop();

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            console.log('Scale Raw Data:', line);
                            const match = line.match(/[-+]?\\d*\\.?\\d+/);
                            if (match) {
                                const val = parseFloat(match[0]);
                                if (!isNaN(val)) setScaleData(Math.abs(val));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Scale read error:', err);
            } finally {
                reader.releaseLock();
                readerRef.current = null;
            }
        } catch (err) {
            console.error('Scale connection failed:', err);
            setIsScaleConnected(false);
            if (err.name === 'NetworkError') {
                alert("Could not open the port. Is another app (like a Serial Monitor or another tab) using it? Try unplugging and replugging the scale.");
            } else if (err.name === 'NotFoundError') {
                // User cancelled the picker
            } else {
                alert(\`Scale connection error: \${err.message}\`);
            }
        }
    };`;

const targetDisconnect = `
    const disconnectScale = async () => {
        setIsScaleConnected(false);
        keepReadingRef.current = false;

        if (readerRef.current) {
            await readerRef.current.cancel();
        }

        if (port) {
            try {
                await port.close();
            } catch (err) {
                console.error('Port close error:', err);
            }
            setPort(null);
        }
    };`;

const replacementConnect = `
    const connectScale = async () => {
        if (window.Capacitor && window.Capacitor.isNative && window.serial) {
            window.serial.requestPermission({ dtr: true }, 
                () => {
                    window.serial.open({ baudRate: baudRate, dtr: true, sleepOnPause: false }, 
                        () => {
                            setIsScaleConnected(true);
                            keepReadingRef.current = true;
                            let buffer = '';
                            
                            window.serial.registerReadCallback(
                                (data) => {
                                    if (!keepReadingRef.current) return;
                                    let chunk = '';
                                    if (typeof data === 'string') chunk = data;
                                    else if (data instanceof ArrayBuffer) chunk = new TextDecoder().decode(data);
                                    else if (data && data.buffer) chunk = new TextDecoder().decode(data.buffer);
                                    else try { chunk = new TextDecoder().decode(new Uint8Array(data)); } catch(e) {}
                                    
                                    buffer += chunk;
                                    if (buffer.includes('\\n') || buffer.includes('\\r')) {
                                        const lines = buffer.split(/[\\r\\n]+/);
                                        buffer = lines.pop(); // Keep partial line
                                        for (const line of lines) {
                                            if (!line.trim()) continue;
                                            const match = line.match(/[-+]?\\d*\\.?\\d+/);
                                            if (match) {
                                                const val = parseFloat(match[0]);
                                                if (!isNaN(val)) setScaleData(Math.abs(val));
                                            }
                                        }
                                    }
                                },
                                (err) => {
                                    console.error('Serial read error', err);
                                    disconnectScale();
                                }
                            );
                        },
                        (err) => { alert('Failed to open serial port: ' + err); }
                    );
                },
                (err) => { alert('USB Permission denied/Hardware missing: ' + err); }
            );
            return;
        }

        if (!("serial" in navigator)) {
            alert("Web Serial API not supported in your browser. Use Chrome or Edge.");
            return;
        }

        try {
            // Ensure any old port is closed first
            if (port) {
                try { await port.close(); } catch (e) { }
            }

            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate: baudRate });
            setPort(newPort);
            setIsScaleConnected(true);
            keepReadingRef.current = true;

            const reader = newPort.readable.getReader();
            readerRef.current = reader;
            const decoder = new TextDecoder();

            let buffer = '';
            try {
                while (keepReadingRef.current) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    if (buffer.includes('\\n') || buffer.includes('\\r')) {
                        const lines = buffer.split(/[\\r\\n]+/);
                        buffer = lines.pop();

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            console.log('Scale Raw Data:', line);
                            const match = line.match(/[-+]?\\d*\\.?\\d+/);
                            if (match) {
                                const val = parseFloat(match[0]);
                                if (!isNaN(val)) setScaleData(Math.abs(val));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Scale read error:', err);
            } finally {
                reader.releaseLock();
                readerRef.current = null;
            }
        } catch (err) {
            console.error('Scale connection failed:', err);
            setIsScaleConnected(false);
            if (err.name === 'NetworkError') {
                alert("Could not open the port. Is another app (like a Serial Monitor or another tab) using it? Try unplugging and replugging the scale.");
            } else if (err.name === 'NotFoundError') {
                // User cancelled the picker
            } else {
                alert(\`Scale connection error: \${err.message}\`);
            }
        }
    };`;

const replacementDisconnect = `
    const disconnectScale = async () => {
        setIsScaleConnected(false);
        keepReadingRef.current = false;

        if (window.Capacitor && window.Capacitor.isNative && window.serial) {
            try { window.serial.close(() => {}, () => {}); } catch(e) {}
            return;
        }

        if (readerRef.current) {
            await readerRef.current.cancel();
        }

        if (port) {
            try {
                await port.close();
            } catch (err) {
                console.error('Port close error:', err);
            }
            setPort(null);
        }
    };`;

// Try exact first
// If not exact, we will just use a generic regex to target function bodies.
let changed = false;

if (txt.includes(targetConnect.trim())) {
    txt = txt.replace(targetConnect.trim(), replacementConnect.trim());
    changed = true;
} else {
    // Regex mapping for safety
    txt = txt.replace(/const connectScale = async \(\) => \{[\s\S]*?Scale connection error.*?\n\s+\}\n\s+\};/, replacementConnect.trim());
    changed = true;
}

if (txt.includes(targetDisconnect.trim())) {
    txt = txt.replace(targetDisconnect.trim(), replacementDisconnect.trim());
} else {
    txt = txt.replace(/const disconnectScale = async \(\) => \{[\s\S]*?setPort\(null\);\n\s+\};/, replacementDisconnect.trim());
}

if (changed) {
    fs.writeFileSync('src/pages/SupermarketPOS.jsx', txt, isUTF16 ? 'utf16le' : 'utf8');
    console.log("SUCCESSFULLY PATCHED");
} else {
    console.log("COULD NOT FIND TARGET IN SUPERMARKETPOS");
}
