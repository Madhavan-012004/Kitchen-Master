import React, { useEffect, useRef, useState, useCallback } from 'react';
import api from '../api/client';
import JsBarcode from 'jsbarcode';
import { generateTSPL } from '../utils/tsplHelper';
import { useAuth } from '../context/AuthContext';

const BarcodeStickerModal = ({ show, onClose, items }) => {
    const [printItems, setPrintItems] = useState([]);

    useEffect(() => {
        if (show && items && items.length > 0) {
            setPrintItems(items.map(item => ({
                ...item,
                printQty: item.currentStock > 0 ? Math.ceil(item.currentStock) : 1
            })));
        }
    }, [show, items]);

    const { user } = useAuth();
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerName, setPrinterName] = useState("TSC");
    const [labelHeight, setLabelHeight] = useState(22.5);
    const [gapHeight, setGapHeight] = useState(3.0);

    if (!show) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleThermalPrint = async () => {
        setIsPrinting(true);
        try {
            const shopName = user?.restaurantName || "Kitchen Master";
            const tsplData = generateTSPL(printItems, shopName, labelHeight, gapHeight);
            
            // Send to backend bridge
            const res = await api.post('/print/raw', {
                data: tsplData,
                printerName: printerName || "TSC"
            });
            
            if (res.data.success) {
                alert("Thermal print job sent to printer!");
            } else {
                alert(`Print Failed: ${res.data.message}`);
            }
        } catch (err) {
            console.error('Thermal print failed:', err);
            alert('Failed to print to local printer. Please ensure the printer is shared and the Kitchen Master Local Print Service is running.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleBluetoothPrint = async () => {
        setIsPrinting(true);
        try {
            const shopName = user?.restaurantName || "Kitchen Master";
            let tsplData = generateTSPL(printItems, shopName, { height: labelHeight, gap: gapHeight });
            
            if (!navigator.bluetooth) {
                throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome/Edge on Android, Mac, or Windows.");
            }

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
            });

            const server = await device.gatt.connect();
            const services = await server.getPrimaryServices();
            let writeCharacteristic = null;
            
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        writeCharacteristic = char;
                        break;
                    }
                }
                if (writeCharacteristic) break;
            }

            if (!writeCharacteristic) {
                throw new Error("Could not find a writable characteristic on this device.");
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(tsplData);
            const CHUNK_SIZE = 512;
            
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                if (writeCharacteristic.properties.writeWithoutResponse) {
                    await writeCharacteristic.writeValueWithoutResponse(chunk);
                } else {
                    await writeCharacteristic.writeValue(chunk);
                }
            }
            
            alert("Sent to Bluetooth printer successfully!");
        } catch (err) {
            console.error('Bluetooth print failed:', err);
            alert('Bluetooth print failed: ' + err.message + '\n\nTry using the "Serial/USB" print button if your Bluetooth printer is paired to Windows.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleSerialPrint = async () => {
        setIsPrinting(true);
        try {
            const shopName = user?.restaurantName || "Kitchen Master";
            let tsplData = generateTSPL(printItems, shopName, { height: labelHeight, gap: gapHeight });
            
            if (!("serial" in navigator)) {
                throw new Error("Web Serial API not supported in this browser.");
            }

            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            
            const encoder = new TextEncoder();
            const writer = port.writable.getWriter();
            await writer.write(encoder.encode(tsplData));
            writer.releaseLock();
            await port.close();
            
            alert("Sent to Serial/USB printer successfully!");
        } catch (err) {
            console.error('Serial print failed:', err);
            alert('Serial print failed: ' + err.message);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadPRN = () => {
        const shopName = user?.restaurantName || "Kitchen Master";
        const tsplData = generateTSPL(printItems, shopName, labelHeight, gapHeight);
        const blob = new Blob([tsplData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `labels_${Date.now()}.prn`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const updateQty = (idx, val) => {
        const next = [...printItems];
        next[idx].printQty = parseInt(val) || 0;
        setPrintItems(next);
    };

    return (
        <div className="inventory-modal-overlay no-print-overlay">
            <div className="inventory-modal sticker-modal-dialog animate-fade no-print-modal">
                <div className="modal-header">
                    <h2>🖨️ Barcode Sticker Labels</h2>
                    <button className="close-x" onClick={onClose}>&times;</button>
                </div>
                
                <div className="modal-form">
                    <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Set the number of copies for each item. These labels are optimized for standard 50mm x 25mm or 38mm x 25mm sticker rolls.
                    </p>
                    
                    <div className="sticker-preview-list">
                        {/* Printer Settings */}
                        <div className="printer-config-row" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🖨️ Printer Name:</label>
                                <input 
                                    type="text" 
                                    value={printerName} 
                                    onChange={(e) => setPrinterName(e.target.value)}
                                    placeholder="e.g. TSC TE244"
                                    style={{ width: '100%', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                            <div style={{ width: '100px' }}>
                                <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Height (mm):</label>
                                <input 
                                    type="number" 
                                    value={labelHeight} 
                                    onChange={(e) => setLabelHeight(parseFloat(e.target.value) || 0)}
                                    step="0.1"
                                    style={{ width: '100%', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                            <div style={{ width: '100px' }}>
                                <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Gap (mm):</label>
                                <input 
                                    type="number" 
                                    value={gapHeight} 
                                    onChange={(e) => setGapHeight(parseFloat(e.target.value) || 0)}
                                    step="0.1"
                                    style={{ width: '100%', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                        </div>
                        
                        {printItems.map((item, idx) => (
                            <div key={idx} className="sticker-entry-row">
                                <div className="entry-info">
                                    <div className="entry-name">{item.name}</div>
                                    <div className="entry-barcode">{item.barcode || 'NO BARCODE'}</div>
                                </div>
                                <div className="entry-controls">
                                    <label>Copies:</label>
                                    <input 
                                        type="number" 
                                        value={item.printQty} 
                                        onChange={(e) => updateQty(idx, e.target.value)}
                                        min="0"
                                    />
                                </div>
                                <div className="entry-visual-preview">
                                    <BarcodePreview value={item.barcode} name={item.name} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="save-btn" onClick={handleDownloadPRN} style={{ background: '#10b981', flex: 1, minWidth: '40px', padding: '10px 5px' }} title="Download .PRN">
                        📥
                    </button>
                    <button className="save-btn" onClick={handlePrint} disabled={printItems.length === 0} style={{ background: '#6366f1', flex: 1, minWidth: '40px', padding: '10px 5px' }} title="Print via Web Browser PDF">
                        🌐
                    </button>
                    <button className="save-btn" onClick={handleBluetoothPrint} disabled={printItems.length === 0 || isPrinting} style={{ background: '#8b5cf6', flex: 1, minWidth: '40px', padding: '10px 5px' }} title="Print via Bluetooth">
                        {isPrinting ? '⏳...' : '🛜 BT'}
                    </button>
                    <button className="save-btn" onClick={handleSerialPrint} disabled={printItems.length === 0 || isPrinting} style={{ background: '#f59e0b', flex: 1, minWidth: '50px', padding: '10px 5px' }} title="Print via Serial/USB">
                        {isPrinting ? '⏳...' : '🔌 USB'}
                    </button>
                    <button className="save-btn" onClick={handleThermalPrint} disabled={printItems.length === 0 || isPrinting} style={{ flex: 2, padding: '10px 5px' }}>
                        {isPrinting ? '⏳...' : '🖨️ Local'}
                    </button>
                </div>
            </div>

            {/* THE ACTUAL PRINT AREA - HIDDEN IN UI, VISIBLE IN PRINT */}
            <div className="print-area-stickers">
                {printItems.map((item, idx) => (
                    <React.Fragment key={idx}>
                        {Array.from({ length: item.printQty }).map((_, i) => (
                            <div key={i} className="physical-sticker">
                                <div className="sticker-name-text">{item.name}</div>
                                <PrintableBarcode value={item.barcode} />
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

const BarcodePreview = ({ value, name }) => {
    const svgRef = useRef(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: 1,
                    height: 30,
                    displayValue: true,
                    fontSize: 10,
                    margin: 0
                });
            } catch (e) {
                console.error("Barcode generation failed", e);
            }
        }
    }, [value]);

    return value ? <svg ref={svgRef}></svg> : <div className="no-bc">No Barcode</div>;
};

const PrintableBarcode = ({ value }) => {
    const svgRef = useRef(null);
    useEffect(() => {
        if (svgRef.current && value) {
            JsBarcode(svgRef.current, value, {
                format: "CODE128",
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 14,
                margin: 0
            });
        }
    }, [value]);

    return <svg ref={svgRef}></svg>;
};

export default BarcodeStickerModal;
