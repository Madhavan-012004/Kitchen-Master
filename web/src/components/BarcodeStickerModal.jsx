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
                alert("Labels sent to server-side print queue successfully!");
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

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="save-btn" onClick={handleDownloadPRN} style={{ background: '#10b981' }}>
                        📥 Download .PRN
                    </button>
                    <button className="save-btn" onClick={handlePrint} disabled={printItems.length === 0} style={{ background: '#6366f1' }}>
                        🌐 PDF Print
                    </button>
                    <button className="save-btn" onClick={handleThermalPrint} disabled={printItems.length === 0 || isPrinting}>
                        {isPrinting ? '⏳ Printing...' : '🖨️ Thermal Print (TSPL)'}
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
