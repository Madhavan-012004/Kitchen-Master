import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client.js';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import './Inventory.css';
import BarcodeStickerModal from '../components/BarcodeStickerModal';
import WeightLabelModal from '../components/WeightLabelModal';
import InvoiceOcrModal from '../components/InvoiceOcrModal';
import A4LabelPrintModal from '../components/A4LabelPrintModal';
import { useAuth } from '../context/AuthContext.jsx';
import { usePOSMode } from '../context/POSModeContext.jsx';

const UNITS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'DOZEN', 'PACK', 'BOTTLE', 'METER', 'SET', 'ROLL'];

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
    const [vendorFilter, setVendorFilter] = useState('All');
    const [vendors, setVendors] = useState([]);
    const [menuCategories, setMenuCategories] = useState([]);

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
    const [showA4LabelModal, setShowA4LabelModal] = useState(false);

    // Operation modes
    const [scannerMode, setScannerMode] = useState(false);
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [bulkChanges, setBulkChanges] = useState({}); // { itemId: { currentStock, price, name } }
    const { isClothing, isMarket } = usePOSMode();
    const { user } = useAuth();
    const [toastMsg, setToastMsg] = useState('');
    const [selectedA4StockIds, setSelectedA4StockIds] = useState(new Set());

    const toggleSelection = (id) => {
        setSelectedA4StockIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = (filteredItems, isSelected) => {
        setSelectedA4StockIds(prev => {
            const next = new Set(prev);
            filteredItems.forEach(i => {
                const id = i._id || i.id;
                if (isSelected) next.add(id);
                else next.delete(id);
            });
            return next;
        });
    };

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
            const [itemsRes, movementsRes, vendorsRes, menuRes] = await Promise.all([
                api.get('/inventory'),
                api.get('/inventory/movements'),
                api.get('/api/vendors').catch(() => ({ data: { data: [] } })),
                api.get('/menu').catch(() => ({ data: { data: { items: [] } } }))
            ]);
            setItems(itemsRes.data.data.items || []);
            setMovements(movementsRes.data.data || []);
            setVendors(vendorsRes.data.data || []);

            const menuItems = menuRes.data?.data?.items || menuRes.data?.data?.menuItems || [];
            const menuCats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
            setMenuCategories(menuCats);
        } catch (err) {
            console.error('Failed to fetch inventory data', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // SCALE INTEGRATION (Native Android + Web Serial API)
    const connectScale = async () => {
        const isAndroidApp = /android/i.test(navigator.userAgent) && (window.location.hostname === 'localhost' || !!window.UsbScaleBridge);

        if (isAndroidApp || (window.Capacitor && window.Capacitor.isNative)) {
            if (!window.UsbScaleBridge) {
                alert('Native Scale bridge missing. Rebuild APK.');
                return;
            }
            const capSer = window.serial || (window.cordova && window.cordova.plugins && window.cordova.plugins.serial);
            if (capSer) {
                try {
                    await new Promise((resolve) => {
                        capSer.requestPermission({ baudRate }, resolve, resolve);
                    });
                } catch (e) { }
            }
            try {
                let addressToConnect = "";
                try {
                    const saved = JSON.parse(localStorage.getItem('km_user') || '{}');
                    const targetName = saved.usbScaleDeviceName || '';
                    if (targetName && window.UsbScaleBridge.getConnectedDevices) {
                        const listObj = JSON.parse(window.UsbScaleBridge.getConnectedDevices());
                        const target = listObj.find(d => d.name === targetName);
                        if (target) addressToConnect = target.address;
                    }
                } catch (e) { }

                const connected = window.UsbScaleBridge.getConnectedDevices
                    ? window.UsbScaleBridge.connect(baudRate, addressToConnect)
                    : window.UsbScaleBridge.connect(baudRate);

                if (typeof connected === 'string' && connected.startsWith('error:')) {
                    alert(connected.substring(6));
                } else if (connected === 'ok' || connected === true) {
                    try { setIsScaleConnected(true); } catch (e) { }
                    keepReadingRef.current = true;
                    if (!window.__scaleBuffer) window.__scaleBuffer = '';

                    window.onScaleData = (data) => {
                        if (!keepReadingRef.current) return;
                        window.__scaleBuffer += String(data);
                        if (window.__scaleBuffer.includes('\n') || window.__scaleBuffer.includes('\r')) {
                            const lines = window.__scaleBuffer.split(/[\r\n]+/);
                            window.__scaleBuffer = lines.pop(); // keep partial block
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                const match = line.match(/[-+]?\d*\.?\d+/);
                                if (match) {
                                    const val = parseFloat(match[0]);
                                    if (!isNaN(val)) {
                                        try { setScaleWeight(Math.abs(val)); } catch (e) { }
                                        try { setScaleData(Math.abs(val)); } catch (e) { }
                                    }
                                }
                            }
                        }
                    };
                } else {
                    alert('Scale connection failed! Ensure scale is connected and no other apps are using it.');
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
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

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('km_user') || '{}');
        if (saved.usbScaleDeviceName) {
            setTimeout(() => connectScale(), 800);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const disconnectScale = async () => {
        keepReadingRef.current = false;
        const isAndroidApp = /android/i.test(navigator.userAgent) && (window.location.hostname === 'localhost' || !!window.UsbScaleBridge);
        if (isAndroidApp || (window.Capacitor && window.Capacitor.isNative)) {
            if (window.UsbScaleBridge) {
                window.UsbScaleBridge.disconnect();
                try { setIsScaleConnected(false); } catch (e) { }
            }
            return;
        }

        if (readerRef.current) {
            try { await readerRef.current.cancel(); } catch (e) { }
        }

        if (port) {
            try {
                await port.close();
            } catch (err) {
                console.error('Port close error:', err);
            }
            setPort(null);
        }
        try { setIsScaleConnected(false); } catch (e) { }
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

    const handleExportActivityLog = () => {
        if (!movements || movements.length === 0) {
            toast.error("No movements to export.");
            return;
        }
        const headers = ["Time,Material,Action,Change,Unit,Performed By,Reason\n"];
        const rows = movements.map(m => {
            const time = `"${new Date(m.timestamp).toLocaleString()}"`;
            const name = `"${m.itemName || ''}"`;
            const action = `"${m.type || ''}"`;
            const change = `"${m.type === 'DEDUCT' ? '-' : '+'}${m.quantity}"`;
            const unit = `"${m.inventoryItem?.unit || ''}"`;
            const performedBy = `"${m.performedByName || 'System'}"`;
            const reason = `"${(m.reason || '').replace(/"/g, '""')}"`;
            return [time, name, action, change, unit, performedBy, reason].join(',');
        });
        const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearActivityLog = async () => {
        if (!window.confirm("⚠️ Are you sure you want to wipe all activity logs? This action cannot be undone.")) return;
        setLoading(true);
        try {
            await api.delete('/inventory/movements');
            setMovements([]);
            toast.success("Activity log wiped successfully!");
        } catch (err) {
            console.error("Failed to clear activity log:", err);
            toast.error("Failed to clear activity log.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        let headers, rows, filename;

        if (isClothing) {
            headers = [
                "name", "barcode", "category", "subCategory", "unit", "brand", "itemType",
                "storageLocation", "costPerUnit", "price", "gstPercent", "discountPercent",
                "hsnCode", "purchaseInvoiceNo", "purchaseDate", "supplierName", "supplierPhone",
                "fabricType", "color", "pattern", "widthInches", "gsm", "materialComposition",
                "rollNumber", "gender", "size", "fitType", "season", "QTY"
            ].join(',');

            rows = [
                "Cotton Plain Shirt,SHR001,Clothing,Men,PIECE,AAVASA,READYMADE,Rack A,500,999,5,10,6105,INV-101,2023-10-01,Supplier X,9876543210,Cotton,Blue,Plain,,,,Men,L,Slim Fit,Summer,50",
                "Silk Fabric Material,FAB001,Clothing,Fabric,METER,,FABRIC,Shelf 2,200,450,5,0,5007,INV-102,2023-10-05,Supplier Y,9876543211,Silk,Red,Floral,44,120,100% Silk,ROLL-55,,,,,,100"
            ];
            filename = "clothing_inventory_template.csv";
        } else if (isMarket) {
            headers = "name,category,barcode,unit,currentStock,lowStockThreshold,costPerUnit,price,batchNo,expDate,hsnCode";

            rows = [
                "Paracetamol 500mg (Strip of 10),Pharmacy,8901234567890,PIECE,50,10,12.50,15.00,BATCH-P001,12-25,3004",
                "Amoxicillin 250mg Capsules,Pharmacy,8901234567891,PIECE,100,20,45.00,55.00,BATCH-A002,10-25,3004",
                "Cetirizine 10mg Tablets,Pharmacy,8901234567892,PIECE,200,30,8.00,10.00,BATCH-C003,08-25,3004",
                "Metformin 500mg,Pharmacy,8901234567893,PIECE,150,25,25.00,32.00,BATCH-M004,11-25,3004",
                "Omeprazole 20mg Capsules,Pharmacy,8901234567894,PIECE,80,15,60.00,75.00,BATCH-O005,09-25,3004",
                "Dolo 650 Tablets,Pharmacy,8901234567895,PIECE,300,50,28.00,30.00,BATCH-D006,01-26,3004",
                "Azithromycin 500mg,Pharmacy,8901234567896,PIECE,40,10,120.00,150.00,BATCH-Z007,05-25,3004",
                "Vicks VapoRub 50g,Pharmacy,8901234567897,BOTTLE,20,5,110.00,135.00,BATCH-V008,03-26,3004",
                "Betadine Ointment 20g,Pharmacy,8901234567898,PIECE,15,5,85.00,105.00,BATCH-B009,12-25,3004",
                "Electral Powder Sachet,Pharmacy,8901234567899,PACK,50,10,18.00,22.00,BATCH-E010,07-25,3004"
            ];
            filename = "market_inventory_template.csv";
        } else {
            headers = [
                "name", "barcode", "category", "unit", "costPerUnit", "price", "gstPercent",
                "hsnCode", "supplierName", "supplierPhone", "manufacturer", "packSize",
                "batchNo", "expDate", "QTY"
            ].join(',');

            rows = [
                "Basmati Rice,RICE01,Grocery,KG,80,120,5,1001,Supplier A,9999999999,,,,,50",
                "Paracetamol 500mg,MED01,Pharmacy,PACK,10,25,12,3004,Pharma Dist,,ABC Pharma,10*10,B-456,12/2025,100"
            ];
            filename = "inventory_template.csv";
        }

        const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                            <p className="inv-subtitle">{items.filter(i => i.currentStock > 0).length} items in stock · Manage stock levels, batches &amp; pricing</p>
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

                    <button
                        className="inv-action-btn btn-csv"
                        onClick={() => setShowA4LabelModal(true)}
                        title="Download A4 label sheet PDF for all stock"
                        style={{ background: '#0f172a', color: '#fff', border: 'none' }}
                    >
                        📄 Print Labels {selectedA4StockIds.size > 0 ? `(${selectedA4StockIds.size})` : ''}
                    </button>

                    <input type="file" accept=".csv" id="csv-upload" style={{ display: 'none' }} onChange={handleCsvImport} />
                    <button
                        className="inv-action-btn btn-csv"
                        onClick={() => document.getElementById('csv-upload').click()}
                        title="Upload CSV to import items"
                    >
                        📂 Import CSV
                    </button>
                    <button
                        className="inv-action-btn btn-csv"
                        onClick={handleDownloadTemplate}
                        title="Download sample CSV format"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-color)' }}
                    >
                        📄 Template
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
                            value={items.filter(i => i.currentStock > 0).length}
                            color="rgba(255, 107, 0, 0.1)"
                        />
                        <StatsCard
                            icon="⚠️"
                            label="Low Stock"
                            value={items.filter(i => i.currentStock > 0 && i.currentStock <= i.lowStockThreshold).length}
                            color="rgba(255, 193, 7, 0.1)"
                            textStyle={{ color: '#FFB300' }}
                        />
                        <StatsCard
                            icon="🚨"
                            label="Empty Stock"
                            value={items.filter(i => i.currentStock === 0).length}
                            color="rgba(244, 67, 54, 0.1)"
                            textStyle={{ color: '#F44336' }}
                        />
                        <StatsCard
                            icon="💰"
                            label="Inv. Value"
                            value={`₹${items.reduce((acc, i) => acc + (i.currentStock * (i.price || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            color="rgba(0, 200, 83, 0.1)"
                            textStyle={{ color: '#00C853' }}
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
                            <select className="filter-select" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                                <option value="All">All Suppliers</option>
                                {vendors.map(v => <option key={v.id || v._id} value={v.name}>{v.name}</option>)}
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
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton-card"></div>)}
                        </div>
                    ) : !bulkEditMode ? (
                        viewMode === 'grid' ? (
                            <div className="inventory-grid">
                                {items.filter(item => {
                                    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
                                    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                                    const matchesLowStock = !showLowStockOnly || (item.currentStock <= item.lowStockThreshold);
                                    const matchesVendor = vendorFilter === 'All' || item.supplierName === vendorFilter;
                                    return matchesSearch && matchesCategory && matchesLowStock && matchesVendor;
                                }).map(item => (
                                    <InventoryCard
                                        key={item._id || item.id}
                                        item={item}
                                        isSelected={selectedA4StockIds.has(item._id || item.id)}
                                        onToggleSelect={() => toggleSelection(item._id || item.id)}
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
                                            <th style={{ padding: '12px', width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const currentFiltered = items.filter(item => {
                                                            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
                                                            const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
                                                            const matchesLowStock = !showLowStockOnly || (item.currentStock <= item.lowStockThreshold);
                                                            const matchesVendor = vendorFilter === 'All' || item.supplierName === vendorFilter;
                                                            return matchesSearch && matchesCategory && matchesLowStock && matchesVendor;
                                                        });
                                                        handleSelectAll(currentFiltered, e.target.checked);
                                                    }}
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                />
                                            </th>
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
                                            const matchesVendor = vendorFilter === 'All' || item.supplierName === vendorFilter;
                                            return matchesSearch && matchesCategory && matchesLowStock && matchesVendor;
                                        }).map(item => (
                                            <tr key={item._id || item.id} style={{ borderBottom: '1px solid var(--border)', background: selectedA4StockIds.has(item._id || item.id) ? 'rgba(59, 130, 246, 0.05)' : '' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedA4StockIds.has(item._id || item.id)}
                                                        onChange={() => toggleSelection(item._id || item.id)}
                                                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                    />
                                                </td>
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
                                            const matchesVendor = vendorFilter === 'All' || item.supplierName === vendorFilter;
                                            return matchesSearch && matchesCategory && matchesVendor;
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
                    <ActivityLog
                        movements={movements}
                        onExport={handleExportActivityLog}
                        onClear={handleClearActivityLog}
                    />
                </div>
            )}

            {showItemModal && (
                <ItemModal
                    onSubmit={handleSaveItem}
                    onClose={() => setShowItemModal(false)}
                    initialData={isEditing ? selectedItem : null}
                    isEditing={isEditing}
                    scaleValue={scaleData}
                    allItems={items}
                    vendors={vendors}
                    menuCategories={menuCategories}
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

            <A4LabelPrintModal
                show={showA4LabelModal}
                onClose={() => setShowA4LabelModal(false)}
                items={selectedA4StockIds.size > 0 ? items.filter(i => selectedA4StockIds.has(i._id || i.id)) : items}
                onSuccess={fetchData}
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

function InventoryCard({ item, onEdit, onDelete, onAdjust, onPrint, onWeighPrint, isSelected, onToggleSelect }) {
    const isLow = item.currentStock <= item.lowStockThreshold && item.currentStock > 0;
    const isCritical = item.currentStock === 0;

    const max = item.lowStockThreshold * 4 || 10;
    const pct = Math.min(100, (item.currentStock / max) * 100);

    let statusClass = 'good';
    if (isCritical) statusClass = 'critical';
    else if (isLow) statusClass = 'low';

    const accentColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e';

    return (
        <div className={`inv-card ${statusClass}`} style={{ position: 'relative', border: isSelected ? '2px solid #3b82f6' : '', boxShadow: isSelected ? '0 4px 15px rgba(59, 130, 246, 0.2)' : '' }}>
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
                            {item.color && <span className="inv-color-badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.25)' }}>🎨 {item.color}</span>}
                            {item.size && <span className="inv-size-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', padding: '2px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>Size: {item.size}</span>}
                        </div>
                    </div>
                    <div className="inv-stock-display">
                        <div className="inv-stock-number" style={{ color: accentColor }}>
                            {Number.isInteger(item.currentStock)
                                ? item.currentStock
                                : parseFloat(item.currentStock.toFixed(3))}
                        </div>
                        <div className="inv-stock-unit">
                            {item.unit || 'Units'}
                            {item.packMultiplier > 1 && (
                                <span style={{ display: 'block', fontSize: '11px', opacity: 0.75, marginTop: '1px' }}>
                                    {(item.currentStock / item.packMultiplier).toFixed(2)} Packs
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
                            {item.packMultiplier > 1 && <small style={{ fontSize: '10px', display: 'block', opacity: 0.7 }}>₹{(item.price * item.packMultiplier).toFixed(2)}/Pack</small>}
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
                    {onToggleSelect && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-primary)', border: `1px solid ${isSelected ? '#3b82f6' : 'var(--border)'}`, cursor: 'pointer' }} onClick={onToggleSelect} title="Select this item">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={onToggleSelect}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6', margin: 0 }}
                            />
                        </div>
                    )}
                    <button className="inv-icon-btn btn-weigh" onClick={onWeighPrint} title="Weigh & Print">⚖️</button>
                    <button className="inv-icon-btn btn-print" onClick={onPrint} title="Print Labels">🖨️</button>
                    <button className="inv-icon-btn btn-edit" onClick={onEdit} title="Edit">✏️</button>
                    <button className="inv-icon-btn btn-del" onClick={onDelete} title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    );
}


// ─── Stable module-level helpers (MUST be outside ItemModal to prevent focus loss on keystroke) ─────
function SectionHeader({ icon, label, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '24px 0 16px', padding: '10px 14px', background: `${color}10`, borderRadius: '8px', borderLeft: `4px solid ${color}` }}>
            <span style={{ fontSize: '18px' }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</span>
        </div>
    );
}

function Field({ label, subLabel, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            {subLabel
                ? <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>{subLabel}</span>
                : <span style={{ fontSize: '11px', marginBottom: '2px' }}>&nbsp;</span>
            }
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
        </div>
    );
}

function ItemModal({ onSubmit, onClose, initialData, isEditing, scaleValue, allItems, vendors = [], menuCategories = [] }) {
    const { user } = useAuth();
    const { isClothing, supermarketMode, isPoultry } = usePOSMode();

    // Use categories strictly defined in Settings (Stock Categories Manager)
    const configuredCats = user?.stockCategories
        ? user.stockCategories.split(',').map(c => c.trim()).filter(Boolean)
        : ['General', 'Grocery', 'Clothing', 'Pharmacy', 'Others'];

    // For Poultry shop, strictly bind inventory options to existing Menu categories.
    const categoriesList = isPoultry ? [...menuCategories] : [...configuredCats, ...menuCategories];

    // Case-insensitive deduplication so "Chicken" and "chicken" don't duplicate
    const categoryMap = new Map();
    [...categoriesList, initialData?.category].forEach(c => {
        if (!c) return;
        const normalized = String(c).trim().toLowerCase();
        if (!categoryMap.has(normalized)) categoryMap.set(normalized, String(c).trim());
    });

    let categories = Array.from(categoryMap.values());
    if (categories.length === 0) categories = ['General'];

    const itemCats = [...new Set((allItems || []).map(i => i.category).filter(Boolean))];
    const allColors = [...new Set((allItems || []).map(i => i.color).filter(Boolean))];
    const allBrands = [...new Set((allItems || []).map(i => i.brand).filter(Boolean))];
    const allSizes = [...new Set((allItems || []).map(i => i.size).filter(Boolean))];
    const allPatterns = [...new Set((allItems || []).map(i => i.pattern).filter(Boolean))];
    const allFabrics = [...new Set((allItems || []).map(i => i.fabricType).filter(Boolean))];

    const defaultGst = typeof user?.taxRate === 'number' ? user.taxRate : 0;

    // Detect if item is clothing from category or context
    const isClothingItem = (cat) => {
        if (isClothing) return true;
        const clothingKeywords = ['cloth', 'fabric', 'shirt', 'saree', 'jeans', 'kurti', 'dress', 'cotton', 'silk', 'linen', 'polyester', 'denim', 't-shirt', 'wear', 'garment', 'textile'];
        return clothingKeywords.some(k => (cat || '').toLowerCase().includes(k));
    };

    const [formData, setFormData] = useState(() => ({
        name: '',
        category: isClothing ? 'Clothing' : (categories[0] || 'General'),
        barcode: '',
        unit: isClothing ? 'PIECE' : 'KG',
        currentStock: 0,
        lowStockThreshold: isClothing ? 2 : 1,
        costPerUnit: 0,
        price: 0,
        isBilliable: true,
        supplierName: '',
        supplierPhone: '',
        supplierGstin: '',
        batchNo: '',
        mfgDate: '',
        expDate: '',
        hsnCode: '',
        manufacturer: '',
        packSize: '',
        packMultiplier: 1,
        gstPercent: defaultGst,
        paidStock: 0,
        freeStock: 0,
        // Clothing ERP fields
        brand: '',
        subCategory: '',
        itemType: isClothing ? 'READYMADE' : '',
        purchaseInvoiceNo: '',
        purchaseDate: '',
        storageLocation: '',
        fabricType: '',
        color: '',
        pattern: '',
        widthInches: '',
        gsm: '',
        materialComposition: '',
        rollNumber: '',
        gender: '',
        size: '',
        fitType: '',
        season: '',
        discountPercent: 0,
        openingStock: 0,
        damagedQty: 0,
        returnedQty: 0,
        reservedQty: 0,
        ...(initialData || {})
    }));

    // When itemType changes, auto-set unit
    useEffect(() => {
        if (formData.itemType === 'FABRIC' && formData.unit === 'PIECE') {
            setFormData(prev => ({ ...prev, unit: 'METER' }));
        } else if (formData.itemType === 'READYMADE' && formData.unit === 'METER') {
            setFormData(prev => ({ ...prev, unit: 'PIECE' }));
        }
    }, [formData.itemType]);

    const f = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const updateTotals = (paid, free) => {
        const total = (parseFloat(paid) || 0) + (parseFloat(free) || 0);
        setFormData(prev => ({ ...prev, paidStock: paid, freeStock: free, currentStock: total }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const handleCaptureScale = () => {
        setFormData(prev => ({ ...prev, currentStock: scaleValue }));
    };

    // ─── Store-mode-aware visibility flags ───────────────────────────────────
    const isPharmacyCategory = (formData.category || '').toLowerCase().includes('pharmacy');
    const showClothingFields = isClothingItem(formData.category);
    const isFabric = formData.itemType === 'FABRIC';
    const isReadyMade = formData.itemType === 'READYMADE';

    // Section-level visibility — store-mode-driven
    const showBrandStorageItemType = isClothing;           // brand/rack/itemType only for clothing shops
    const showSubCategory = isClothing;           // sub-cat (men/women/kids) clothing only
    const showDiscount = isClothing || supermarketMode;
    const showFabricDetails = isClothing && showClothingFields && isFabric;
    const showGarmentDetails = isClothing && showClothingFields && isReadyMade;
    // Pharma/batch: always in market, Pharmacy-category in restaurant, never in clothing
    const showPharmaSection = !isClothing && (supermarketMode || isPharmacyCategory || !!formData.manufacturer || !!formData.batchNo);
    // Damaged/Returned Qty — clothing & market track these
    const showDamagedReturned = isClothing || supermarketMode;
    // Free/bonus stock — clothing & market give free samples/bonus
    const showFreeStock = !isEditing && (isClothing || supermarketMode);

    const modalTitle = isEditing
        ? '✏️ Edit Item'
        : isClothing
            ? '👗 New Clothing Stock Entry'
            : supermarketMode
                ? '🛒 New Market Stock Entry'
                : '🍽️ New Restaurant Item Entry';

    return (
        <div className="inventory-modal-overlay animate-fade">
            <div className="inventory-modal scale-in">
                <div className="modal-header">
                    <h2>{modalTitle}</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>

                    {/* ══ SECTION 1: ITEM DETAILS — All Stores ══ */}
                    <SectionHeader icon="📋" label="Item Details" color="#6366f1" />

                    <div style={{ marginBottom: '16px' }}>
                        <Field
                            label="Item Name / Product Name"
                            subLabel={
                                isClothing
                                    ? (isFabric ? 'e.g. Cotton Fabric Blue Plain' : "e.g. Men's Casual Shirt")
                                    : supermarketMode
                                        ? 'e.g. Paracetamol 500mg, Basmati Rice'
                                        : 'e.g. Butter Chicken, Masala Dosa'
                            }
                        >
                            <input
                                className="inventory-input"
                                required
                                placeholder="Enter item name..."
                                value={formData.name}
                                onChange={(e) => f('name', e.target.value)}
                                style={{ margin: 0 }}
                            />
                        </Field>
                    </div>

                    {/* Row: Barcode | Category | [SubCategory — Clothing only] | Unit */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: showSubCategory ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
                        gap: '12px', alignItems: 'end', marginBottom: '16px'
                    }}>
                        <Field label="Barcode / SKU Code" subLabel="Scan or type SKU">
                            <input
                                type="text"
                                className="inventory-input barcode-capture"
                                placeholder="e.g. SKU001"
                                value={formData.barcode}
                                onChange={(e) => f('barcode', e.target.value)}
                                style={{ margin: 0 }}
                            />
                        </Field>
                        <Field label="Category" subLabel={
                            isClothing ? 'Clothing / Fabric' :
                                supermarketMode ? 'e.g. Grocery, Pharmacy, FMCG' :
                                    'e.g. Starters, Beverages, Desserts'
                        }>
                            <select
                                className="inventory-input"
                                value={formData.category}
                                onChange={(e) => f('category', e.target.value)}
                                style={{ margin: 0 }}
                                required
                            >
                                <option value="" disabled>Select category</option>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </Field>
                        {showSubCategory && (
                            <Field label="Sub-Category" subLabel="Men / Women / Kids">
                                <input
                                    className="inventory-input"
                                    list="inv-subcat-list"
                                    placeholder="Sub-Category"
                                    value={formData.subCategory}
                                    onChange={(e) => f('subCategory', e.target.value)}
                                    style={{ margin: 0 }}
                                />
                                <datalist id="inv-subcat-list">
                                    {['Men', 'Women', 'Kids', 'Unisex', 'Fabric / Raw Material'].map(v => <option key={v} value={v} />)}
                                </datalist>
                            </Field>
                        )}
                        <Field label="Unit" subLabel="Measurement Unit">
                            <select
                                className="inventory-input"
                                value={formData.unit}
                                onChange={(e) => f('unit', e.target.value)}
                                style={{ margin: 0 }}
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </Field>
                    </div>

                    {/* Brand / Storage / Item-Type — Clothing Only */}
                    {showBrandStorageItemType && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                            <Field label="Brand" subLabel="Manufacturer Brand">
                                <input
                                    className="inventory-input"
                                    list="inv-brand-list"
                                    placeholder="e.g. Raymond, AAVASA"
                                    value={formData.brand}
                                    onChange={(e) => f('brand', e.target.value)}
                                    style={{ margin: 0 }}
                                />
                                <datalist id="inv-brand-list">
                                    {allBrands.map(b => <option key={b} value={b} />)}
                                </datalist>
                            </Field>
                            <Field label="Storage Location" subLabel="Physical Position">
                                <input
                                    className="inventory-input"
                                    placeholder="Rack A / Shelf 2"
                                    value={formData.storageLocation}
                                    onChange={(e) => f('storageLocation', e.target.value)}
                                    style={{ margin: 0 }}
                                />
                            </Field>
                            <Field label="Item Type" subLabel="Garment Type">
                                <select
                                    className="inventory-input"
                                    value={formData.itemType}
                                    onChange={(e) => f('itemType', e.target.value)}
                                    style={{ margin: 0 }}
                                >
                                    <option value="READYMADE">👕 Ready-Made Garment</option>
                                    <option value="FABRIC">🧵 Fabric / Raw Material</option>
                                    <option value="GENERAL">📦 General Clothing</option>
                                </select>
                            </Field>
                        </div>
                    )}

                    {/* ══ SECTION 2: PRICING & PURCHASE — All Stores ══ */}
                    <SectionHeader icon="💰" label="Pricing & Purchase Details" color="#10b981" />

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: showDiscount ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
                        gap: '12px', alignItems: 'end', marginBottom: '16px'
                    }}>
                        <Field label="Purchase / Cost (₹)" subLabel={isFabric ? 'Per Meter' : 'Buying Price'}>
                            <input type="number" className="inventory-input" step="0.01" placeholder="0.00"
                                value={formData.costPerUnit || 0} onChange={(e) => f('costPerUnit', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                        </Field>
                        <Field label="Selling / MRP (₹)" subLabel="Retail Price">
                            <input type="number" className="inventory-input" step="0.01" placeholder="0.00"
                                value={formData.price || 0} onChange={(e) => f('price', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                        </Field>
                        <Field label="GST (%)" subLabel="Tax Rate">
                            <input type="number" className="inventory-input" placeholder="0"
                                value={formData.gstPercent || 0} onChange={(e) => f('gstPercent', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                        </Field>
                        {showDiscount && (
                            <Field label="Discount (%)" subLabel="Offer Rate">
                                <input type="number" className="inventory-input" placeholder="0"
                                    value={formData.discountPercent || 0} onChange={(e) => f('discountPercent', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                            </Field>
                        )}
                        <Field label="HSN Code" subLabel="Tax Code">
                            <input type="text" className="inventory-input" placeholder="HSN No."
                                value={formData.hsnCode || ''} onChange={(e) => f('hsnCode', e.target.value)} style={{ margin: 0 }} />
                        </Field>
                    </div>

                    {/* Invoice / Date / Supplier row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                        <Field label="Purchase Invoice No." subLabel="Bill Reference">
                            <input className="inventory-input" placeholder="INV-XXXX"
                                value={formData.purchaseInvoiceNo} onChange={(e) => f('purchaseInvoiceNo', e.target.value)} style={{ margin: 0 }} />
                        </Field>
                        <Field label="Purchase Date" subLabel="Date of Entry">
                            <input type="date" className="inventory-input"
                                value={formData.purchaseDate} onChange={(e) => f('purchaseDate', e.target.value)} style={{ margin: 0 }} />
                        </Field>
                        <Field label="Supplier Details" subLabel="Name, Phone, GSTIN">
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                                <select className="inventory-input"
                                    value={formData.supplierName} onChange={(e) => {
                                        const val = e.target.value;
                                        f('supplierName', val);
                                        const v = vendors.find(vend => vend.name === val);
                                        if (v) {
                                            f('supplierPhone', v.phone || '');
                                            f('supplierGstin', v.gstin || '');
                                        }
                                    }} style={{ margin: 0 }}>
                                    <option value="">Select Supplier...</option>
                                    {vendors.map(v => <option key={v.id || v._id} value={v.name}>{v.name}</option>)}
                                    {formData.supplierName && !vendors.find(v => v.name === formData.supplierName) && (
                                        <option value={formData.supplierName}>{formData.supplierName} (Legacy)</option>
                                    )}
                                </select>
                                <input placeholder="Phone" className="inventory-input"
                                    value={formData.supplierPhone || ''} onChange={(e) => f('supplierPhone', e.target.value)} style={{ margin: 0 }} />
                                <input placeholder="GSTIN" className="inventory-input"
                                    value={formData.supplierGstin || ''} onChange={(e) => f('supplierGstin', e.target.value)} style={{ margin: 0 }} />
                            </div>
                        </Field>
                    </div>

                    {/* ══ SECTION 3: FABRIC DETAILS — Clothing + FABRIC type only ══ */}
                    {showFabricDetails && (
                        <>
                            <SectionHeader icon="🧵" label="Fabric / Material Details" color="#8b5cf6" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                                <Field label="Fabric Type" subLabel="Material Base">
                                    <input className="inventory-input" list="inv-fabric-list" placeholder="Cotton, Silk, Denim..."
                                        value={formData.fabricType} onChange={(e) => f('fabricType', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-fabric-list">
                                        {['Cotton', 'Silk', 'Linen', 'Polyester', 'Denim', 'Wool', 'Rayon', 'Chiffon', 'Georgette', 'Velvet', 'Net', ...allFabrics].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="Color" subLabel="Primary Color">
                                    <input className="inventory-input" list="inv-color-list" placeholder="Blue, Red, White..."
                                        value={formData.color} onChange={(e) => f('color', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-color-list">
                                        {['Red', 'Blue', 'Green', 'White', 'Black', 'Navy', 'Maroon', 'Yellow', 'Pink', 'Orange', 'Grey', 'Brown', 'Beige', 'Cream', 'Purple', ...allColors].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="Design / Pattern" subLabel="Print Style">
                                    <input className="inventory-input" list="inv-pattern-list" placeholder="Plain, Printed..."
                                        value={formData.pattern} onChange={(e) => f('pattern', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-pattern-list">
                                        {['Plain', 'Printed', 'Checked', 'Striped', 'Floral', 'Geometric', 'Embroidered', 'Jacquard', 'Tie-Dye', ...allPatterns].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                                <Field label="Width (inches)" subLabel="Panna">
                                    <input className="inventory-input" list="inv-width-list" placeholder="36, 44, 58..."
                                        value={formData.widthInches} onChange={(e) => f('widthInches', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-width-list">
                                        {['36"', '44"', '54"', '58"', '60"', '72"'].map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="GSM" subLabel="Fabric Weight">
                                    <input className="inventory-input" placeholder="e.g. 180, 220"
                                        value={formData.gsm} onChange={(e) => f('gsm', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Material Composition" subLabel="Blend Info">
                                    <input className="inventory-input" placeholder="100% Cotton..."
                                        value={formData.materialComposition} onChange={(e) => f('materialComposition', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Roll Number" subLabel="Physical ID">
                                    <input className="inventory-input" placeholder="Roll ID"
                                        value={formData.rollNumber} onChange={(e) => f('rollNumber', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                            </div>
                        </>
                    )}

                    {/* ══ SECTION 4: GARMENT DETAILS — Clothing + READYMADE type only ══ */}
                    {showGarmentDetails && (
                        <>
                            <SectionHeader icon="👕" label="Garment Details" color="#f59e0b" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                                <Field label="Color" subLabel="Primary Shade">
                                    <input className="inventory-input" list="inv-color-list2" placeholder="Black, White, Navy..."
                                        value={formData.color} onChange={(e) => f('color', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-color-list2">
                                        {['Red', 'Blue', 'Green', 'White', 'Black', 'Navy', 'Maroon', 'Yellow', 'Pink', 'Orange', 'Grey', 'Brown', 'Beige', 'Cream', 'Purple', ...allColors].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="Size" subLabel="Garment Size">
                                    <input className="inventory-input" list="inv-size-list" placeholder="S, M, L, XL..."
                                        value={formData.size} onChange={(e) => f('size', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-size-list">
                                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', '42', '44', ...allSizes].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="Gender" subLabel="Target Audience">
                                    <select className="inventory-input" value={formData.gender} onChange={(e) => f('gender', e.target.value)} style={{ margin: 0 }}>
                                        <option value="">Select Gender</option>
                                        <option value="Men">Men</option>
                                        <option value="Women">Women</option>
                                        <option value="Kids">Kids</option>
                                        <option value="Unisex">Unisex</option>
                                    </select>
                                </Field>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                                <Field label="Material" subLabel="Fabric Blend">
                                    <input className="inventory-input" list="inv-material-list" placeholder="Cotton, Denim, Silk..."
                                        value={formData.fabricType} onChange={(e) => f('fabricType', e.target.value)} style={{ margin: 0 }} />
                                    <datalist id="inv-material-list">
                                        {['Cotton', 'Silk', 'Linen', 'Polyester', 'Denim', 'Wool', 'Rayon', 'Blended', ...allFabrics].filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}
                                    </datalist>
                                </Field>
                                <Field label="Fit Type" subLabel="Silhouette">
                                    <select className="inventory-input" value={formData.fitType} onChange={(e) => f('fitType', e.target.value)} style={{ margin: 0 }}>
                                        <option value="">Select Fit</option>
                                        <option value="Regular">Regular</option>
                                        <option value="Slim">Slim Fit</option>
                                        <option value="Oversized">Oversized</option>
                                        <option value="Relaxed">Relaxed</option>
                                        <option value="Straight">Straight</option>
                                        <option value="Tapered">Tapered</option>
                                    </select>
                                </Field>
                                <Field label="Season" subLabel="Collection">
                                    <select className="inventory-input" value={formData.season} onChange={(e) => f('season', e.target.value)} style={{ margin: 0 }}>
                                        <option value="">Select Season</option>
                                        <option value="All Season">All Season</option>
                                        <option value="Summer">Summer</option>
                                        <option value="Winter">Winter</option>
                                        <option value="Festive">Festive</option>
                                        <option value="Monsoon">Monsoon</option>
                                    </select>
                                </Field>
                            </div>
                        </>
                    )}

                    {/* ══ SECTION 5: STOCK QUANTITIES — All Stores, fields vary ══ */}
                    <SectionHeader icon="📊" label="Stock Quantities & Control" color="#ef4444" />

                    {!isEditing && (
                        <div className="scale-capture-area">
                            <div className="scale-reading">
                                <span className="label">Live Scale Reading</span>
                                <div className="value">{scaleValue} <span className="unit">{formData.unit}</span></div>
                            </div>
                            <button type="button" className="capture-btn" onClick={handleCaptureScale}>
                                ⚖️ Capture Weight
                            </button>
                        </div>
                    )}

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: showDamagedReturned
                            ? (showFreeStock ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr')
                            : (showFreeStock ? '1fr 1fr 1fr' : '1fr 1fr'),
                        gap: '12px', alignItems: 'end', marginBottom: '16px'
                    }}>
                        <Field label={isEditing ? 'Current Stock' : 'Paid Quantity'} subLabel={`In ${formData.unit}`}>
                            <input
                                type="number" className="inventory-input" step="0.01" min="0" placeholder="0"
                                value={isEditing ? (formData.currentStock === 0 ? '' : formData.currentStock) : (formData.paidStock === 0 ? '' : formData.paidStock)}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isEditing) f('currentStock', Math.abs(val));
                                    else updateTotals(Math.abs(val), formData.freeStock);
                                }}
                                style={{ margin: 0 }}
                            />
                        </Field>
                        {showFreeStock && (
                            <Field label="Free / Bonus Stock" subLabel={`In ${formData.unit}`}>
                                <input type="number" className="inventory-input" step="0.01" min="0" placeholder="0"
                                    value={formData.freeStock === 0 ? '' : formData.freeStock}
                                    onChange={(e) => updateTotals(formData.paidStock, Math.abs(parseFloat(e.target.value) || 0))}
                                    style={{ margin: 0 }} />
                            </Field>
                        )}
                        <Field label="Reorder Level" subLabel="Low Stock Alert">
                            <input type="number" className="inventory-input" step="0.01" placeholder="1"
                                value={formData.lowStockThreshold || 0}
                                onChange={(e) => { const v = parseFloat(e.target.value); f('lowStockThreshold', isNaN(v) ? 0 : v); }}
                                style={{ margin: 0 }} />
                        </Field>
                        {showDamagedReturned && (
                            <Field label="Damaged Qty" subLabel="Unsalable">
                                <input type="number" className="inventory-input" min="0" step="1" placeholder="0"
                                    value={formData.damagedQty || 0} onChange={(e) => f('damagedQty', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                            </Field>
                        )}
                        {showDamagedReturned && (
                            <Field label="Returned Qty" subLabel="From Customer">
                                <input type="number" className="inventory-input" min="0" step="1" placeholder="0"
                                    value={formData.returnedQty || 0} onChange={(e) => f('returnedQty', parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
                            </Field>
                        )}
                    </div>

                    {!isEditing && (formData.paidStock > 0 || formData.freeStock > 0) && (
                        <div style={{ background: 'rgba(34,197,94,0.07)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: '#15803d', marginBottom: '16px', borderLeft: '4px solid #10b981' }}>
                            📦 Total Initial Stock: <b>{formData.currentStock} {formData.unit}</b>
                        </div>
                    )}

                    {/* Billing Toggle */}
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.isBilliable !== false ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${formData.isBilliable !== false ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`, transition: 'all 0.2s', margin: 0 }}>
                            <input type="checkbox" checked={formData.isBilliable !== false} onChange={(e) => f('isBilliable', e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer', margin: 0 }} />
                            <span style={{ margin: 0, fontWeight: '600', color: formData.isBilliable !== false ? '#10b981' : 'var(--text-muted)', fontSize: '0.85rem' }}>✅ Available for Billing (POS)</span>
                        </label>
                    </div>

                    {/* ══ SECTION 6: PHARMA / BATCH DETAILS ══
                        - Supermarket: ALWAYS shown (perishables, batch tracking)
                        - Restaurant: Only if category = Pharmacy
                        - Clothing: NEVER shown
                    */}
                    {showPharmaSection && (
                        <div className="pharmacy-batch-section animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '8px', marginTop: '16px', borderLeft: '4px solid #10b981' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {supermarketMode ? '🏪 Product / Batch Details' : '💊 Pharmacy / Batch Details'}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                                <Field label="Manufacturer (MFR)" subLabel="Brand / Maker">
                                    <input className="inventory-input" placeholder="Manufacturer Name" value={formData.manufacturer || ''} onChange={(e) => f('manufacturer', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Pack Size" subLabel="e.g. 10*10, 500ml">
                                    <input className="inventory-input" placeholder="Pack Size" value={formData.packSize || ''} onChange={(e) => {
                                        const val = e.target.value;
                                        let mult = 1;
                                        const parts = val.toLowerCase().replace(/[^0-9*x]/g, '').split(/[x*]/);
                                        if (parts.length > 1) mult = parts.reduce((acc, p) => acc * (parseInt(p) || 1), 1);
                                        else mult = parseInt(val.replace(/[^0-9]/g, '')) || 1;
                                        setFormData(prev => ({ ...prev, packSize: val, packMultiplier: mult }));
                                    }} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Pieces/Pack" subLabel="Multiplier">
                                    <input type="number" className="inventory-input" value={formData.packMultiplier || 1} onChange={(e) => f('packMultiplier', parseInt(e.target.value) || 1)} style={{ margin: 0 }} />
                                </Field>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                                <Field label="Batch No." subLabel="Manufacturing Batch">
                                    <input className="inventory-input" placeholder="Enter Batch No." value={formData.batchNo} onChange={(e) => f('batchNo', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Mfg Date" subLabel="MM/YYYY">
                                    <input className="inventory-input" placeholder="MM/YYYY" value={formData.mfgDate} onChange={(e) => f('mfgDate', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                                <Field label="Exp Date" subLabel="MM/YYYY">
                                    <input className="inventory-input" placeholder="MM/YYYY" value={formData.expDate} onChange={(e) => f('expDate', e.target.value)} style={{ margin: 0 }} />
                                </Field>
                            </div>
                        </div>
                    )}

                    <div className="modal-footer" style={{ margin: '1.25rem -1.5rem -1.25rem -1.5rem', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
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
            <div className="inventory-modal scale-in" style={{ maxWidth: '560px' }}>
                <div className="modal-header">
                    <h2>⚡ Stock Adjustment</h2>
                    <button className="close-x" onClick={onClose}>✕</button>
                </div>
                <div className="adjust-item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="current-stock">
                        Current: <b>{item.currentStock}</b> {item.unit}
                        {packMultiplier > 1 && <small style={{ marginLeft: 6, opacity: 0.7 }}>({Math.floor(item.currentStock / packMultiplier)} Packs)</small>}
                    </span>
                </div>
                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Action</label>
                        <div className="adjustment-type-toggle">
                            <button
                                type="button"
                                className={`type-toggle-btn add ${adjustment.type === 'add' ? 'active' : ''}`}
                                onClick={() => setAdjustment({ ...adjustment, type: 'add' })}
                            >
                                ➕ Receive Stock
                            </button>
                            <button
                                type="button"
                                className={`type-toggle-btn remove ${adjustment.type === 'remove' ? 'active' : ''}`}
                                onClick={() => setAdjustment({ ...adjustment, type: 'remove' })}
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
                    <div className="form-row" style={{ marginTop: '8px' }}>
                        <div className="form-group">
                            <label>
                                {adjustment.type === 'add' ? 'Paid Quantity' : 'Quantity'} ({item.unit})
                                {packMultiplier > 1 && <span style={{ fontWeight: 'normal', opacity: 0.65 }}> — 1 Pack = {packMultiplier} {item.unit}</span>}
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
                                <label style={{ color: '#16a34a' }}>🎁 Free Quantity ({item.unit})
                                    <span style={{ fontWeight: 'normal', opacity: 0.7, fontSize: '11px' }}> (no cost)</span>
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
                                        setAdjustment({ ...adjustment, freeQuantity: isNaN(val) ? 0 : Math.abs(val) });
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {adjustment.type === 'add' && (adjustment.quantity > 0 || adjustment.freeQuantity > 0) && (
                        <div style={{ background: 'rgba(34,197,94,0.07)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>
                            📦 Total Stock to Add: <b>{(adjustment.quantity || 0) + (adjustment.freeQuantity || 0)} {item.unit}</b>
                            {packMultiplier > 1 && <span style={{ opacity: 0.75 }}> ({Math.floor(((adjustment.quantity || 0) + (adjustment.freeQuantity || 0)) / packMultiplier)} Packs)</span>}
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
                                                    setAdjustment(prev => ({ ...prev, freeQuantity: packs * packMultiplier }));
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
                            onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}
                        />
                    </div>

                    {adjustment.type === 'add' && (
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>

                            {/* Checkbox header row */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '14px', userSelect: 'none' }}>
                                <input
                                    type="checkbox"
                                    id="recordExpense"
                                    checked={adjustment.recordAsExpense}
                                    style={{ width: '18px', height: '18px', flexShrink: 0, accentColor: '#22c55e', cursor: 'pointer' }}
                                    onChange={(e) => setAdjustment({
                                        ...adjustment,
                                        recordAsExpense: e.target.checked,
                                        totalCost: e.target.checked ? +(adjustment.quantity * (selectedItem?.costPerUnit || 0)).toFixed(2) : 0
                                    })}
                                />
                                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>💰 Record as Purchase Expenditure</span>
                            </label>

                            {adjustment.recordAsExpense && (
                                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                    {/* Row 1: Invoice + Payment Method — inputs aligned at bottom */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Number</span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Groups in Expenditure</span>
                                            <input
                                                className="inventory-input"
                                                placeholder="e.g. INV-2024-001"
                                                value={adjustment.invoiceNumber}
                                                onChange={(e) => setAdjustment({ ...adjustment, invoiceNumber: e.target.value })}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</span>
                                            <select
                                                className="inventory-input"
                                                value={adjustment.paymentMethod}
                                                onChange={(e) => setAdjustment({ ...adjustment, paymentMethod: e.target.value })}
                                                style={{ margin: 0, marginTop: 'auto' }}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI">UPI / Scanner</option>
                                                <option value="Card">Credit/Debit Card</option>
                                                <option value="Bank">Bank Transfer</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Row 2: Base Cost + GST + Discount */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Base Cost (₹)</span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Paid qty only</span>
                                            <input
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0.00"
                                                value={adjustment.totalCost || ''}
                                                onChange={(e) => setAdjustment({ ...adjustment, totalCost: parseFloat(e.target.value) || 0 })}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GST (%)</span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>&nbsp;</span>
                                            <input
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0"
                                                value={adjustment.gstPercent !== undefined ? adjustment.gstPercent : ''}
                                                onChange={(e) => setAdjustment({ ...adjustment, gstPercent: parseFloat(e.target.value) || 0 })}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discount (₹)</span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>&nbsp;</span>
                                            <input
                                                type="number"
                                                className="inventory-input"
                                                placeholder="0.00"
                                                value={adjustment.discountAmount || ''}
                                                onChange={(e) => setAdjustment({ ...adjustment, discountAmount: parseFloat(e.target.value) || 0 })}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Net total preview */}
                                    <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#4f46e5', fontWeight: '600' }}>
                                        Net Total: ₹{((adjustment.totalCost || 0) + ((adjustment.totalCost || 0) * (adjustment.gstPercent || 0) / 100) - (adjustment.discountAmount || 0)).toFixed(2)}&nbsp;&nbsp;
                                        <span style={{ fontWeight: '400', opacity: 0.8 }}>(GST: ₹{((adjustment.totalCost || 0) * (adjustment.gstPercent || 0) / 100).toFixed(2)})</span>
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
        <div className="stat-item">
            <div className="stat-left">
                <div className="stat-icon-bg" style={{ background: color }}>{icon}</div>
                <label className="stat-label">{label}</label>
            </div>
            <div className="stat-value" style={textStyle}>{value}</div>
        </div>
    );
}

function ActivityLog({ movements, onExport, onClear }) {
    return (
        <div className="activity-section">
            <div className="activity-controls">
                <h2>Audit Log & Item History</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="export-btn" onClick={onExport}>📥 Export CSV</button>
                    <button className="wipe-btn" onClick={onClear}>🗑️ Wipe Activity Log</button>
                </div>
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
