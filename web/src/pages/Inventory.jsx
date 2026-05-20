import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client.js';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import './Inventory.css';
import BarcodeStickerModal from '../components/BarcodeStickerModal';
import WeightLabelModal from '../components/WeightLabelModal';
import InvoiceOcrModal from '../components/InvoiceOcrModal';
import { useAuth } from '../context/AuthContext.jsx';

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
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    
    // Modal states
    const [showItemModal, setShowItemModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showOcrModal, setShowOcrModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Sticker Modal states
    const [showStickerModal, setShowStickerModal] = useState(false);
    const [stickerItems, setStickerItems] = useState([]);
    const [showWeightLabelModal, setShowWeightLabelModal] = useState(false);

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
                type: adjustment.type === 'remove' ? 'DEDUCT' : 'ADD',
                // Ensure numeric fields are numbers
                freeQuantity: parseFloat(adjustment.freeQuantity) || 0,
                gstAmount: parseFloat(adjustment.gstAmount) || 0,
                discountAmount: parseFloat(adjustment.discountAmount) || 0,
                invoiceNumber: adjustment.invoiceNumber || null,
            };
            await api.post(`/inventory/${itemId}/adjust`, payload);
            setShowAdjustModal(false);
            toast.success('Inventory updated & expense recorded!');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to adjust stock');
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
        e.target.value = ''; // reset input

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/inventory/import-csv', formData);
            if (res.data.success) {
                const count = res.data.data?.count || 0;
                toast.success(`Imported ${count} items! Expenditure recorded automatically.`);
                fetchData();
            } else {
                toast.error(res.data.message || 'Import failed.');
            }
        } catch (err) {
            console.error('CSV Import Error:', err);
            toast.error(err.response?.data?.message || 'Error importing CSV. Check the file format.');
        } finally {
            setLoading(false);
        }
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
            {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
            <div className="inv-page-header">
                {/* Row 1: Title + Status Badges */}
                <div className="inv-header-top">
                    <div className="inv-title-group">
                        <div className="inv-title-icon">📦</div>
                        <div>
                            <h1 className="inv-title">Inventory Management</h1>
                            <p className="inv-subtitle">{items.length} items · Manage stock levels, batches &amp; pricing</p>
                        </div>
                    </div>
                    <div className="inv-header-badges">
                        <div className={`inv-badge ${isScaleConnected ? 'badge-green' : 'badge-gray'}`}>
                            <span className="badge-dot"></span>
                            {isScaleConnected ? `Scale: ${scaleData} ${selectedItem?.unit || 'KG'}` : 'Scale Offline'}
                        </div>
                        <div className="inv-badge badge-blue">
                            <span>🔍</span> Scanner Ready
                        </div>
                        <StakeholderRestaurantTabs />
                    </div>
                </div>

                {/* Row 2: Tab Switcher only */}
                <div className="inv-tab-row">
                    <button
                        className={`inv-tab-sm ${activeTab === 'stock' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stock')}
                    >
                        📦 Stock Levels
                    </button>
                    <button
                        className={`inv-tab-sm ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                    >
                        🕒 Activity Log
                    </button>
                </div>

                {/* Row 3: Action Buttons */}
                <div className="inv-action-row">
                    {/* Scale Connect */}
                    <div className="inv-scale-group">
                        {!isScaleConnected && (
                            <select
                                className="inv-baud-select"
                                value={baudRate}
                                onChange={(e) => setBaudRate(parseInt(e.target.value))}
                            >
                                <option value={2400}>2400</option>
                                <option value={4800}>4800</option>
                                <option value={9600}>9600</option>
                                <option value={19200}>19200</option>
                                <option value={115200}>115200</option>
                            </select>
                        )}
                        <button
                            className={`inv-action-btn btn-scale ${isScaleConnected ? 'connected' : ''}`}
                            onClick={isScaleConnected ? disconnectScale : connectScale}
                        >
                            ⚖️ {isScaleConnected ? 'Disconnect' : 'Scale'}
                        </button>
                    </div>

                    <div className="inv-btn-divider" />

                    <button
                        className={`inv-action-btn btn-toggle ${scannerMode ? 'active' : ''}`}
                        onClick={() => { setScannerMode(!scannerMode); setBulkEditMode(false); }}
                        title="Scan barcodes to instantly adjust stock"
                    >
                        {scannerMode ? '🔴 Stop Scan' : '🔍 Scan Mode'}
                    </button>
                    <button
                        className={`inv-action-btn btn-toggle ${bulkEditMode ? 'active' : ''}`}
                        onClick={() => { setBulkEditMode(!bulkEditMode); setScannerMode(false); }}
                        title="Edit many items at once"
                    >
                        {bulkEditMode ? '🔴 Stop Bulk' : '✏️ Bulk Edit'}
                    </button>

                    <div className="inv-btn-divider" />

                    <button
                        className="inv-action-btn btn-label"
                        onClick={() => { setSelectedItem(null); setShowWeightLabelModal(true); }}
                        title="Print a quick label"
                    >
                        🏷️ Label
                    </button>

                    <input type="file" accept=".csv" id="csv-upload" style={{display:'none'}} onChange={handleCsvImport} />
                    <button
                        className="inv-action-btn btn-csv"
                        onClick={() => document.getElementById('csv-upload').click()}
                    >
                        📂 CSV
                    </button>

                    <button
                        className="inv-action-btn btn-ai"
                        onClick={() => setShowOcrModal(true)}
                    >
                        📸 Scan Invoice
                    </button>

                    <button
                        className="inv-action-btn btn-add"
                        onClick={() => { setSelectedItem(null); setIsEditing(false); setShowItemModal(true); }}
                    >
                        ➕ Add Item
                    </button>

                    <button
                        className="inv-action-btn btn-wipe"
                        onClick={handleClearAllItems}
                        disabled={loading || items.length === 0}
                        title="Wipe all inventory items"
                    >
                        🗑️
                    </button>
                </div>
            </div>

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
                            value={`₹${items.reduce((acc, i) => acc + (i.currentStock * (i.price || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
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
                        <div className="inv-filter-group">
                            <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                {['All', ...new Set(items.map(i => i.category || 'General'))].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className={`low-stock-toggle ${showLowStockOnly ? 'active' : ''}`} onClick={() => setShowLowStockOnly(!showLowStockOnly)}>
                                <div className="toggle-switch"></div>
                                <span>Low Stock Only</span>
                            </div>
                            <div className="view-mode-toggle">
                                <button 
                                    className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    onClick={() => setViewMode('grid')}
                                >
                                    Grid
                                </button>
                                <button 
                                    className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                >
                                    List
                                </button>
                            </div>
                        </div>
                    </section>

                    {loading ? (
                        <div className="loading-grid">
                            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-card"></div>)}
                        </div>
                    ) : !bulkEditMode ? (
                        viewMode === 'grid' ? (
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
                                        onWeighPrint={() => { setSelectedItem(item); setShowWeightLabelModal(true); }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="inventory-list-wrapper" style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <table className="inventory-list-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Item Name</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Category</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Current Stock</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Sales Price</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Cost</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Inv. Value</th>
                                            <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.filter(item => {
                                            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
                                            const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                                            const matchesLowStock = !showLowStockOnly || (item.currentStock <= item.lowStockThreshold);
                                            return matchesSearch && matchesCategory && matchesLowStock;
                                        }).map(item => (
                                            <tr key={item._id || item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                                    {item.currentStock <= item.lowStockThreshold && <span style={{ color: '#ef4444', fontSize: '16px' }} title="Low Stock">⚠️</span>}
                                                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                                                    {item.packMultiplier > 1 && <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' }}>Pack: {item.packMultiplier}</span>}
                                                </td>
                                                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>{item.category || 'General'}</td>
                                                <td style={{ padding: '12px', fontWeight: 'bold', color: item.currentStock <= 0 ? '#ef4444' : 'var(--text-primary)' }}>
                                                    {item.currentStock} <span style={{ fontSize: '11px', opacity: 0.7 }}>{item.unit}</span>
                                                </td>
                                                <td style={{ padding: '12px', color: 'var(--text-primary)' }}>₹{item.price?.toFixed(2) || '0.00'}</td>
                                                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>₹{item.costPerUnit?.toFixed(2) || '0.00'}</td>
                                                <td style={{ padding: '12px', color: '#10b981', fontWeight: 'bold' }}>₹{(item.currentStock * (item.price || 0)).toFixed(2)}</td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                        <button className="icon-btn-small" onClick={() => { setSelectedItem(item); setShowAdjustModal(true); }} title="Adjust Stock" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}>➕➖</button>
                                                        <button className="icon-btn-small" onClick={() => { setSelectedItem(item); setIsEditing(true); setShowItemModal(true); }} title="Edit Details" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}>✏️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
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

            <WeightLabelModal 
                show={showWeightLabelModal}
                onClose={() => setShowWeightLabelModal(false)}
                item={selectedItem}
                scaleValue={scaleData}
                inventoryItems={items}
            />

            {showOcrModal && (
                <InvoiceOcrModal 
                    onClose={() => setShowOcrModal(false)}
                    toast={toast}
                    onComplete={() => {
                        setShowOcrModal(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}

function InventoryCard({ item, onEdit, onDelete, onAdjust, onPrint, onWeighPrint }) {
    const isLow = item.currentStock <= item.lowStockThreshold && item.currentStock > 0;
    const isCritical = item.currentStock === 0;
    
    const max = item.lowStockThreshold * 4 || 10;
    const pct = Math.min(100, (item.currentStock / max) * 100);
    
    let statusClass = 'good';
    if (isCritical) statusClass = 'critical';
    else if (isLow) statusClass = 'low';

    const accentColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e';

    return (
        <div className={`inv-card ${statusClass}`}>
            {/* Status Strip */}
            <div className="inv-card-strip" style={{ background: accentColor }} />

            <div className="inv-card-body">
                {/* Top: Name + Stock Number */}
                <div className="inv-card-top">
                    <div className="inv-card-name-group">
                        <h2 className="inv-card-name">{item.name}</h2>
                        <div className="inv-card-meta-row">
                            <span className="inv-cat-badge">{item.category || 'General'}</span>
                            {item.packSize && <span className="inv-pack-badge">Pack: {item.packSize}</span>}
                            {item.manufacturer && <span className="inv-mfr-badge">{item.manufacturer}</span>}
                            {item.batchNo && <span className="inv-batch-badge">Batch: {item.batchNo}</span>}
                        </div>
                    </div>
                    <div className="inv-stock-display">
                        <div className="inv-stock-number" style={{ color: accentColor }}>
                            {item.currentStock}
                        </div>
                        <div className="inv-stock-unit">
                            {item.unit || 'Units'}
                            {item.packMultiplier > 1 && (
                                <span style={{display:'block', fontSize:'11px', opacity:0.75, marginTop:'1px'}}>
                                    {Math.floor(item.currentStock / item.packMultiplier)} Packs
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="inv-progress-wrap">
                    <div className="inv-progress-bar">
                        <div 
                            className={`inv-progress-fill ${statusClass}`} 
                            style={{ width: `${pct}%` }} 
                        />
                    </div>
                    <div className="inv-progress-labels">
                        <span className={`inv-status-pill ${statusClass}`}>
                            {isCritical ? '🔴 Out of Stock' : isLow ? '⚠️ Low Stock' : '✅ In Stock'}
                        </span>
                        <span className="inv-pct-label">{Math.round(pct)}%</span>
                    </div>
                </div>

                {/* Pricing Row */}
                <div className="inv-card-pricing">
                    <div className="inv-price-item">
                        <span className="inv-price-label">MRP</span>
                        <span className="inv-price-val">
                            ₹{item.price?.toFixed(2) || 0}
                            {item.packMultiplier > 1 && <small style={{fontSize: '10px', display: 'block', opacity: 0.7}}>₹{(item.price * item.packMultiplier).toFixed(2)}/Pack</small>}
                        </span>
                    </div>
                    {item.costPerUnit > 0 && (
                        <div className="inv-price-item">
                            <span className="inv-price-label">Cost</span>
                            <span className="inv-price-val muted">₹{Number(item.costPerUnit).toFixed(2)}</span>
                        </div>
                    )}
                    {item.expDate && (
                        <div className="inv-price-item">
                            <span className="inv-price-label">Exp</span>
                            <span className="inv-price-val exp">{item.expDate}</span>
                        </div>
                    )}
                    <button className="inv-adjust-btn" onClick={onAdjust}>
                        ⚡ Adjust
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="inv-card-footer">
                <div className="inv-supplier-info">
                    <span className="inv-supplier-label">Supplier</span>
                    <span className="inv-supplier-name">{item.supplierName || '—'}</span>
                </div>
                <div className="inv-card-actions">
                    <button className="inv-icon-btn btn-weigh" onClick={onWeighPrint} title="Weigh & Print">⚖️</button>
                    <button className="inv-icon-btn btn-print" onClick={onPrint} title="Print Labels">🖨️</button>
                    <button className="inv-icon-btn btn-edit" onClick={onEdit} title="Edit">✏️</button>
                    <button className="inv-icon-btn btn-del" onClick={onDelete} title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    );
}

function ItemModal({ onSubmit, onClose, initialData, isEditing, scaleValue }) {
    const { user } = useAuth();
    const categories = user?.stockCategories 
        ? user.stockCategories.split(',').map(c => c.trim()).filter(Boolean)
        : ['General', 'Grocery', 'Clothing', 'Pharmacy', 'Others'];

    const defaultGst = typeof user?.taxRate === 'number' ? user.taxRate : 0;

    const [formData, setFormData] = useState(initialData || {
        name: '',
        category: categories[0] || 'General',
        barcode: '',
        unit: 'KG',
        currentStock: 0,
        lowStockThreshold: 1,
        costPerUnit: 0,
        price: 0,
        isBilliable: true,
        supplierName: '',
        supplierPhone: '',
        batchNo: '',
        mfgDate: '',
        expDate: '',
        hsnCode: '',
        manufacturer: '',
        packSize: '',
        packMultiplier: 1,
        gstPercent: defaultGst,
        paidStock: 0,
        freeStock: 0
    });

    const updateTotals = (paid, free) => {
        const total = (parseFloat(paid) || 0) + (parseFloat(free) || 0);
        setFormData(prev => ({...prev, paidStock: paid, freeStock: free, currentStock: total}));
    };

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
                            <select 
                                className="inventory-input" 
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
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
                        <div className="form-group">
                            <label>GST (%)</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                placeholder="GST %"
                                value={formData.gstPercent || 0}
                                onChange={(e) => setFormData({...formData, gstPercent: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                        <div className="form-group">
                            <label>HSN Code</label>
                            <input 
                                type="text"
                                className="inventory-input" 
                                placeholder="HSN Number"
                                value={formData.hsnCode || ''}
                                onChange={(e) => setFormData({...formData, hsnCode: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
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
                            <label>{isEditing ? 'Stock Weight' : 'Paid Stock'} ({formData.unit})</label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01"
                                min="0"
                                value={isEditing ? (formData.currentStock === 0 ? '' : formData.currentStock) : (formData.paidStock === 0 ? '' : formData.paidStock)}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isEditing) {
                                        setFormData({...formData, currentStock: Math.abs(val)});
                                    } else {
                                        updateTotals(Math.abs(val), formData.freeStock);
                                    }
                                }}
                            />
                        </div>
                        {!isEditing && (
                            <div className="form-group">
                                <label style={{color: '#10b981'}}>Free Stock ({formData.unit})</label>
                                <input 
                                    type="number" 
                                    className="inventory-input" 
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    value={formData.freeStock === 0 ? '' : formData.freeStock}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updateTotals(formData.paidStock, Math.abs(val));
                                    }}
                                />
                            </div>
                        )}
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

                    {!isEditing && (formData.paidStock > 0 || formData.freeStock > 0) && (
                        <div style={{background:'rgba(34,197,94,0.07)',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',color:'#15803d',marginBottom:'16px',borderLeft:'4px solid #10b981'}}>
                            📦 Total Initial Stock: <b>{formData.currentStock} {formData.unit}</b>
                            {formData.packMultiplier > 1 && <span style={{opacity:0.75,marginLeft:8}}> ({Math.floor(formData.currentStock/formData.packMultiplier)} Packs)</span>}
                        </div>
                    )}

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

                    {(formData.category === 'Pharmacy' || formData.manufacturer || formData.batchNo) && (
                        <div className="pharmacy-batch-section animate-fade-in" style={{
                            background: 'var(--bg-secondary)', 
                            border: '1px solid rgba(16, 185, 129, 0.3)', 
                            padding: '16px', 
                            borderRadius: '8px', 
                            marginTop: '16px',
                            borderLeft: '4px solid #10b981'
                        }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💊 Professional / Pharma Details
                            </h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Manufacturer (MFR)</label>
                                    <input 
                                        className="inventory-input" 
                                        placeholder="Manufacturer Name"
                                        value={formData.manufacturer || ''}
                                        onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Pack Size</label>
                                    <input 
                                        className="inventory-input" 
                                        placeholder="e.g. 10*5, 15 tabs"
                                        value={formData.packSize || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Auto-calculate multiplier if user types 10*5
                                            let mult = 1;
                                            const parts = val.toLowerCase().replace(/[^0-9*x]/g, '').split(/[x*]/);
                                            if (parts.length > 1) {
                                                mult = parts.reduce((acc, p) => acc * (parseInt(p) || 1), 1);
                                            } else {
                                                mult = parseInt(val.replace(/[^0-9]/g, '')) || 1;
                                            }
                                            setFormData({...formData, packSize: val, packMultiplier: mult});
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Multiplier (Pieces/Pack)</label>
                                    <input 
                                        type="number"
                                        className="inventory-input" 
                                        value={formData.packMultiplier || 1}
                                        onChange={(e) => setFormData({...formData, packMultiplier: parseInt(e.target.value) || 1})}
                                    />
                                </div>
                            </div>
                            <div className="form-row" style={{ marginTop: '12px' }}>
                                <div className="form-group">
                                    <label>Batch No.</label>
                                    <input 
                                        className="inventory-input" 
                                        placeholder="Enter Batch"
                                        value={formData.batchNo}
                                        onChange={(e) => setFormData({...formData, batchNo: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="form-row" style={{ marginTop: '12px' }}>
                                <div className="form-group">
                                    <label>Mfg Date</label>
                                    <input 
                                        className="inventory-input" 
                                        placeholder="MM/YYYY"
                                        value={formData.mfgDate}
                                        onChange={(e) => setFormData({...formData, mfgDate: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Exp Date</label>
                                    <input 
                                        className="inventory-input" 
                                        placeholder="MM/YYYY"
                                        value={formData.expDate}
                                        onChange={(e) => setFormData({...formData, expDate: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="modal-footer" style={{margin: '1.25rem -1.5rem -1.25rem -1.5rem', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px'}}>
                        <button type="button" className="cancel-btn" onClick={onClose}>Discard</button>
                        <button type="submit" className="save-btn">{isEditing ? 'Update Item' : 'Add to Inventory'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}


function AdjustModal({ item, onSubmit, onClose, scaleValue }) {
    const { user } = useAuth();
    const defaultGstPercent = typeof user?.taxRate === 'number' ? user.taxRate : (item.gstPercent || 18);

    const [adjustment, setAdjustment] = useState({
        type: 'add',
        quantity: 0,
        freeQuantity: 0,
        reason: '',
        totalCost: 0,
        gstPercent: defaultGstPercent,
        discountAmount: 0,
        invoiceNumber: '',
        recordAsExpense: true,
        paymentMethod: 'Cash'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const computedGstAmount = +((adjustment.totalCost || 0) * (adjustment.gstPercent || 0) / 100).toFixed(2);
        onSubmit({
            ...adjustment,
            gstAmount: computedGstAmount
        });
    };

    const handleCaptureScale = () => {
        setAdjustment({ ...adjustment, quantity: scaleValue });
    };

    const packMultiplier = item.packMultiplier || 1;

    return (
        <div className="inventory-modal-overlay animate-fade">
            <div className="inventory-modal scale-in" style={{maxWidth: '560px'}}>
                <div className="modal-header">
                    <h2>⚡ Stock Adjustment</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                <div className="adjust-item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="current-stock">
                        Current: <b>{item.currentStock}</b> {item.unit}
                        {packMultiplier > 1 && <small style={{marginLeft:6,opacity:0.7}}>({Math.floor(item.currentStock/packMultiplier)} Packs)</small>}
                    </span>
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
                                ➕ Receive Stock
                            </button>
                            <button 
                                type="button"
                                className={`type-toggle-btn remove ${adjustment.type === 'remove' ? 'active' : ''}`}
                                onClick={() => setAdjustment({...adjustment, type: 'remove'})}
                            >
                                ➖ Consume / Remove
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

                    {/* Paid Qty + Free Qty row */}
                    <div className="form-row" style={{marginTop:'8px'}}>
                        <div className="form-group">
                            <label>
                                {adjustment.type === 'add' ? 'Paid Quantity' : 'Quantity'} ({item.unit})
                                {packMultiplier > 1 && <span style={{fontWeight:'normal',opacity:0.65}}> — 1 Pack = {packMultiplier} {item.unit}</span>}
                            </label>
                            <input 
                                type="number" 
                                className="inventory-input" 
                                step="0.01" 
                                min="0"
                                required
                                placeholder="0"
                                value={adjustment.quantity === 0 ? '' : adjustment.quantity}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setAdjustment(prev => ({
                                        ...prev, 
                                        quantity: Math.abs(val),
                                        totalCost: prev.recordAsExpense ? +(Math.abs(val) * (item.costPerUnit || 0)).toFixed(2) : prev.totalCost
                                    }));
                                }}
                            />
                        </div>
                        {adjustment.type === 'add' && (
                            <div className="form-group">
                                <label style={{color:'#16a34a'}}>🎁 Free Quantity ({item.unit})
                                    <span style={{fontWeight:'normal',opacity:0.7,fontSize:'11px'}}> (no cost)</span>
                                </label>
                                <input 
                                    type="number" 
                                    className="inventory-input" 
                                    step="0.01" 
                                    min="0"
                                    placeholder="0"
                                    value={adjustment.freeQuantity === 0 ? '' : adjustment.freeQuantity}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setAdjustment({...adjustment, freeQuantity: isNaN(val) ? 0 : Math.abs(val)});
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {adjustment.type === 'add' && (adjustment.quantity > 0 || adjustment.freeQuantity > 0) && (
                        <div style={{background:'rgba(34,197,94,0.07)',borderRadius:'8px',padding:'6px 12px',fontSize:'12px',color:'#15803d',marginBottom:'4px'}}>
                            📦 Total Stock to Add: <b>{(adjustment.quantity || 0) + (adjustment.freeQuantity || 0)} {item.unit}</b>
                            {packMultiplier > 1 && <span style={{opacity:0.75}}> ({Math.floor(((adjustment.quantity||0)+(adjustment.freeQuantity||0))/packMultiplier)} Packs)</span>}
                        </div>
                    )}

                    {/* Packs Helper */}
                    {packMultiplier > 1 && (
                        <div className="form-group-grid" style={{ marginBottom: '15px', background: 'var(--bg-hover)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div className="form-field">
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>🧮 Calculate by Packs (1 Pack = {packMultiplier} {item.unit})</label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                                    <input 
                                        type="number" 
                                        className="form-input small" 
                                        placeholder="Paid Packs"
                                        onChange={(e) => {
                                            const packs = parseFloat(e.target.value);
                                            if (!isNaN(packs)) {
                                                const newQty = packs * packMultiplier;
                                                setAdjustment(prev => ({
                                                    ...prev, 
                                                    quantity: newQty,
                                                    totalCost: prev.recordAsExpense ? +(newQty * (item.costPerUnit || 0)).toFixed(2) : prev.totalCost
                                                }));
                                            }
                                        }}
                                    />
                                    {adjustment.type === 'add' && (
                                    <input 
                                        type="number" 
                                        className="form-input small" 
                                        placeholder="Free Packs"
                                        onChange={(e) => {
                                            const packs = parseFloat(e.target.value);
                                            if (!isNaN(packs)) {
                                                setAdjustment(prev => ({...prev, freeQuantity: packs * packMultiplier}));
                                            }
                                        }}
                                    />
                                    )}
                                </div>
                                <small style={{ display: 'block', marginTop: '4px', color: 'var(--accent)' }}>Typing here automatically calculates the base {item.unit} above.</small>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Reason / Note</label>
                        <textarea 
                            className="inventory-textarea" 
                            placeholder="Why is this stock moving? (e.g. Spillage, Usage in Dish, Restock from Supplier)"
                            required
                            value={adjustment.reason}
                            onChange={(e) => setAdjustment({...adjustment, reason: e.target.value})}
                        />
                    </div>

                    {adjustment.type === 'add' && (
                        <div className="expense-recording-section" style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <input 
                                    type="checkbox" 
                                    id="recordExpense" 
                                    checked={adjustment.recordAsExpense}
                                    onChange={(e) => setAdjustment({
                                        ...adjustment, 
                                        recordAsExpense: e.target.checked, 
                                        totalCost: e.target.checked ? +(adjustment.quantity * (item.costPerUnit || 0)).toFixed(2) : 0
                                    })}
                                />
                                <label htmlFor="recordExpense" style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>💰 Record as Purchase Expenditure</label>
                            </div>

                            {adjustment.recordAsExpense && (
                                <div className="animate-fade-in">
                                    {/* Invoice No + Payment Method */}
                                    <div className="form-row" style={{marginBottom:'8px'}}>
                                        <div className="form-group">
                                            <label>Invoice Number <span style={{opacity:0.6,fontWeight:'normal'}}>(groups in Expenditure)</span></label>
                                            <input 
                                                className="inventory-input"
                                                placeholder="e.g. INV-2024-001"
                                                value={adjustment.invoiceNumber}
                                                onChange={(e) => setAdjustment({...adjustment, invoiceNumber: e.target.value})}
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

                                    {/* Cost + GST + Discount */}
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Base Cost (₹) <span style={{opacity:0.6,fontWeight:'normal'}}>(paid qty only)</span></label>
                                            <input 
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0.00"
                                                value={adjustment.totalCost || ''}
                                                onChange={(e) => setAdjustment({...adjustment, totalCost: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>GST (%)</label>
                                            <input 
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0"
                                                value={adjustment.gstPercent !== undefined ? adjustment.gstPercent : ''}
                                                onChange={(e) => setAdjustment({...adjustment, gstPercent: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Discount (₹)</label>
                                            <input 
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0.00"
                                                value={adjustment.discountAmount || ''}
                                                onChange={(e) => setAdjustment({...adjustment, discountAmount: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                    </div>

                                    {/* Net total preview */}
                                    <div style={{background:'rgba(99,102,241,0.07)',borderRadius:'8px',padding:'6px 12px',fontSize:'13px',color:'#4f46e5',fontWeight:'600'}}>
                                        Net Total: ₹{((adjustment.totalCost||0) + ((adjustment.totalCost || 0) * (adjustment.gstPercent || 0) / 100) - (adjustment.discountAmount||0)).toFixed(2)} (calculated GST: ₹{((adjustment.totalCost || 0) * (adjustment.gstPercent || 0) / 100).toFixed(2)})
                                        {adjustment.freeQuantity > 0 && <span style={{fontWeight:'normal',opacity:0.75,marginLeft:8}}>({adjustment.freeQuantity} {item.unit} free, not charged)</span>}
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
