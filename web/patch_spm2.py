import codecs
import re

with codecs.open('src/pages/SupermarketPOS.jsx', 'r', 'utf-8', 'ignore') as f:
    txt = f.read()

replacementConnect = """    const connectScale = async () => {
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
            if (port) { try { await port.close(); } catch (e) { } }

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
                    try {
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
                    } catch (readErr) {
                        console.warn('Transient scale read error, retrying...', readErr);
                        // Brief pause before retry if loop is still active
                        if (keepReadingRef.current) await new Promise(r => setTimeout(r, 100));
                        else break;
                    }
                }
            } catch (err) {
                console.error('Scale loop critical error:', err);
            } finally {
                try { reader.releaseLock(); } catch (e) { }
                readerRef.current = null;
            }
        } catch (err) {
            console.error('Scale connection failed:', err);
            setIsScaleConnected(false);
            if (err.name === 'NetworkError') {
                alert("Could not open port. Is another app using it? Try replugging the scale.");
            }
        }
    };"""

replacementDisconnect = """    const disconnectScale = async () => {
        setIsScaleConnected(false);
        keepReadingRef.current = false;
        
        if (window.Capacitor && window.Capacitor.isNative && window.serial) {
            try { window.serial.close(() => {}, () => {}); } catch(e) {}
            return;
        }

        if (readerRef.current) { try { await readerRef.current.cancel(); } catch (e) { } }
        if (port) {
            try { await port.close(); } catch (err) { console.error('Port close error:', err); }
            setPort(null);
        }
    };"""

txt = re.sub(r'    const connectScale = async \(\) => \{[\s\S]*?Scale connection failed.*?;\s*\}[\n\r\s]*\};', replacementConnect, txt)
txt = re.sub(r'    const disconnectScale = async \(\) => \{[\s\S]*?setPort\(null\);\s*\};', replacementDisconnect, txt)

with codecs.open('src/pages/SupermarketPOS.jsx', 'w', 'utf-8') as f:
    f.write(txt)
