import React, { useState, useRef } from 'react';
import api from '../api/client.js';

export default function InvoiceOcrModal({ onClose, onComplete, toast }) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setParsedData(null); // Reset if re-uploading
        }
    };

    const handleScan = async () => {
        if (!file) return;
        setScanning(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/inventory/ocr-scan', formData);
            if (res.data.success && Array.isArray(res.data.data)) {
                // Ensure default structure
                const formatted = res.data.data.map((item, index) => ({
                    _idx: index,
                    name: item.name || '',
                    category: 'Pharmacy',
                    batchNo: item.batchNo || '',
                    expDate: item.expDate || '',
                    hsnCode: item.hsnCode || '',
                    qty: item.qty || 1,
                    price: item.mrp || 0,
                    costPerUnit: item.ptr || 0,
                    unit: item.pack || 'PIECE'
                }));
                setParsedData(formatted);
                toast.success('Invoice scanned successfully!');
            } else {
                toast.error('Could not extract items from the image.');
            }
        } catch (err) {
            console.error('Scan Error:', err);
            toast.error(err.response?.data?.message || 'Error scanning invoice.');
        } finally {
            setScanning(false);
        }
    };

    const handleDataChange = (index, field, value) => {
        setParsedData(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleDeleteRow = (index) => {
        setParsedData(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveToInventory = async () => {
        if (!parsedData || parsedData.length === 0) return;
        setSaving(true);
        try {
            // Save each item as a new inventory item since they are from a wholesale invoice
            let successCount = 0;
            for (let item of parsedData) {
                if (!item.name.trim()) continue;
                await api.post('/inventory', {
                    name: item.name,
                    category: item.category,
                    batchNo: item.batchNo,
                    expDate: item.expDate,
                    hsnCode: item.hsnCode,
                    currentStock: parseFloat(item.qty),
                    price: parseFloat(item.price),
                    costPerUnit: parseFloat(item.costPerUnit),
                    unit: item.unit.toUpperCase() || 'PIECE',
                    isBilliable: true
                });
                successCount++;
            }
            toast.success(`Successfully added ${successCount} items to inventory!`);
            onComplete(); // Refresh inventory and close
        } catch (err) {
            console.error('Save Error:', err);
            toast.error('Failed to save some items to inventory.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }}>
                <div className="modal-header">
                    <h2>🤖 AI Invoice Scanner</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {!parsedData && (
                        <div className="upload-section" style={{ textAlign: 'center', padding: '40px', border: '2px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
                            {!previewUrl ? (
                                <>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                                    <h3>Upload Wholesale Invoice</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Upload an image (OCR) or CSV file of your Tax Invoice.</p>
                                    <input 
                                        type="file" 
                                        accept="image/*,.csv" 
                                        onChange={handleFileChange} 
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                    />
                                    <button className="btn primary" onClick={() => fileInputRef.current.click()}>
                                        Choose Image
                                    </button>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    <img src={previewUrl} alt="Invoice Preview" style={{ maxHeight: '300px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn outline" onClick={() => { setFile(null); setPreviewUrl(null); }} disabled={scanning}>
                                            Retake
                                        </button>
                                        <button className="btn primary" onClick={handleScan} disabled={scanning}>
                                            {scanning ? 'Processing...' : 'Extract Data'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {scanning && (
                        <div className="scanning-overlay" style={{ textAlign: 'center', padding: '30px' }}>
                            <div className="spinner" style={{ margin: '0 auto 20px', width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <h3>Processing Invoice Data...</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>Analyzing items, batches, and prices. This usually takes 3-5 seconds.</p>
                        </div>
                    )}

                    {parsedData && (
                        <div className="extracted-data-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>Verify Extracted Items ({parsedData.length})</h3>
                                <button className="btn outline" onClick={() => { setFile(null); setPreviewUrl(null); setParsedData(null); }}>
                                    Scan Another
                                </button>
                            </div>
                            
                            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                <table className="data-table">
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Batch No</th>
                                            <th>Exp Date</th>
                                            <th>HSN Code</th>
                                            <th>Qty</th>
                                            <th>Rate (PTR)</th>
                                            <th>MRP</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.map((item, index) => (
                                            <tr key={item._idx}>
                                                <td><input value={item.name} onChange={e => handleDataChange(index, 'name', e.target.value)} className="form-input" style={{ width: '150px' }} /></td>
                                                <td><input value={item.batchNo} onChange={e => handleDataChange(index, 'batchNo', e.target.value)} className="form-input" style={{ width: '100px' }} /></td>
                                                <td><input value={item.expDate} onChange={e => handleDataChange(index, 'expDate', e.target.value)} className="form-input" style={{ width: '80px' }} placeholder="MM-YY" /></td>
                                                <td><input value={item.hsnCode} onChange={e => handleDataChange(index, 'hsnCode', e.target.value)} className="form-input" style={{ width: '100px' }} /></td>
                                                <td><input type="number" value={item.qty} onChange={e => handleDataChange(index, 'qty', e.target.value)} className="form-input" style={{ width: '70px' }} /></td>
                                                <td><input type="number" value={item.costPerUnit} onChange={e => handleDataChange(index, 'costPerUnit', e.target.value)} className="form-input" style={{ width: '80px' }} /></td>
                                                <td><input type="number" value={item.price} onChange={e => handleDataChange(index, 'price', e.target.value)} className="form-input" style={{ width: '80px' }} /></td>
                                                <td><button onClick={() => handleDeleteRow(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}>🗑️</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className="btn outline" onClick={onClose} disabled={saving}>Cancel</button>
                                <button className="btn primary" onClick={handleSaveToInventory} disabled={saving}>
                                    {saving ? 'Saving...' : 'Confirm & Save to Inventory'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
