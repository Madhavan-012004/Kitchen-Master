import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client.js';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import './Inventory.css';
import BarcodeStickerModal from '../components/BarcodeStickerModal';

const UNITS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'DOZEN', 'PACK', 'BOTTLE'];

export default function Inventory() {
    const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'activity'
    const [items, setItems] = useState([]);
    const [movements, setMovements] = useState([]);
    const [barcodeBuffer, setBarcodeBuffer] = useState('');
    const [lastCharTime, setLastCharTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    
    // Modal states
    const [showItemModal, setShowItemModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Sticker Modal states
    const [showStickerModal, setShowStickerModal] = useState(false);
    const [stickerItems, setStickerItems] = useState([]);

    // Operation modes
    const [scannerMode, setScannerMode] = useState(false);
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [bulkChanges, setBulkChanges] = useState({}); // { itemId: { currentStock, price, name } }
    const [toastMsg, setToastMsg] = useState('');

    const toast = {
        success: (msg) => { setToastMsg('✅ ' + msg); setTimeout(() => setToastMsg(''), 3000); },
        error: (msg) => { setToastMsg('❌ ' + msg); setTimeout(() => setToastMsg(''), 3000); }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if typing in a non-barcode input
            if (e.target.tagName === 'INPUT' && !e.target.classList.contains('barcode-capture')) return;
            if (e.target.tagName === 'TEXTAREA') return;

            const now = Date.now();
            if (now - lastCharTime > 100) {
                setBarcodeBuffer('');
            }
            setLastCharTime(now);

            if (e.key === 'Enter') {
                if (barcodeBuffer.length > 3) {
                    handleBarcodeScanned(barcodeBuffer);
                    setBarcodeBuffer('');
                }
            } else if (e.key.length === 1) {
                setBarcodeBuffer(prev => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [barcodeBuffer, lastCharTime, items, setSelectedItem, setShowAdjustModal]); // Added missing dependencies

    const handleBarcodeScanned = async (code) => {
        const item = items.find(i => i.barcode === code);
        if (!item) {
            toast.error(`Barcode ${code} not found.`);
            return;
        }

        if (scannerMode) {
            try {
                // Rapid intake mode: increment by 1
                await api.post('/inventory/scan-intake', { barcode: code, amount: 1 });
                toast.success(`Received: ${item.name} (+1)`);
                fetchData();
            } catch (err) {
                toast.error('Failed to update stock');
            }
        } else {
            setSelectedItem(item);
            setShowAdjustModal(true);
            toast.success(`Selected: ${item.name}`);
        }
    };

    // Scale state
    const [scaleData, setScaleData] = useState(0);
    const [isScaleConnected, setIsScaleConnected] = useState(false);
    const [port, setPort] = useState(null);
    const [baudRate, setBaudRate] = useState(9600);
    const readerRef = useRef(null);
    const keepReadingRef = useRef(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [itemsRes, movementsRes] = await Promise.all([
                api.get('/inventory'),
                api.get('/inventory/movements')
            ]);
            setItems(itemsRes.data.data.items || []);
            setMovements(movementsRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch inventory data', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // SCALE INTEGRATION (Web Serial API)
    const connectScale = async () => {
        if (!("serial" in navigator)) {
            alert("Web Serial API not supported in your browser. Use Chrome or Edge.");
            return;
        }

        try {
            // Ensure any old port is closed first
            if (port) {
                try { await port.close(); } catch(e) {}
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
                    
                    if (buffer.includes('\n') || buffer.includes('\r')) {
                        const lines = buffer.split(/[\r\n]+/);
                        buffer = lines.pop();

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            console.log('Scale Raw Data:', line);
                            const match = line.match(/[-+]?\d*\.?\d+/);
                            if (match) {
                                const val = parseFloat(match[0]);
                                if (!isNaN(val)) setScaleData(val);
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
                alert(`Scale connection error: ${err.message}`);
            }
        }
    };

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
    };

    // CRUD Handlers
    const handleSaveItem = async (formData) => {
        try {
            const url = isEditing ? `/inventory/${selectedItem._id || selectedItem.id}` : '/inventory';
            const method = isEditing ? 'put' : 'post';
            await api[method](url, formData);
            setShowItemModal(false);
            toast.success('Item saved successfully!');
            fetchData();
        } catch (err) {
            toast.error('Failed to save item');
        }
    };

    const handleBulkUpdate = async () => {
        setLoading(true);
        try {
            const changes = Object.keys(bulkChanges).map(id => ({
                id,
                ...bulkChanges[id]
            }));
            
            if (changes.length === 0) {
                setBulkEditMode(false);
                setLoading(false);
                return;
            }

            await api.post('/inventory/bulk-update', changes);
            toast.success(`Successfully updated ${changes.length} items!`);
            setBulkChanges({});
            setBulkEditMode(false);
            fetchData();
        } catch (err) {
            toast.error('Bulk update failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkChange = (id, field, value) => {
        setBulkChanges(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [field]: value
            }
        }));
    };

    const handleAdjustStock = async (adjustment) => {
        try {
            const itemId = selectedItem._id || selectedItem.id;
            // Map 'remove' to 'DEDUCT' for backend enum
            const payload = {
                ...adjustment,
                type: adjustment.type === 'remove' ? 'DEDUCT' : 'ADD'
            };
            await api.post(`/inventory/${itemId}/adjust`, payload);
            setShowAdjustModal(false);
            alert('Inventory updated & expense recorded!');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to adjust stock');
        }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this item from your database?')) return;
        try {
            await api.delete(`/inventory/${id}`);
            alert('Item removed successfully!');
            fetchData();
        } catch (err) {
            alert('Failed to delete item from database.');
        }
    };

    const handleCsvImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const rows = text.split('\n').map(row => row.split(','));
            if (rows.length < 2) {
                alert('CSV is empty or invalid.');
                return;
            }
            const headers = rows[0].map(h => h?.trim().toLowerCase());
            
            setLoading(true);
            try {
                let imported = 0;
                const importedItems = [];
                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i];
                    if (cols.length < 2) continue; // skip empty
                    
                    const payload = { unit: 'PIECE', category: 'Grocery', lowStockThreshold: 10, currentStock: 0 };
                    headers.forEach((h, idx) => {
                        const val = cols[idx]?.trim();
                        if (h.includes('name')) payload.name = val;
                        if (h.includes('category') && val) payload.category = val;
                        if ((h.includes('price') || h.includes('mrp')) && val) payload.price = parseFloat(val) || 0;
                        if (h.includes('barcode') && val) payload.barcode = val;
                        if ((h.includes('stock') || h.includes('qty')) && val) payload.currentStock = parseFloat(val) || 0;
                    });
                    
                    if (payload.name) {
                        try {
                            const res = await api.post('/inventory', payload);
                            imported++;
                            // Add the saved item (with its ID) to the print list
                            if (res.data?.data) importedItems.push(res.data.data);
                            else importedItems.push({ ...payload, _id: Date.now() + i });
                        } catch (err) {
                            console.error('Row failed:', payload, err);
                        }
                    }
                }
                
                if (imported > 0) {
                    if (window.confirm(`Successfully imported ${imported} items! Would you like to print barcode labels for them?`)) {
                        setStickerItems(importedItems);
                        setShowStickerModal(true);
                    }
                }
                fetchData();
            } catch (err) {
                alert('Error processing CSV');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // reset input
    };

    const handleClearAllItems = async () => {
        if (!window.confirm('⚠️ WARNING: Are you absolutely sure you want to completely WIPE out ALL inventory items? This action cannot be reversed!')) return;
        
        setLoading(true);
        let deletedCount = 0;
        try {
            for (let item of items) {
                const id = item._id || item.id;
                await api.delete(`/inventory/${id}`);
                deletedCount++;
            }
            alert(`✅ Successfully wiped ${deletedCount} items from the database!`);
            fetchData();
        } catch (err) {
            alert(`⚠️ Encountered an error while wiping items. Partially deleted ${deletedCount} items.`);
            fetchData();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="inventory-page">
            <header className="inventory-header">
                <div className="header-title-section">
                    <div className="title-row">
                        <h1>Inventory Management</h1>
                        <div className={`scale-status-indicator ${isScaleConnected ? 'active' : ''}`}>
                            <div className="dot"></div>
                            {isScaleConnected ? `Scale: ${scaleData} ${selectedItem?.unit || 'KG'}` : 'Scale Offline'}
                        </div>
                        <div className="scanner-status-indicator">
                            <span className="scanner-icon">🔍</span>
                            Scanner Ready
                        </div>
                    </div>
                </div>
                
                <StakeholderRestaurantTabs />

                <div className="inventory-controls-row">
                    <div className="section-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
                            onClick={() => setActiveTab('stock')}
                        >
                            📦 Stock Levels
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                            onClick={() => setActiveTab('activity')}
                        >
                            🕒 Activity Log
                        </button>
                    </div>

                    <div className="header-actions">
                        <button 
                            className="danger-btn" 
                            onClick={handleClearAllItems}
                            style={{background:'#fee2e2', color:'#ef4444', border:'1px solid #fca5a5', padding:'8px 16px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px', marginRight:'10px'}}
                            disabled={loading || items.length === 0}
                        >
                            <span style={{fontSize:'16px'}}>🗑️</span> WIPE DATABASE
                        </button>
                        
                        <div className="scale-controls-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {!isScaleConnected && (
                                <select 
                                    className="baud-rate-select" 
                                    value={baudRate} 
                                    onChange={(e) => setBaudRate(parseInt(e.target.value))}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                >
                                    <option value={2400}>2400 Baud</option>
                                    <option value={4800}>4800 Baud</option>
                                    <option value={9600}>9600 Baud</option>
                                    <option value={19200}>19200 Baud</option>
                                    <option value={115200}>115200 Baud</option>
                                </select>
                            )}
                            <button 
                                className={`connect-scale-btn ${isScaleConnected ? 'connected' : ''}`}
                                onClick={isScaleConnected ? disconnectScale : connectScale}
                            >
                                {isScaleConnected ? '⚖️ Disconnect Scale' : '⚖️ Connect Scale'}
                            </button>
                        </div>
                        
                        <input 
                            type="file" 
                            accept=".csv" 
                            id="csv-upload" 
                            style={{display: 'none'}} 
                            onChange={handleCsvImport} 
                        />
                        <button 
                            className="add-item-btn" 
                            style={{ background: '#0284c7', marginRight: '10px' }}
                            onClick={() => document.getElementById('csv-upload').click()}
                        >
                            <span>📂</span> Import CSV
                        </button>

                        <div className="hq-mode-toggles">
                            <button 
                                className={`mode-btn ${scannerMode ? 'active' : ''}`}
                                onClick={() => { setScannerMode(!scannerMode); setBulkEditMode(false); }}
                                title="Active scanning: Increment quantities instantly by point-of-sale scanner"
                            >
                                {scannerMode ? '🔴 STOP SCAN' : '🔍 SCAN MODE'}
                            </button>
                            <button 
                                className={`mode-btn ${bulkEditMode ? 'active' : ''}`}
                                onClick={() => { setBulkEditMode(!bulkEditMode); setScannerMode(false); }}
                                title="Rapid bulk quantity and price editing"
                            >
                                {bulkEditMode ? '🔴 STOP BULK' : '✏️ BULK EDIT'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {toastMsg && <div className="inventory-toast-notify animate-fade-in">{toastMsg}</div>}

            {activeTab === 'stock' ? (
                <div className="tab-content animate-fade">
                    <section className="inventory-stats">
                        <StatsCard 
                            icon="📦" 
                            label="Total Items" 
                            value={items.length} 
                            color="rgba(255, 107, 0, 0.1)" 
                        />
                        <StatsCard 
                            icon="⚠️" 
                            label="Low Stock" 
                            value={items.filter(i => i.currentStock > 0 && i.currentStock <= i.lowStockThreshold).length} 
                            color="rgba(255, 193, 7, 0.1)" 
                            textStyle={{color: '#FFB300'}} 
                        />
                        <StatsCard 
                            icon="🚨" 
                            label="Critical" 
                            value={items.filter(i => i.currentStock === 0).length} 
                            color="rgba(244, 67, 54, 0.1)" 
                            textStyle={{color: '#F44336'}} 
                        />
                        <StatsCard 
                            icon="💰" 
                            label="Inv. Value" 
                            value={`₹${items.reduce((acc, i) => acc + (i.currentStock * (i.costPerUnit || 0)), 0).toLocaleString()}`} 
                            color="rgba(0, 200, 83, 0.1)" 
                            textStyle={{color: '#00C853'}} 
                        />
                    </section>

                    <section className="inventory-filters">
                        <div className="search-wrapper">
                            <span className="search-icon">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Search materials (e.g. Milk, Flour...)" 
                                className="search-input"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                {['All', ...new Set(items.map(i => i.category || 'General'))].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className={`low-stock-toggle ${showLowStockOnly ? 'active' : ''}`} onClick={() => setShowLowStockOnly(!showLowStockOnly)}>
                                <div className="toggle-switch"></div>
                                <span>Low Stock Only</span>
                            </div>
                        </div>
                    </section>

                    {loading ? (
                        <div className="loading-grid">
                            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-card"></div>)}
                        </div>
                    ) : !bulkEditMode ? (
                        <div className="inventory-grid">
                            {items.filter(item => {
                                const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
                                const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                                const matchesLowStock = !showLowStockOnly || (item.currentStock <= item.lowStockThreshold);
                                return matchesSearch && matchesCategory && matchesLowStock;
                            }).map(item => (
                                <InventoryCard 
                                    key={item._id || item.id} 
                                    item={item} 
                                    onEdit={() => { setSelectedItem(item); setIsEditing(true); setShowItemModal(true); }}
                                    onDelete={() => handleDeleteItem(item._id || item.id)}
                                    onAdjust={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                                    onPrint={() => { setStickerItems([item]); setShowStickerModal(true); }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bulk-edit-container animate-fade">
                            <div className="bulk-edit-header-bar">
                                <h3>Bulk Inventory Management</h3>
                                <button className="save-all-btn" onClick={handleBulkUpdate}>
                                    💾 Save Global Changes
                                </button>
                            </div>
                            <div className="bulk-table-wrapper">
                                <table className="bulk-edit-table">
                                    <thead>
                                        <tr>
                                            <th>Item Information</th>
                                            <th>Barcode</th>
                                            <th>Price (₹)</th>
                                            <th>Current Stock ({items[0]?.unit || 'QTY'})</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.filter(item => {
                                            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
                                            const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                                            return matchesSearch && matchesCategory;
                                        }).map(item => {
                                            const id = item._id || item.id;
                                            const changes = bulkChanges[id] || {};
                                            const val = changes.currentStock !== undefined ? changes.currentStock : item.currentStock;
                                            const price = changes.price !== undefined ? changes.price : item.price;
                                            const name = changes.name !== undefined ? changes.name : item.name;
                                            
                                            return (
                                                <tr key={id}>
                                                    <td>
                                                        <input 
                                                            className="bulk-inline-input name"
                                                            value={name}
                                                            onChange={(e) => handleBulkChange(id, 'name', e.target.value)}
                                                        />
                                                        <small>{item.category}</small>
                                                    </td>
                                                    <td className="barcode-cell">{item.barcode || '---'}</td>
                                                    <td>
                                                        <input 
                                                            type="number"
                                                            className="bulk-inline-input"
                                                            value={price}
                                                            onChange={(e) => handleBulkChange(id, 'price', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number"
                                                            className={`bulk-inline-input qty ${val < item.lowStockThreshold ? 'low' : ''}`}
                                                            value={val}
                                                            onChange={(e) => handleBulkChange(id, 'currentStock', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className={`status-pill ${val <= 0 ? 'out' : val < item.lowStockThreshold ? 'low' : 'ok'}`}>
                                                            {val <= 0 ? 'Stock-out' : val < item.lowStockThreshold ? 'Replenish' : 'Sufficient'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="tab-content animate-fade">
                    <ActivityLog movements={movements} onExport={() => alert('Feature coming soon!')} />
                </div>
            )}

            {showItemModal && (
                <ItemModal 
                    onSubmit={handleSaveItem} 
                    onClose={() => setShowItemModal(false)} 
                    initialData={isEditing ? selectedItem : null}
                    isEditing={isEditing}
                    scaleValue={scaleData}
                />
            )}

            {showAdjustModal && (
                <AdjustModal 
                    item={selectedItem}
                    onSubmit={handleAdjustStock}
                    onClose={() => setShowAdjustModal(false)}
                    scaleValue={scaleData}
                />
            )}

            <BarcodeStickerModal 
                show={showStickerModal} 
                onClose={() => setShowStickerModal(false)} 
                items={stickerItems}
            />
        </div>
    );
}

function InventoryCard({ item, onEdit, onDelete, onAdjust, onPrint }) {
    const isLow = item.currentStock <= item.lowStockThreshold;
    const isCritical = item.currentStock === 0;
    
    // Percentage for progress bar (cap at 100)
    const max = item.lowStockThreshold * 4 || 10;
    const pct = Math.min(100, (item.currentStock / max) * 100);
    
    let statusClass = 'good';
    if (isCritical) statusClass = 'critical';
    else if (isLow) statusClass = 'low';

    return (
        <div className="inventory-card">
            <div className="card-accent" style={{background: isCritical ? '#F44336' : isLow ? '#FFB300' : '#00C853'}}></div>
            <div className="card-content">
                <div className="card-top">
                    <div className="item-main">
                        <h2>{item.name}</h2>
                        <span className="item-cat">{item.category}</span>
                    </div>
                    <div className="stock-value-wrapper">
                        <div className="stock-number" style={{color: statusClass === 'critical' ? '#F44336' : statusClass === 'low' ? '#FFB300' : '#E0E0E0'}}>
                            {item.currentStock}
                        </div>
                        <div className="unit-price-stack">
                            <span className="stock-unit">{item.unit}</span>
                            <span className="item-price-tag">₹{item.price || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="stock-progress-section">
                    <div className="progress-labels">
                        <span>Stock Level</span>
                        <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="stock-bar-container">
                        <div className={`stock-bar-fill ${statusClass}`} style={{ width: `${pct}%` }}></div>
                    </div>
                </div>

                <div className="card-meta">
                    <div className={`status-badge ${statusClass}`}>
                        {isCritical ? 'Out of Stock' : isLow ? 'Low Stock' : 'Optimal'}
                    </div>
                    <button className="quick-adjust-btn" onClick={onAdjust} title="Quick Adjust Stock">
                        ⚡ Adjust
                    </button>
                </div>
            </div>
            <div className="card-footer">
                <div className="supplier-preview">
                    <small>Supplier</small>
                    <span>{item.supplierName || 'None'}</span>
                </div>
                <div className="card-actions" style={{display:'flex', gap:'8px'}}>
                    <button className="print-label-btn" onClick={onPrint} title="Print Labels" style={{background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'11px'}}>🖨️ Labels</button>
                    <button className="edit-icon-btn" onClick={onEdit} title="Edit Item" style={{background:'#e0f2fe', color:'#0284c7', border:'1px solid #bae6fd', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'11px'}}>📝 Edit</button>
                    <button className="delete-icon-btn" onClick={onDelete} title="Remove Item" style={{background:'#fee2e2', color:'#ef4444', border:'1px solid #fca5a5', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'11px'}}>🗑️ Delete</button>
                </div>
            </div>
        </div>
    );
}

function ItemModal({ onSubmit, onClose, initialData, isEditing, scaleValue }) {
    const [formData, setFormData] = useState(initialData || {
        name: '',
        category: 'General',
        barcode: '',
        unit: 'KG',
        currentStock: 0,
        lowStockThreshold: 1,
        costPerUnit: 0,
        price: 0,
        isBilliable: true,
        supplierName: '',
        supplierPhone: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const handleCaptureScale = () => {
        setFormData({ ...formData, currentStock: scaleValue });
    };

    return (
        <div className="inventory-modal-overlay animate-fade">
            <div className="inventory-modal scale-in">
                <div className="modal-header">
                    <h2>{isEditing ? '✏️ Edit Material' : '📥 New Stock Intake'}</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Item Name</label>
                        <input 
                            className="inventory-input" 
                            required 
                            placeholder="e.g. Buffalo Milk, Basmati Rice"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Barcode</label>
                            <input 
                                type="text" 
                                className="inventory-input barcode-capture" 
                                placeholder="Scan or type barcode"
                                value={formData.barcode}
                                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <input 
                                className="inventory-input" 
                                placeholder="Dairy, Grains, etc."
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Unit</label>
                            <select 
                                className="inventory-input"
                                value={formData.unit}
                                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Buying Price / Cost (₹)</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01"
                                placeholder="Purchase Price"
                                value={formData.costPerUnit || 0}
                                onChange={(e) => setFormData({...formData, costPerUnit: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Selling Price (₹)</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01"
                                placeholder="Retail Price"
                                value={formData.price || 0}
                                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 25 }}>
                            <input 
                                type="checkbox" 
                                checked={formData.isBilliable !== false}
                                onChange={(e) => setFormData({...formData, isBilliable: e.target.checked})}
                            />
                            <label style={{ margin: 0 }}>Available for Billing (POS)</label>
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="scale-capture-area">
                            <div className="scale-reading">
                                <span className="label">Live Scale Reading</span>
                                <div className="value">{scaleValue} <span className="unit">{formData.unit}</span></div>
                            </div>
                            <button type="button" className="capture-btn" onClick={handleCaptureScale}>
                                ⚖️ Capture Current Weight
                            </button>
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Stock Weight</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01"
                                value={formData.currentStock || 0}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({...formData, currentStock: isNaN(val) ? 0 : val});
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Low Stock Alert</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01"
                                value={formData.lowStockThreshold || 0}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({...formData, lowStockThreshold: isNaN(val) ? 0 : val});
                                }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Supplier Details</label>
                        <div className="form-row">
                            <input 
                                placeholder="Supplier Name" 
                                className="inventory-input" 
                                value={formData.supplierName}
                                onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                            />
                            <input 
                                placeholder="Phone" 
                                className="inventory-input" 
                                value={formData.supplierPhone}
                                onChange={(e) => setFormData({...formData, supplierPhone: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="cancel-btn" onClick={onClose}>Discard</button>
                        <button type="submit" className="save-btn">{isEditing ? 'Update Item' : 'Add to Inventory'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AdjustModal({ item, onSubmit, onClose, scaleValue }) {
    const [adjustment, setAdjustment] = useState({
        type: 'add',
        quantity: 0,
        reason: '',
        totalCost: 0,
        recordAsExpense: false,
        paymentMethod: 'Cash'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(adjustment);
    };

    const handleCaptureScale = () => {
        setAdjustment({ ...adjustment, quantity: scaleValue });
    };

    return (
        <div className="inventory-modal-overlay animate-fade">
            <div className="inventory-modal scale-in">
                <div className="modal-header">
                    <h2>⚖️ Stock Weight Adjustment</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                <div className="adjust-item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="current-stock">Current: {item.currentStock} {item.unit}</span>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Action</label>
                        <div className="adjustment-type-toggle">
                            <button 
                                type="button"
                                className={`type-toggle-btn add ${adjustment.type === 'add' ? 'active' : ''}`}
                                onClick={() => setAdjustment({...adjustment, type: 'add'})}
                            >
                                ➕ Receive
                            </button>
                            <button 
                                type="button"
                                className={`type-toggle-btn remove ${adjustment.type === 'remove' ? 'active' : ''}`}
                                onClick={() => setAdjustment({...adjustment, type: 'remove'})}
                            >
                                ➖ Consume
                            </button>
                        </div>
                    </div>

                    <div className="scale-capture-area">
                        <div className="scale-reading">
                            <span className="label">Live Scale Reading</span>
                            <div className="value">{scaleValue} <span className="unit">{item.unit}</span></div>
                        </div>
                        <button type="button" className="capture-btn" onClick={handleCaptureScale}>
                            ⚖️ Capture Scale
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Adjustment Quantity ({item.unit})</label>
                        <input 
                            type="number" 
                            className="inventory-input" 
                            step="0.01" 
                            required
                            value={adjustment.quantity || 0}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setAdjustment({...adjustment, quantity: isNaN(val) ? 0 : val});
                            }}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Reason / Note</label>
                        <textarea 
                            className="inventory-textarea" 
                            placeholder="Why is this stock moving? (e.g. Spillage, Usage in Dish, Restock)"
                            required
                            value={adjustment.reason}
                            onChange={(e) => setAdjustment({...adjustment, reason: e.target.value})}
                        />
                    </div>

                    {adjustment.type === 'add' && (
                        <div className="expense-recording-section" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <input 
                                    type="checkbox" 
                                    id="recordExpense" 
                                    checked={adjustment.recordAsExpense}
                                    onChange={(e) => setAdjustment({...adjustment, recordAsExpense: e.target.checked, totalCost: e.target.checked ? (adjustment.quantity * (item.costPerUnit || 0)) : 0})}
                                />
                                <label htmlFor="recordExpense" style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>💰 Record as Expenditure</label>
                            </div>

                            {adjustment.recordAsExpense && (
                                <div className="expense-details animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="form-group">
                                        <label>Total Amount Paid (₹)</label>
                                        <input 
                                            type="number"
                                            className="inventory-input"
                                            value={adjustment.totalCost}
                                            onChange={(e) => setAdjustment({...adjustment, totalCost: parseFloat(e.target.value) || 0})}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Payment Method</label>
                                        <select 
                                            className="inventory-input"
                                            value={adjustment.paymentMethod}
                                            onChange={(e) => setAdjustment({...adjustment, paymentMethod: e.target.value})}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="UPI">UPI / Scanner</option>
                                            <option value="Card">Credit/Debit Card</option>
                                            <option value="Bank">Bank Transfer</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="modal-footer">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn">Apply Adjustment</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function StatsCard({ icon, label, value, color, textStyle }) {
    return (
        <div className="stat-card">
            <div className="stat-icon-bg" style={{background: color}}>{icon}</div>
            <div className="stat-info">
                <label>{label}</label>
                <div className="stat-value" style={textStyle}>{value}</div>
            </div>
        </div>
    );
}

function ActivityLog({ movements, onExport }) {
    return (
        <div className="activity-section">
            <div className="activity-controls">
                <h2>Audit Log & Item History</h2>
                <button className="export-btn" onClick={onExport}>📥 Export CSV</button>
            </div>
            
            <div className="activity-table-wrapper">
                <table className="activity-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Material</th>
                            <th>Action</th>
                            <th>Change</th>
                            <th>Performed By</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movements.map((m, idx) => (
                            <tr key={m.id || idx}>
                                <td className="time-cell">
                                    <div className="date">{new Date(m.timestamp).toLocaleDateString()}</div>
                                    <div className="time">{new Date(m.timestamp).toLocaleTimeString()}</div>
                                </td>
                                <td>
                                    <div className="item-name-cell">
                                        <strong>{m.itemName}</strong>
                                        <small>{m.inventoryItem?.category}</small>
                                    </div>
                                </td>
                                <td>
                                    <span className={`type-badge ${m.type?.toLowerCase()}`}>
                                        {m.type === 'ADD' ? '➕ INTAKE' : m.type === 'DEDUCT' ? '➖ CONSUMPTION' : '⚙️ ADJUST'}
                                    </span>
                                </td>
                                <td className="qty-cell">
                                    <span className={`qty-value ${m.type === 'DEDUCT' ? 'neg' : 'pos'}`}>
                                        {m.type === 'DEDUCT' ? '-' : '+'}{m.quantity}
                                    </span>
                                    <small>{m.inventoryItem?.unit}</small>
                                </td>
                                <td>
                                    <div className="staff-pill">
                                        <div className="staff-avatar">{m.performedByName?.[0]?.toUpperCase()}</div>
                                        <span>{m.performedByName}</span>
                                    </div>
                                </td>
                                <td className="reason-cell">
                                    <div className="reason-text" title={m.reason}>
                                        {m.reason || <span className="no-reason">Not specified</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {movements.length === 0 && (
                            <tr>
                                <td colSpan="6" className="empty-row">No stock movements found in history</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
