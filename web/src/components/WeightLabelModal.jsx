import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function WeightLabelModal({ show, onClose, item, scaleValue, inventoryItems = [] }) {
    const { user } = useAuth();
    const [weight, setWeight] = useState(0);
    const [isPrinting, setIsPrinting] = useState(false);
    const [weightFromScale, setWeightFromScale] = useState(false);
    
    // Ad-hoc states when item is null
    const [adHocName, setAdHocName] = useState('');
    const [adHocPrice, setAdHocPrice] = useState(0);
    const [adHocUnit, setAdHocUnit] = useState('KG');
    const [adHocBarcode, setAdHocBarcode] = useState('');
    
    // Automatically set weight when scaleValue updates if user hasn't overridden
    useEffect(() => {
        if (show && scaleValue > 0) {
            setWeight(scaleValue);
        }
    }, [scaleValue, show]);

    if (!show) return null;

    const ratePerWeight = item ? (item.price || 0) : adHocPrice;
    const itemName = item ? item.name : (adHocName || 'Custom Product');
    const itemUnit = item ? (item.unit || 'KG') : adHocUnit;
    const itemBarcode = item ? (item.barcode || '00000000') : (adHocBarcode || '00000000');
    const finalBarcode = weightFromScale ? `${itemBarcode}#w` : itemBarcode;
    
    const totalRate = (weight * ratePerWeight).toFixed(2);
    
    const handleCaptureScale = () => {
        setWeight(scaleValue);
        setWeightFromScale(true);
    };

    const handleThermalPrint = async () => {
        setIsPrinting(true);
        try {
            const shopName = user?.restaurantName || "ProBloom";
            const barcodeValue = finalBarcode;
            const name = (itemName || "Product").substring(0, 25).toUpperCase();
            
            const header = [
                `SIZE 50 mm, 25 mm`,
                `GAP 3 mm, 0 mm`,
                "DIRECTION 0,0",
                "REFERENCE 0,0",
                "OFFSET 0 mm",
                "SET PEEL OFF",
                "SET CUTTER OFF",
                "SET TEAR ON",
                "CODEPAGE 1252",
                "CLS"
            ];
            
            const commands = [
                `TEXT 10,10,"ROMAN.TTF",0,1,10,"${shopName}"`,
                `TEXT 10,40,"ROMAN.TTF",0,1,8,"${name}"`,
                `TEXT 10,70,"ROMAN.TTF",0,1,8,"Weight: ${weight} ${itemUnit}"`,
                `TEXT 10,100,"ROMAN.TTF",0,1,8,"Rate: Rs.${ratePerWeight}/${itemUnit}"`,
                `TEXT 10,130,"ROMAN.TTF",0,1,10,"Total: Rs.${totalRate}"`,
                `QRCODE 250,40,L,3,A,0,M2,S7,"${barcodeValue}"`,
                "PRINT 1,1"
            ];

            const tsplData = header.join("\r\n") + "\r\n" + commands.join("\r\n") + "\r\n";
            
            const res = await api.post('/print/raw', {
                data: tsplData,
                printerName: "TSC"
            });
            
            if (res.data.success) {
                alert("Weight Label sent to printer successfully!");
                onClose();
            } else {
                throw new Error(res.data.message);
            }
        } catch (err) {
            console.error('Server-side print failed:', err);
            alert('Failed to print via server. Ensure the printer is Shared as "TSC" in Windows.');
        } finally {
            setIsPrinting(false);
        }
    };
    
    const handleBluetoothPrint = async () => {
        setIsPrinting(true);
        try {
            const shopName = user?.restaurantName || "ProBloom";
            const barcodeValue = finalBarcode;
            const name = (itemName || "Product").substring(0, 25).toUpperCase();
            
            const header = [
                `SIZE 50 mm, 25 mm`,
                `GAP 3 mm, 0 mm`,
                "DIRECTION 0,0",
                "REFERENCE 0,0",
                "OFFSET 0 mm",
                "SET PEEL OFF",
                "SET CUTTER OFF",
                "SET TEAR ON",
                "CODEPAGE 1252",
                "CLS"
            ];
            
            const commands = [
                `TEXT 10,10,"ROMAN.TTF",0,1,10,"${shopName}"`,
                `TEXT 10,40,"ROMAN.TTF",0,1,8,"${name}"`,
                `TEXT 10,70,"ROMAN.TTF",0,1,8,"Weight: ${weight} ${itemUnit}"`,
                `TEXT 10,100,"ROMAN.TTF",0,1,8,"Rate: Rs.${ratePerWeight}/${itemUnit}"`,
                `TEXT 10,130,"ROMAN.TTF",0,1,10,"Total: Rs.${totalRate}"`,
                `QRCODE 250,40,L,3,A,0,M2,S7,"${barcodeValue}"`,
                "PRINT 1,1"
            ];

            const tsplData = header.join("\r\n") + "\r\n" + commands.join("\r\n") + "\r\n";
            
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
            
            alert("Weight Label sent to Bluetooth printer successfully!");
            onClose();
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
            const shopName = user?.restaurantName || "ProBloom";
            const barcodeValue = finalBarcode;
            const name = (itemName || "Product").substring(0, 25).toUpperCase();
            
            const header = [
                `SIZE 50 mm, 25 mm`,
                `GAP 3 mm, 0 mm`,
                "DIRECTION 0,0",
                "REFERENCE 0,0",
                "OFFSET 0 mm",
                "SET PEEL OFF",
                "SET CUTTER OFF",
                "SET TEAR ON",
                "CODEPAGE 1252",
                "CLS"
            ];
            
            const commands = [
                `TEXT 10,10,"ROMAN.TTF",0,1,10,"${shopName}"`,
                `TEXT 10,40,"ROMAN.TTF",0,1,8,"${name}"`,
                `TEXT 10,70,"ROMAN.TTF",0,1,8,"Weight: ${weight} ${itemUnit}"`,
                `TEXT 10,100,"ROMAN.TTF",0,1,8,"Rate: Rs.${ratePerWeight}/${itemUnit}"`,
                `TEXT 10,130,"ROMAN.TTF",0,1,10,"Total: Rs.${totalRate}"`,
                `QRCODE 250,40,L,3,A,0,M2,S7,"${barcodeValue}"`,
                "PRINT 1,1"
            ];

            const tsplData = header.join("\r\n") + "\r\n" + commands.join("\r\n") + "\r\n";
            
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
            onClose();
        } catch (err) {
            console.error('Serial print failed:', err);
            alert('Serial print failed: ' + err.message);
        } finally {
            setIsPrinting(false);
        }
    };
    
    const handleDownloadPRN = () => {
        const shopName = user?.restaurantName || "ProBloom";
        const barcodeValue = finalBarcode;
        const name = (itemName || "Product").substring(0, 25).toUpperCase();
        
        const header = [
            `SIZE 50 mm, 25 mm`,
            `GAP 3 mm, 0 mm`,
            "DIRECTION 0,0",
            "REFERENCE 0,0",
            "OFFSET 0 mm",
            "SET PEEL OFF",
            "SET CUTTER OFF",
            "SET TEAR ON",
            "CODEPAGE 1252",
            "CLS"
        ];
        
        const commands = [
            `TEXT 10,10,"ROMAN.TTF",0,1,10,"${shopName}"`,
            `TEXT 10,40,"ROMAN.TTF",0,1,8,"${name}"`,
            `TEXT 10,70,"ROMAN.TTF",0,1,8,"Weight: ${weight} ${itemUnit}"`,
            `TEXT 10,100,"ROMAN.TTF",0,1,8,"Rate: Rs.${ratePerWeight}/${itemUnit}"`,
            `TEXT 10,130,"ROMAN.TTF",0,1,10,"Total: Rs.${totalRate}"`,
            `QRCODE 250,40,L,3,A,0,M2,S7,"${barcodeValue}"`,
            "PRINT 1,1"
        ];

        const tsplData = header.join("\r\n") + "\r\n" + commands.join("\r\n") + "\r\n";
        
        const blob = new Blob([tsplData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `weight_label_${Date.now()}.prn`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="inventory-modal-overlay animate-fade">
            <div className="inventory-modal scale-in" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>⚖️ Weigh & Print Label</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                
                <div className="modal-form">
                    <div className="form-group" style={{ textAlign: 'center', marginBottom: '20px' }}>
                        {item ? (
                            <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>{itemName}</h3>
                        ) : (
                            <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                                <label>Product Name</label>
                                <input 
                                    type="text" 
                                    list="adhoc-items-list"
                                    className="inventory-input" 
                                    value={adHocName}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAdHocName(val);
                                        const found = inventoryItems.find(i => i.name === val);
                                        if (found) {
                                            setAdHocPrice(found.price || 0);
                                            setAdHocUnit(found.unit || 'KG');
                                            setAdHocBarcode(found.barcode || '');
                                        }
                                    }}
                                    placeholder="Select or enter product name"
                                />
                                <datalist id="adhoc-items-list">
                                    {inventoryItems.map((invItem) => (
                                        <option key={invItem._id || invItem.barcode} value={invItem.name} />
                                    ))}
                                </datalist>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label>Rate (₹)</label>
                                        <input 
                                            type="number" 
                                            className="inventory-input" 
                                            value={adHocPrice}
                                            onChange={(e) => setAdHocPrice(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label>Unit</label>
                                        <select 
                                            className="inventory-input"
                                            value={adHocUnit}
                                            onChange={(e) => setAdHocUnit(e.target.value)}
                                        >
                                            <option value="KG">KG</option>
                                            <option value="G">G</option>
                                            <option value="LITRE">LITRE</option>
                                            <option value="PIECE">PIECE</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="scale-capture-area" style={{ marginTop: '0' }}>
                            <div className="scale-reading">
                                <span className="label">Live Scale Reading</span>
                                <div className="value">{scaleValue} <span className="unit">{itemUnit}</span></div>
                            </div>
                            <button type="button" className="capture-btn" onClick={handleCaptureScale}>
                                ⚖️ Capture Scale
                            </button>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Custom Weight ({itemUnit})</label>
                        <input 
                            type="number" 
                            className="inventory-input" 
                            step="0.01"
                            min="0"
                            value={weight === 0 ? '' : weight}
                            onChange={(e) => {
                                setWeight(Math.abs(parseFloat(e.target.value) || 0));
                                setWeightFromScale(false);
                            }}
                        />
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#64748b' }}>Rate per {itemUnit}:</span>
                            <span style={{ fontWeight: 'bold' }}>₹{ratePerWeight}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#64748b' }}>Weight:</span>
                            <span style={{ fontWeight: 'bold' }}>{weight} {itemUnit}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                            <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Total Label Rate:</span>
                            <span style={{ color: '#059669', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{totalRate}</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="save-btn" onClick={handleDownloadPRN} style={{ background: '#10b981', flex: 1, minWidth: '40px', padding: '10px 5px' }} title="Download .PRN File">
                        📥
                    </button>
                    <button className="save-btn" onClick={handleBluetoothPrint} disabled={isPrinting || weight <= 0} style={{ background: '#6366f1', flex: 1, minWidth: '40px', padding: '10px 5px' }} title="Print via Bluetooth">
                        {isPrinting ? '⏳...' : '🛜 BT'}
                    </button>
                    <button className="save-btn" onClick={handleSerialPrint} disabled={isPrinting || weight <= 0} style={{ background: '#f59e0b', flex: 1, minWidth: '50px', padding: '10px 5px' }} title="Print via Serial/USB">
                        {isPrinting ? '⏳...' : '🔌 USB'}
                    </button>
                    <button className="save-btn" onClick={handleThermalPrint} disabled={isPrinting || weight <= 0} style={{ background: '#0284c7', flex: 2, padding: '10px 5px' }}>
                        {isPrinting ? '⏳...' : '🖨️ Local'}
                    </button>
                </div>
            </div>
        </div>
    );
}
