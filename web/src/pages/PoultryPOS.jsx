import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PoultryPOS.css';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getPrinterSettings, printBill as thermalPrintBill } from '../api/printerUtils.js';

export default function PoultryPOS({ printBill }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canOverrideDiscount = user?.role === 'owner' || user?.role === 'manager';

    // ── State ──────────────────────────────────────────────
    const [menuItems, setMenuItems] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [clients, setClients] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [billItems, setBillItems] = useState([]);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState('percentage');
    const [discountLocked, setDiscountLocked] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('CASH');

    const [selectedItem, setSelectedItem] = useState(null);
    const [currentRate, setCurrentRate] = useState(0);
    const [weightInput, setWeightInput] = useState('');
    const [qtyInput, setQtyInput] = useState('');
    const [amountInput, setAmountInput] = useState('');

    // Scale
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleData, setScaleData] = useState(0);
    const [baudRate, setBaudRate] = useState(9600);
    const portRef = useRef(null);
    const readerRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [lastAddedItemId, setLastAddedItemId] = useState(null);
    const [autoFocusTarget, setAutoFocusTarget] = useState('qty'); // 'qty' or 'amount'
    const qtyInputRefs = useRef({});
    const amountInputRefs = useRef({});

    // ── Load data ──────────────────────────────────────────
    const loadData = () => {
        api.get('/menu').then(res => {
            let items = res.data.data?.menuItems || res.data.data?.items || [];
            items = items.map(i => {
                if (i.description && typeof i.description === 'string' && i.description.includes('||META:')) {
                    const [desc, metaStr] = i.description.split('||META:');
                    try {
                        const meta = JSON.parse(metaStr);
                        return {
                            ...i,
                            description: desc,
                            buyingPrice: meta.buy !== undefined ? meta.buy : i.buyingPrice,
                            sellingPrice: meta.sell !== undefined ? meta.sell : i.sellingPrice,
                            quantityType: meta.qty || i.quantityType
                        };
                    } catch (err) { return i; }
                }
                return i;
            });
            setMenuItems(items);
        }).catch(console.error);

        api.get('/inventory').then(res => {
            const data = res.data?.data || res.data || [];
            setInventoryItems(data);
        }).catch(console.error);

        api.get('/customers').then(res => {
            const data = res.data.data || res.data || [];
            const parsed = [];
            for (const c of data) {
                if (c.email && c.email.startsWith('||META:')) {
                    try {
                        const meta = JSON.parse(c.email.replace('||META:', ''));
                        if (meta.isPoultry) {
                            parsed.push({ ...c, address: meta.address, defaultDiscount: meta.defaultDiscount, defaultDiscountType: meta.defaultDiscountType || 'percentage', pendingAmount: meta.pendingAmount, categoryDiscounts: meta.categoryDiscounts || [] });
                        }
                    } catch (e) { /* skip */ }
                }
            }
            const walkin = { _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0, defaultDiscountType: 'percentage', categoryDiscounts: [] };
            setClients([walkin, ...parsed]);
        }).catch(() => {
            const local = localStorage.getItem('poultry_clients');
            const localClients = local ? JSON.parse(local).filter(c => c.isActive !== false) : [];
            const formattedLocal = localClients.map(c => ({
                ...c,
                _id: String(c.id || c._id),
                id: String(c.id || c._id)
            }));
            setClients([{ _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0, defaultDiscountType: 'percentage', categoryDiscounts: [] }, ...formattedLocal]);
        });
    };

    useEffect(() => {
        loadData();
        const intervalId = setInterval(loadData, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // Cleanup scale on unmount
    useEffect(() => {
        return () => { if (scaleConnected) disconnectScale(); };
    }, [scaleConnected]);

    // ── Client selection — auto-apply discount ─────────────
    const handleClientChange = (e) => {
        const cid = e.target.value;
        setSelectedCustomerId(cid);
        const client = clients.find(c => String(c._id || c.id) === cid) || null;
        setSelectedCustomer(client);
        if (client && client.defaultDiscount > 0) {
            setDiscount(client.defaultDiscount);
            setDiscountLocked(!canOverrideDiscount);
        } else {
            setDiscount(0);
            setDiscountLocked(false);
        }
    };

    // ── Scale ──────────────────────────────────────────────
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
                    try { setScaleConnected(true); } catch (e) { }
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

        if (!('serial' in navigator)) {
            alert('Web Serial API not supported. Use Chrome or Edge on desktop.');
            return;
        }
        try {
            if (portRef.current) { try { await portRef.current.close(); } catch (_) { } }
            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate });
            portRef.current = newPort;
            setScaleConnected(true);
            keepReadingRef.current = true;

            const reader = newPort.readable.getReader();
            readerRef.current = reader;
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (keepReadingRef.current) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    if (buffer.includes('\n') || buffer.includes('\r')) {
                        for (const line of buffer.split(/[\r\n]+/)) {
                            const match = line.match(/[-+]?\d*\.?\d+/);
                            if (match) {
                                const val = parseFloat(match[0]);
                                if (!isNaN(val)) setScaleData(Math.abs(val));
                            }
                        }
                        buffer = '';
                    }
                }
            } finally { reader.releaseLock(); }
        } catch (err) {
            console.error('Scale connect error:', err);
            setScaleConnected(false);
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
                try { setScaleConnected(false); } catch (e) { }
            }
            return;
        }

        try { if (readerRef.current) await readerRef.current.cancel(); } catch (_) { }
        try { if (portRef.current) await portRef.current.close(); } catch (_) { }
        portRef.current = null;
        try { setScaleConnected(false); } catch (e) { }
    };

    // ── Item interaction ───────────────────────────────────
    const handleItemClick = (item) => {
        const rate = item.sellingPrice > 0 ? item.sellingPrice : (item.price || 0);

        let catDiscountObj = selectedCustomer?.categoryDiscounts?.find(c => c.category?.toLowerCase() === item?.category?.toLowerCase());
        const isDefaultDiscount = (parseFloat(discount) || 0) === (parseFloat(selectedCustomer?.defaultDiscount) || 0);

        let appliedDiscount = parseFloat(discount) || 0;
        let appliedType = discountType;

        if (isDefaultDiscount && catDiscountObj) {
            appliedDiscount = parseFloat(catDiscountObj.discount) || 0;
            appliedType = catDiscountObj.type;
        }

        const liveRate = appliedType === 'amount' ? +(rate - appliedDiscount).toFixed(2) : +(rate - (rate * appliedDiscount / 100)).toFixed(2);

        const isPiece = item.quantityType && ['pcs', 'piece', 'pieces'].includes(item.quantityType.toLowerCase());

        if (isPiece) {
            addToBill(item, 1, liveRate, item.quantityType || 'pcs', rate);
        } else {
            const weight = scaleConnected ? scaleData : (parseFloat(weightInput) || 0);
            addToBill(item, weight, liveRate, item.quantityType || 'kg', rate);
        }

        setSelectedItem(item);
        setCurrentRate(rate);
        setWeightInput('');
        setQtyInput('');
        setAmountInput('');
    };

    const isPieceSelected = selectedItem?.quantityType && ['pcs', 'piece', 'pieces'].includes(selectedItem.quantityType.toLowerCase());
    const liveWeight = scaleConnected ? scaleData : (parseFloat(weightInput) || 0);
    const liveQty = parseInt(qtyInput) || (isPieceSelected ? 1 : 0);
    const computedQuantity = liveWeight > 0 ? liveWeight : liveQty;
    const computedType = liveWeight > 0 ? 'kg' : (isPieceSelected ? 'pcs' : 'kg');

    // Convert rate by reducing the discount percentage BEFORE adding to bill
    let currentCatDiscountObj = selectedCustomer?.categoryDiscounts?.find(c => c.category?.toLowerCase() === selectedItem?.category?.toLowerCase());
    const isEditingDefaultDiscount = parseFloat(discount) === (parseFloat(selectedCustomer?.defaultDiscount) || 0);

    let activeDisc = parseFloat(discount) || 0;
    let activeType = discountType;
    if (isEditingDefaultDiscount && currentCatDiscountObj) {
        activeDisc = parseFloat(currentCatDiscountObj.discount) || 0;
        activeType = currentCatDiscountObj.type;
    }
    const liveRate = activeType === 'amount' ? +(currentRate - activeDisc).toFixed(2) : +(currentRate - (currentRate * activeDisc / 100)).toFixed(2);
    const liveAmount = selectedItem ? +(liveRate * computedQuantity).toFixed(2) : 0;

    const handleConfirmAdd = () => {
        if (!selectedItem) return;
        if (liveWeight > 0 && liveWeight < 0.001) return alert('Weight too low. Check scale reading.');
        if (computedQuantity <= 0) return alert('Please specify a valid weight or quantity.');
        addToBill(selectedItem, computedQuantity, liveRate, computedType, currentRate);
        setSelectedItem(null);
        setCurrentRate(0);
        setWeightInput('');
        setQtyInput('');
        setAmountInput('');
    };

    const addToBill = (item, quantity, rate, type, baseRate) => {
        const key = item._id || item.id;
        setBillItems(prev => {
            const existing = prev.find(i => i.id === key);
            if (existing) {
                return prev.map(i => i.id === key
                    ? { ...i, qty: +(i.qty + quantity).toFixed(3), rate, baseRate, amount: +((i.qty + quantity) * rate).toFixed(2) }
                    : i
                );
            }
            return [...prev, {
                id: key,
                name: item.name,
                qty: quantity,
                rate,
                baseRate,
                amount: +(quantity * rate).toFixed(2),
                type,
                buyingPrice: item.buyingPrice || 0,
                menuItemId: key,
                category: item.category,
            }];
        });

        if (!scaleConnected) {
            setLastAddedItemId(key);
        }
    };

    // ── Auto focus handler ─────────────────────────────────
    useEffect(() => {
        if (lastAddedItemId && !scaleConnected) {
            setTimeout(() => {
                const targetRefs = autoFocusTarget === 'amount' ? amountInputRefs : qtyInputRefs;
                const el = targetRefs.current[lastAddedItemId];
                if (el) {
                    el.focus();
                    el.select(); // Highlight text so typing overrides the default immediately!
                }
                setLastAddedItemId(null);
            }, 50); // slight delay to allow React to paint the input
        }
    }, [billItems, lastAddedItemId, scaleConnected, autoFocusTarget]);

    // ── Retrospective Cart Rate Syncer ─────────────────────
    useEffect(() => {
        setBillItems(prev => {
            let changed = false;
            const updated = prev.map(item => {
                if (item.baseRate !== undefined) {
                    let activeCartDisc = parseFloat(discount) || 0;
                    let activeCartType = discountType;

                    const isCartDefaultDiscount = (parseFloat(discount) || 0) === (parseFloat(selectedCustomer?.defaultDiscount) || 0);
                    if (isCartDefaultDiscount) {
                        const catDiscountObj = selectedCustomer?.categoryDiscounts?.find(c => c.category?.toLowerCase() === item.category?.toLowerCase());
                        if (catDiscountObj) {
                            activeCartDisc = parseFloat(catDiscountObj.discount) || 0;
                            activeCartType = catDiscountObj.type;
                        }
                    }

                    const newRate = activeCartType === 'amount' ? +(item.baseRate - activeCartDisc).toFixed(2) : +(item.baseRate - (item.baseRate * activeCartDisc / 100)).toFixed(2);
                    if (newRate !== item.rate) {
                        changed = true;
                        return { ...item, rate: newRate, amount: +(newRate * item.qty).toFixed(2) };
                    }
                }
                return item;
            });
            return changed ? updated : prev;
        });
    }, [discount, discountType, selectedCustomer]);

    const updateBillItemQty = (id, delta) => {
        setBillItems(prev => {
            return prev.map(i => {
                if (i.id === id) {
                    const currentQty = parseFloat(i.qty) || 0;
                    const newQty = currentQty + delta;
                    if (newQty <= 0) return i;
                    return {
                        ...i,
                        qty: +(newQty).toFixed(3),
                        amount: +(newQty * i.rate).toFixed(2)
                    };
                }
                return i;
            });
        });
    };

    const handleCartItemChange = (id, field, valueStr) => {
        setBillItems(prev => prev.map(i => {
            if (i.id !== id) return i;

            // Allow empty string to facilitate typing
            if (valueStr === '') {
                if (field === 'qty') return { ...i, qty: '', amount: 0 };
                if (field === 'amount') return { ...i, amount: '', qty: 0 };
            }

            const val = parseFloat(valueStr);
            if (field === 'qty') {
                const safeQty = isNaN(val) ? 0 : val;
                return { ...i, qty: valueStr, amount: +(safeQty * i.rate).toFixed(2) };
            } else if (field === 'amount') {
                const safeAmt = isNaN(val) ? 0 : val;
                const derivedQty = i.rate > 0 ? (safeAmt / i.rate) : 0;
                const isPiece = i.type && ['pcs', 'piece', 'pieces'].includes(i.type.toLowerCase());
                const finalQty = isPiece ? Math.round(derivedQty) : parseFloat(derivedQty.toFixed(3));
                return { ...i, qty: finalQty, amount: valueStr };
            }
            return i;
        }));
    };

    const removeBillItem = (id) => setBillItems(prev => prev.filter(i => i.id !== id));

    const subtotal = billItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
    const discountAmt = 0; // Discount is now baked directly into the item rates immediately!
    const total = subtotal;

    // ── Generate Bill ──────────────────────────────────────
    const handleGenerateBill = async () => {
        if (billItems.length === 0) return alert('Bill is empty!');
        setSaving(true);
        const realClientId = selectedCustomer && selectedCustomer.id !== 'walkin' ? (selectedCustomer._id || selectedCustomer.id) : null;
        let customNotes = '';
        if (realClientId) {
            customNotes = `||CLIENTID:${realClientId}||||CLIENTNAME:${selectedCustomer.name}||`;
        }

        let savedBillId = null;
        let savedBillNumber = null;

        // Failsafe IDs since the dedicated server route doesn't exist
        if (!savedBillId) savedBillId = `OFFLINE-${Date.now()}`;
        if (!savedBillNumber) {
            let seq = parseInt(localStorage.getItem('poultry_bill_sequence') || '1', 10);
            const zeroPad = String(seq).padStart(5, '0');
            savedBillNumber = `PLT-${zeroPad}`;
            localStorage.setItem('poultry_bill_sequence', seq + 1);
        }

        customNotes += `||BILLNO:${savedBillNumber}||`;

        const billData = {
            // BACKEND CRASH WORKAROUND: If we send clientId, Java tries to hit the non-existent poultry_clients table.
            clientId: null,
            _realClientId: realClientId, // Keep for frontend use (stripped by Java API, or ignored)
            notes: customNotes,
            items: billItems.map(i => ({
                menuItemId: i.menuItemId,
                itemName: i.name,
                quantity: parseFloat(i.qty) || 0,
                quantityType: i.type,
                rate: i.rate,
                buyingPrice: i.buyingPrice,
                amount: parseFloat(i.amount) || 0,
                category: i.category,
            })),
            subtotal,
            discountAmount: discountAmt,
            total,
            paymentMethod,
            paymentStatus: paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID',
        };

        // GLOBAL SYNC WORKAROUND: Push bill to generic /orders endpoint so it appears in the primary #/orders History page
        try {
            const genericPayload = {
                tableNumber: null,
                source: 'poultry',
                orderType: 'takeaway',
                billNumber: savedBillNumber,
                orderNumber: savedBillNumber,
                status: 'PAID',
                paymentStatus: billData.paymentStatus,
                paymentMethod: billData.paymentMethod,
                customerName: billData.partyName || 'Walk-in',
                customerPhone: billData.partyPhone || undefined,
                subtotal: billData.subtotal,
                total: billData.total,
                discount: billData.discountAmount,
                discountType: billData.discountType,
                discountValue: billData.discountValue,
                discountAmount: billData.discountAmount,
                notes: customNotes,
                items: billItems.map(i => {
                    const matchedCat = (i.category || '').trim().toLowerCase();
                    const invItem = inventoryItems.find(inv =>
                        (inv.category || '').trim().toLowerCase() === matchedCat ||
                        (inv.name || '').trim().toLowerCase() === matchedCat
                    );
                    return {
                        menuItemId: i.menuItemId,
                        name: i.name,
                        price: i.rate,
                        quantity: parseFloat(i.qty) || 0,
                        notes: `Weight: ${i.qty}${i.type} @ ${i.rate}`,
                        category: i.category,
                        inventoryItemId: invItem ? invItem._id || invItem.id : undefined,
                        taxRate: 0
                    };
                })
            };
            // Fire and forget - absolute fast JS response. Do not block thread waiting for Java server.
            api.post('/orders', genericPayload).catch(err => {
                console.warn('Failed to sync poultry bill to global orders module natively', err);
            });
        } catch (err) {
            console.warn('Failed generic payload creation', err);
        }

        // SYNCHRONIZATION WORKAROUND: Update generic Customer table manually (must happen independently of the bill API success!)
        if (billData._realClientId) {
            try {
                const cRes = await api.get(`/customers/${billData._realClientId}`);
                const cData = cRes.data?.data || cRes.data;
                let meta = {};
                if (cData.email && cData.email.startsWith('||META:')) {
                    try { meta = JSON.parse(cData.email.replace('||META:', '')); } catch (e) { }
                }
                meta.totalPurchase = (meta.totalPurchase || 0) + billData.total;
                if (billData.paymentStatus === 'PENDING') {
                    meta.pendingAmount = (meta.pendingAmount || 0) + billData.total;
                } else {
                    meta.paidAmount = (meta.paidAmount || 0) + billData.total;
                }

                await api.post(`/customers`, {
                    name: cData.name,
                    phone: cData.phone,
                    email: '||META:' + JSON.stringify(meta)
                });
            } catch (err) {
                console.log('Failed to update client meta totals', err);
            }
        }

        // Push to local offline history cache so it is immediately visible in the History page
        try {
            const raw = localStorage.getItem('poultry_history_bills');
            const history = raw ? JSON.parse(raw) : [];
            const constructedOfflineBill = {
                _id: savedBillId,
                id: savedBillId,
                billNumber: savedBillNumber,
                client: billData._realClientId ? { id: billData._realClientId, name: selectedCustomer?.name } : null,
                clientName: selectedCustomer?.name || 'Walk-in',
                items: billData.items,
                subtotal: billData.subtotal,
                discount: billData.discountAmount,
                total: billData.total,
                grandTotal: billData.total,
                paymentMethod: billData.paymentMethod,
                status: billData.paymentStatus,
                notes: billData.notes,
                createdAt: new Date().toISOString()
            };
            history.unshift(constructedOfflineBill);
            localStorage.setItem('poultry_history_bills', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to append to local history', e);
        }

        if (printBill) {
            // Map poultry items to the standard print format expected by printBill
            const printItems = billItems.map(i => ({
                name: i.name,
                // Display quantity with unit (e.g. "1.250 kg" or "3 pcs")
                quantity: parseFloat(i.qty) || 0,
                quantityDisplay: i.type && ['pcs', 'piece', 'pieces'].includes(i.type.toLowerCase())
                    ? `${i.qty} ${i.type}`
                    : `${i.qty} kg`,
                price: i.rate,
                amount: parseFloat(i.amount) || 0,
                type: i.type,
            }));

            const printOrder = {
                // _id is required by printBill to avoid early return
                _id: savedBillId || `POULTRY-${Date.now()}`,
                billNumber: savedBillNumber || `PLT-${Date.now()}`,
                orderNumber: savedBillNumber || `PLT-${Date.now()}`,
                items: printItems,
                subtotal,
                total,
                grandTotal: total,
                paymentMethod,
                customerName: selectedCustomer?.name || 'Walk-in',
                tableNumber: 'Poultry',
                source: 'poultry',
                createdAt: new Date().toISOString(),
                skipKOT: true, // No kitchen copy for poultry
                printWithGst: false, // Poultry bills don't have GST breakdown
            };

            printBill(printOrder, true, false, 'en');

            // Native explicit thermal print (USB / Bluetooth / iMin)
            const printerSettings = getPrinterSettings();
            if (printerSettings.connectionType && printerSettings.connectionType !== 'network') {
                thermalPrintBill(printOrder, { connectionType: printerSettings.connectionType });
            }
        } else {
            alert('✅ Bill generated successfully!');
        }

        setBillItems([]);
        setDiscount(selectedCustomer?.defaultDiscount || 0);
        setSaving(false);
    };

    return (
        <div className="poultry-pos-container">
            <div className="poultry-main">

                {/* ── LEFT: MENU GRID + INPUT BAR ── */}
                <div className="poultry-left-panel">

                    {/* Product Grid */}
                    <div className="product-grid">
                        {menuItems.map(item => (
                            <button
                                key={item._id || item.id}
                                className={`product-btn ${selectedItem?._id === item._id ? 'selected' : ''}`}
                                onClick={() => handleItemClick(item)}
                            >
                                {item.image_url && (
                                    <img src={item.image_url} alt={item.name}
                                        style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '7px' }} />
                                )}
                                <span className="product-name">{item.name}</span>
                                {item.sellingPrice > 0 && (
                                    <span className="product-price-label">
                                        ₹{item.sellingPrice}/{item.quantityType || 'kg'}
                                    </span>
                                )}
                            </button>
                        ))}
                        {menuItems.length === 0 && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍗</div>
                                No items found. Add items from the Menu page.
                            </div>
                        )}
                    </div>

                    {/* Bottom Input Strip */}
                    <div className="rates-inputs-panel">
                        <div className="rates-panel-header">

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '5px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button
                                        onClick={() => setAutoFocusTarget('qty')}
                                        style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: 'none', background: autoFocusTarget === 'qty' ? '#10b981' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                                        Cursor: QTY
                                    </button>
                                    <button
                                        onClick={() => setAutoFocusTarget('amount')}
                                        style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: 'none', background: autoFocusTarget === 'amount' ? '#10b981' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                                        AMT
                                    </button>
                                </div>
                                {scaleConnected && (
                                    <select
                                        value={baudRate}
                                        onChange={e => setBaudRate(parseInt(e.target.value))}
                                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontSize: '11px' }}
                                        title="Baud Rate"
                                    >
                                        <option value="2400">2400</option>
                                        <option value="4800">4800</option>
                                        <option value="9600">9600</option>
                                    </select>
                                )}
                                <button
                                    className={`usb-scale-btn ${scaleConnected ? 'connected' : ''}`}
                                    onClick={scaleConnected ? disconnectScale : connectScale}
                                >
                                    <span>🔌</span>
                                    <span>{scaleConnected ? `Scale ● ${scaleData} kg` : 'USB Scale'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="rate-inputs-row">
                            <div className="pos-field" style={{ width: '82px' }}>
                                <label>Rate (kg / pc)</label>
                                <input type="number" value={currentRate}
                                    onChange={e => setCurrentRate(e.target.value)}
                                    placeholder="0" />
                            </div>

                            <div className="pos-field" style={{ width: '80px' }}>
                                <label>Weight (kg)</label>
                                <input
                                    type="number" step="0.001" placeholder="0.000"
                                    value={scaleConnected ? scaleData : weightInput}
                                    onChange={e => {
                                        setWeightInput(e.target.value);
                                        setAmountInput('');
                                    }}
                                    readOnly={scaleConnected}
                                    className={scaleConnected ? 'scale-active' : ''}
                                />
                            </div>

                            <div className="pos-field" style={{ width: '62px' }}>
                                <label>Qty (Nos)</label>
                                <input type="number" placeholder="0" value={qtyInput}
                                    onChange={e => {
                                        setQtyInput(e.target.value);
                                        setAmountInput('');
                                    }}
                                    disabled={scaleConnected || liveWeight > 0} />
                            </div>

                            <div className="pos-divider" />

                            <div className="pos-amount-display">
                                <label>Final Item Rate</label>
                                <div className="amount-value" style={{ fontSize: '15px' }}>₹{liveRate.toFixed(2)}</div>
                            </div>

                            <div className="pos-field" style={{ width: '90px' }}>
                                <label>Item Amount</label>
                                <input
                                    type="number" step="0.01" placeholder="0.00"
                                    value={amountInput !== '' ? amountInput : (liveAmount > 0 ? liveAmount.toFixed(2) : '')}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setAmountInput(val);
                                        const amt = parseFloat(val);
                                        if (!isNaN(amt) && amt >= 0 && liveRate > 0) {
                                            const derivedQty = amt / liveRate;
                                            if (isPieceSelected) {
                                                setQtyInput(Math.round(derivedQty).toString());
                                                setWeightInput('');
                                            } else {
                                                setWeightInput(parseFloat(derivedQty.toFixed(3)).toString());
                                                setQtyInput('');
                                            }
                                        } else if (val === '') {
                                            setWeightInput('');
                                            setQtyInput('');
                                        }
                                    }}
                                    disabled={!selectedItem || scaleConnected}
                                    style={{ fontWeight: 'bold' }}
                                />
                            </div>

                            <div className="pos-field" style={{ width: '100px' }}>
                                <label>Discount</label>
                                <div className="discount-group">
                                    <input type="number" min="0" max="100" step="0.5"
                                        value={discount}
                                        onChange={e => !discountLocked && setDiscount(e.target.value)}
                                        readOnly={discountLocked}
                                        style={discountLocked ? { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.35)', width: '55px' } : { width: '55px' }}
                                    />
                                    <span className="pct">%</span>
                                    {discountLocked && <span className="lock-icon" title="Manager/Owner can override">🔒</span>}
                                    {canOverrideDiscount && discountLocked && (
                                        <button className="override-btn" onClick={() => setDiscountLocked(false)}>Unlock</button>
                                    )}
                                </div>
                            </div>

                            <div className="pos-divider" />

                            <div className="pos-total-display">
                                <label>Bill Total</label>
                                <div className="total-value">₹{total.toFixed(2)}</div>
                            </div>

                            <button
                                className="poultry-add-btn"
                                onClick={handleConfirmAdd}
                                disabled={!selectedItem}
                            >
                                + ADD
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: BILL PANEL ── */}
                <div className="poultry-right-panel">

                    {/* Client Selector */}
                    <div className="client-selector-area">
                        <select value={selectedCustomerId} onChange={handleClientChange}>
                            <option value="">👤 Walk-in Customer</option>
                            {clients.filter(c => c.id !== 'walkin').map(c => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        {selectedCustomer && selectedCustomer.id !== 'walkin' && (
                            <div className="client-badge">
                                <span className="c-name">👤 {selectedCustomer.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Bill Table */}
                    <div className="bill-table-container">
                        <table className="bill-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty/Wt</th>
                                    <th>Rate</th>
                                    <th>Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {billItems.map(item => {
                                    const isPiece = item.type && ['pcs', 'piece', 'pieces'].includes(item.type.toLowerCase());
                                    return (
                                        <tr key={item.id}>
                                            <td>{item.name}</td>
                                            <td>
                                                {isPiece ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); if (parseFloat(item.qty) > 1) updateBillItemQty(item.id, -1); }}
                                                            style={{ width: '24px', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(128, 128, 128, 0.2)', border: 'none', color: 'inherit', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
                                                        >-</button>
                                                        <input
                                                            ref={el => (qtyInputRefs.current[item.id] = el)}
                                                            type="number"
                                                            value={item.qty === 0 ? '' : item.qty}
                                                            onChange={(e) => handleCartItemChange(item.id, 'qty', e.target.value)}
                                                            readOnly={scaleConnected}
                                                            className="inline-cart-input"
                                                            style={{ width: '45px', textAlign: 'center', border: '1px solid #d1d5db', background: scaleConnected ? '#f3f4f6' : '#fff', color: scaleConnected ? '#9ca3af' : '#1f2937', padding: '4px 2px', borderRadius: '4px', fontWeight: '600', outline: 'none' }}
                                                        />
                                                        <span>{item.type}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateBillItemQty(item.id, 1); }}
                                                            style={{ width: '24px', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(128, 128, 128, 0.2)', border: 'none', color: 'inherit', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
                                                        >+</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input
                                                            ref={el => (qtyInputRefs.current[item.id] = el)}
                                                            type="number"
                                                            step="0.001"
                                                            value={item.qty === 0 ? '' : item.qty}
                                                            onChange={(e) => handleCartItemChange(item.id, 'qty', e.target.value)}
                                                            readOnly={scaleConnected}
                                                            placeholder="0.000"
                                                            className="inline-cart-input"
                                                            style={{ width: '60px', textAlign: 'center', border: '1px solid #d1d5db', background: scaleConnected ? '#f3f4f6' : '#fff', color: scaleConnected ? '#9ca3af' : '#1f2937', padding: '4px 2px', borderRadius: '4px', fontWeight: '600', outline: 'none', transition: 'all 0.2s' }}
                                                        />
                                                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{item.type}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>₹{item.rate}</td>
                                            <td style={{ fontWeight: 700 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>₹</span>
                                                    <input
                                                        ref={el => (amountInputRefs.current[item.id] = el)}
                                                        type="number"
                                                        step="0.01"
                                                        value={item.amount === 0 ? '' : item.amount}
                                                        onChange={(e) => handleCartItemChange(item.id, 'amount', e.target.value)}
                                                        readOnly={scaleConnected}
                                                        placeholder="0.00"
                                                        className="inline-cart-input"
                                                        style={{ width: '70px', border: '1px solid #d1d5db', background: scaleConnected ? '#f3f4f6' : '#fff', color: scaleConnected ? '#9ca3af' : '#1f2937', padding: '4px 6px', borderRadius: '4px', fontWeight: '600', outline: 'none', transition: 'all 0.2s' }}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <button className="del-btn" onClick={() => removeBillItem(item.id)}>✕</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {billItems.length === 0 && (
                                    <tr>
                                        <td colSpan="5">
                                            <div className="empty-bill">
                                                <div className="empty-bill-icon">🧾</div>
                                                No items added yet
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    {billItems.length > 0 && (
                        <div className="bill-totals">
                            <div className="totals-row total-row">
                                <span>Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Payment Methods */}
                    <div className="payment-methods">
                        {['CASH', 'UPI', 'CARD', 'CREDIT'].map(method => (
                            <button
                                key={method}
                                className={`pay-btn ${paymentMethod === method ? 'active' : ''}`}
                                onClick={() => setPaymentMethod(method)}
                            >
                                {method}
                            </button>
                        ))}
                    </div>

                    {/* Generate Bill */}
                    <button
                        className="generate-btn"
                        onClick={handleGenerateBill}
                        disabled={saving || billItems.length === 0}
                    >
                        {saving ? '⏳ Saving…' : '✓ Generate Bill'}
                    </button>
                </div>

            </div>
        </div>
    );
}
