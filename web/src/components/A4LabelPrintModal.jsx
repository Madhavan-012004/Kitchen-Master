import React, { useState, useEffect } from 'react';
import { assignLabelCodes, generateAndDownloadA4Labels } from '../utils/labelPdfGenerator';
import { useAuth } from '../context/AuthContext';
import api from '../api/client'; // Import api down here

const A4LabelPrintModal = ({ show, onClose, items, onSuccess }) => {
    const { user } = useAuth();
    const [printItems, setPrintItems] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (show && items && items.length > 0) {
            // Only include items with stock > 0 by default; assign unique codes
            const withCodes = assignLabelCodes(items.filter(i => i.currentStock > 0));
            setPrintItems(withCodes.map(item => ({
                ...item,
                // Default copies = actual decimal stock (e.g. 18.25m), max to avoid huge defaults
                printQty: Math.min(item.currentStock, 9999),
                isSelected: true
            })));
        }
    }, [show, items]);

    if (!show) return null;

    const shopName = user?.restaurantName || 'ProBloom';
    const totalLabels = printItems.reduce((s, i) => s + (i.isSelected ? (parseFloat(i.printQty) || 0) : 0), 0);
    const selectedCount = printItems.filter(i => i.isSelected).length;

    const updateQty = (idx, val) => {
        setPrintItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], printQty: Math.max(0, parseFloat(val) || 0) };
            return next;
        });
    };

    const handleDownload = () => {
        setIsGenerating(true);
        setTimeout(async () => {
            try {
                const toprint = printItems.filter(i => i.isSelected && (parseFloat(i.printQty) || 0) > 0);
                if (toprint.length === 0) {
                    alert("No valid items selected for printing (Make sure copies > 0)");
                    setIsGenerating(false);
                    return;
                }
                generateAndDownloadA4Labels(toprint, shopName);

                // Filter out items that had no barcode but just generated one, and they are printed
                const newlyGenerated = printItems
                    .filter(i => i.isSelected && (parseFloat(i.printQty) || 0) > 0 && !i.barcode && i.labelCode)
                    .map(i => ({ id: i._id || i.id, barcode: i.labelCode }));

                if (newlyGenerated.length > 0) {
                    try {
                        await api.post('/inventory/bulk-update', newlyGenerated);
                        if (onSuccess) onSuccess();
                    } catch (apiErr) {
                        console.error('Failed to save auto-generated barcodes to backend:', apiErr);
                    }
                }
            } catch (e) {
                console.error('PDF generation failed:', e);
                alert('Failed to generate PDF: ' + e.message);
            } finally {
                setIsGenerating(false);
            }
        }, 50);
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.dialog}>
                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.headerIcon}>🗂️</span>
                    <h2 style={styles.title}>Print Stock Labels — A4 PDF</h2>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <p style={styles.subtitle}>
                    Generates a <strong>5 × 13 label grid</strong> on A4 pages. Each item gets a unique barcode.
                    Adjust the number of copies per item before downloading.
                </p>

                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.theadRow}>
                                <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={printItems.length > 0 && printItems.every(i => i.isSelected)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setPrintItems(prev => prev.map(i => ({ ...i, isSelected: checked })));
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1d4ed8' }}
                                    />
                                </th>
                                <th style={styles.th}>Item Name</th>
                                <th style={styles.th}>Label Code</th>
                                <th style={styles.th}>Stock</th>
                                <th style={styles.th}>Price</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Copies</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printItems.map((item, idx) => (
                                <tr key={idx} style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={item.isSelected}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setPrintItems(prev => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], isSelected: checked };
                                                    return next;
                                                });
                                            }}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1d4ed8' }}
                                        />
                                    </td>
                                    <td style={{ ...styles.td, fontWeight: 600, color: '#1e293b' }}>{item.name}</td>
                                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>
                                        {item.labelCode}
                                        {!item.barcode && <span style={styles.generatedBadge}>AUTO</span>}
                                    </td>
                                    <td style={styles.td}>{parseFloat((item.currentStock || 0).toFixed(3))} <span style={{ color: '#94a3b8', fontSize: '11px' }}>{item.unit}</span></td>
                                    <td style={styles.td}>₹{parseFloat(item.price || 0).toFixed(2)}</td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="9999"
                                            step="0.001"
                                            value={item.printQty}
                                            onChange={e => updateQty(idx, e.target.value)}
                                            style={{ ...styles.qtyInput, opacity: item.isSelected ? 1 : 0.4 }}
                                            disabled={!item.isSelected}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <div style={styles.summary}>
                        <span style={styles.summaryBadge}>📋 {selectedCount} of {printItems.length} selected</span>
                        <span style={styles.summaryBadge}>🏷️ {totalLabels} labels</span>
                        <span style={styles.summaryBadge}>📄 ~{Math.ceil(totalLabels / 65)} pages</span>
                    </div>
                    <div style={styles.footerBtns}>
                        <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button
                            style={{ ...styles.downloadBtn, opacity: isGenerating ? 0.7 : 1 }}
                            onClick={handleDownload}
                            disabled={isGenerating || totalLabels === 0}
                        >
                            {isGenerating ? '⏳ Generating…' : '📥 Download PDF'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9000, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)',
    },
    dialog: {
        background: '#fff', borderRadius: '16px', width: '90vw', maxWidth: '820px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '18px 22px', borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    },
    headerIcon: { fontSize: '22px' },
    title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff', flex: 1 },
    closeBtn: {
        background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
        borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '16px',
    },
    subtitle: {
        margin: '12px 22px 8px', fontSize: '13px', color: '#64748b', lineHeight: 1.5,
    },
    tableWrap: {
        flex: 1, overflowY: 'auto', margin: '0 22px', borderRadius: '8px',
        border: '1px solid #e2e8f0', marginBottom: '12px',
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    theadRow: { background: '#f1f5f9', position: 'sticky', top: 0 },
    th: {
        padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b',
        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em',
        borderBottom: '1px solid #e2e8f0',
    },
    td: { padding: '9px 12px', fontSize: '13px', color: '#334155', verticalAlign: 'middle' },
    rowEven: { background: '#fff' },
    rowOdd: { background: '#f8fafc' },
    generatedBadge: {
        marginLeft: '6px', background: '#dbeafe', color: '#1d4ed8',
        fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 700,
    },
    qtyInput: {
        width: '70px', textAlign: 'center', padding: '5px 8px',
        border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px',
        outline: 'none',
    },
    footer: {
        padding: '14px 22px', borderTop: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#f8fafc', gap: '12px', flexWrap: 'wrap',
    },
    summary: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    summaryBadge: {
        background: '#e0f2fe', color: '#0369a1', fontSize: '12px',
        padding: '4px 10px', borderRadius: '20px', fontWeight: 600,
    },
    footerBtns: { display: 'flex', gap: '10px' },
    cancelBtn: {
        padding: '9px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
        background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
    },
    downloadBtn: {
        padding: '9px 22px', borderRadius: '8px', border: 'none',
        background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
        color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
        boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
    },
};

export default A4LabelPrintModal;
