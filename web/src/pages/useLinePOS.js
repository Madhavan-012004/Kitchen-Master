import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client.js';
import { cacheMasterData, getCachedMasterData, saveOfflineOrder } from '../services/OfflineSyncService.js';
import { getVehicleLocations, getItemLocationStock, getAssignedVehicle, getAssignedLocations, deductVehicleStock } from '../services/vehicleLocationService.js';
import { generateBillNumber, attachBillerMetaToPayload } from '../utils/billNumberUtils.js';

// ── Default locations if none configured ────────────────────────────────────
const LS_LOCATIONS_KEY = 'linePOSLocations';
const LS_VIEW_KEY = 'linePosView';

export function getLinePOSLocations() {
    try {
        const vehicleLocs = getVehicleLocations();
        return Array.from(new Set(['All', ...vehicleLocs]));
    } catch (_) { }
    return ['All', 'Godown', 'Vehicle 1', 'Vehicle 2'];
}

export function setLinePOSLocations(locs) {
    localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(locs.filter(l => l !== 'All')));
}

export function getLinePOSView() {
    return localStorage.getItem(LS_VIEW_KEY) || 'web';
}

const LS_DIS_SEQ_KEY = 'dis_pos_bill_seq';

export function syncDisBillSequence(orders = []) {
    let maxSeq = 0;
    try {
        const raw = localStorage.getItem(LS_DIS_SEQ_KEY);
        if (raw) maxSeq = (parseInt(raw, 10) || 1) - 1;

        for (const o of orders) {
            const num = o.billNumber || o.billNo || o.orderNumber || '';
            const match = num.match(/DIS(\d+)/i) || (o.notes && o.notes.match(/DIS(\d+)/i));
            if (match && match[1]) {
                const val = parseInt(match[1], 10);
                if (val > maxSeq) maxSeq = val;
            }
        }
        localStorage.setItem(LS_DIS_SEQ_KEY, String(maxSeq + 1));
    } catch (_) { }
}

export function getNextDisBillNumber() {
    let nextSeq = 1;
    try {
        const raw = localStorage.getItem(LS_DIS_SEQ_KEY);
        if (raw) nextSeq = parseInt(raw, 10) || 1;
    } catch (_) { }

    const formatted = `DIS${String(nextSeq).padStart(5, '0')}`;
    try {
        localStorage.setItem(LS_DIS_SEQ_KEY, String(nextSeq + 1));
    } catch (_) { }
    return formatted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility to compute a distinct, unique bill number for display
// ─────────────────────────────────────────────────────────────────────────────
export function getDisplayBillNumber(order, historyArray = []) {
    if (!order) return '';

    // 1. Check notes for ||BILLNO:XXXX||
    if (order.notes && typeof order.notes === 'string') {
        const bMatch = order.notes.match(/\|\|BILLNO:([^|]+)\|\|/);
        if (bMatch && bMatch[1]) return bMatch[1];
    }

    // 2. Check explicit billNumber or billNo field if present and custom
    if (order.billNumber && !order.billNumber.startsWith('ORD000')) return order.billNumber;
    if (order.billNo && !order.billNo.startsWith('ORD000')) return order.billNo;

    // 3. Raw number candidate
    const rawNum = order.billNumber || order.billNo || order.orderNumber;

    // 4. Disambiguate duplicate numbers (e.g. ORD0002) in history list
    if (rawNum && Array.isArray(historyArray) && historyArray.length > 0) {
        const matches = historyArray.filter(o =>
            o.billNumber === rawNum || o.orderNumber === rawNum || o.billNo === rawNum
        );
        if (matches.length > 1) {
            const idx = matches.findIndex(o =>
                (o._id && order._id && o._id === order._id) ||
                (o.id && order.id && o.id === order.id) ||
                o === order
            );
            if (idx !== -1) {
                return `${rawNum}-${matches.length - idx}`;
            }
            const shortId = String(order._id || order.id || '').slice(-4).toUpperCase();
            return shortId ? `${rawNum} (#${shortId})` : rawNum;
        }
    }

    if (rawNum) return rawNum;

    // 5. Fallback using ID slice
    const fallbackId = String(order._id || order.id || '').slice(-6).toUpperCase();
    return fallbackId ? `LP-${fallbackId}` : 'LP-BILL';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────
export default function useLinePOS() {
    // ── Shops/Customers ───────────────────────────────────────────────────────
    const [shops, setShops] = useState([]);
    const [shopSearch, setShopSearch] = useState('');
    const [selectedShop, setSelectedShop] = useState(null);
    const [shopsLoading, setShopsLoading] = useState(false);

    // ── Inventory ─────────────────────────────────────────────────────────────
    const [inventory, setInventory] = useState([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedLocation, setSelectedLocation] = useState('All');
    const [locations, setLocations] = useState(getLinePOSLocations);

    // ── Cart ──────────────────────────────────────────────────────────────────
    const [cart, setCart] = useState([]);
    const prevShopRef = useRef(selectedShop);

    // Automatically clear cart when selected shop changes or is unselected
    useEffect(() => {
        const prevId = prevShopRef.current ? (prevShopRef.current.id || prevShopRef.current._id) : null;
        const currentId = selectedShop ? (selectedShop.id || selectedShop._id) : null;
        if (prevId !== currentId) {
            setCart([]);
            setDiscount(0);
            setBillResult(null);
        }
        prevShopRef.current = selectedShop;
    }, [selectedShop]);

    // ── Purchase History ──────────────────────────────────────────────────────
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // ── Billing ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [discount, setDiscount] = useState(0);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billResult, setBillResult] = useState(null);
    const [toast, setToast] = useState(null);

    // ── New Customer Modal ────────────────────────────────────────────────────
    const [showAddShop, setShowAddShop] = useState(false);
    const [newShop, setNewShop] = useState({ name: '', phone: '', area: '' });

    // ─────────────────────────────────────────────────────────────────────────
    // Toast helper
    // ─────────────────────────────────────────────────────────────────────────
    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Load shops
    // ─────────────────────────────────────────────────────────────────────────
    const loadShops = useCallback(async () => {
        setShopsLoading(true);
        try {
            const res = await api.get('/customers');
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setShops(data);
            cacheMasterData('CUSTOMERS', data);
        } catch (_) {
            const cached = getCachedMasterData('CUSTOMERS');
            if (cached) {
                setShops(cached);
            } else {
                showToast('error', 'Failed to load shops');
            }
        } finally {
            setShopsLoading(false);
        }
    }, [showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // Load inventory
    // ─────────────────────────────────────────────────────────────────────────
    const loadInventory = useCallback(async () => {
        setInventoryLoading(true);
        try {
            const res = await api.get('/inventory');
            const items = res.data?.data?.items || res.data?.items || [];
            setInventory(items);
            cacheMasterData('INVENTORY', items);
        } catch (_) {
            const cached = getCachedMasterData('INVENTORY');
            if (cached) {
                setInventory(cached);
            } else {
                showToast('error', 'Failed to load inventory');
            }
        } finally {
            setInventoryLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadShops();
        loadInventory();
    }, [loadShops, loadInventory]);

    // ─────────────────────────────────────────────────────────────────────────
    // Load purchase history for selected shop
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!selectedShop) { setPurchaseHistory([]); return; }
        let cancelled = false;
        setHistoryLoading(true);

        const shopPhone = (selectedShop.phone || selectedShop.mobile || selectedShop.phoneNumber || '').toLowerCase().trim();
        const shopName = (selectedShop.name || '').toLowerCase().trim();
        const shopId = selectedShop.id || selectedShop._id;

        api.get('/orders/history', {
            params: { status: 'All', limit: 100 }
        }).then(res => {
            if (cancelled) return;
            const rawOrders = res.data?.data?.orders || [];

            // Filter strictly for selected shop/customer
            const filtered = rawOrders.filter(o => {
                const cPhone = (o.customerPhone || '').toLowerCase().trim();
                const cName = (o.customerName || '').toLowerCase().trim();
                const notes = (o.notes || '').toLowerCase();
                const tableNo = (o.tableNumber || '').toLowerCase();

                if (shopPhone && cPhone && cPhone.includes(shopPhone)) return true;
                if (shopName && cName && cName.includes(shopName)) return true;
                if (shopPhone && notes.includes(shopPhone)) return true;
                if (shopName && notes.includes(shopName)) return true;
                if (shopId && tableNo.includes(String(shopId).toLowerCase())) return true;
                return false;
            });

            syncDisBillSequence(rawOrders);
            setPurchaseHistory(filtered);
        }).catch(() => {
            if (!cancelled) setPurchaseHistory([]);
        }).finally(() => {
            if (!cancelled) setHistoryLoading(false);
        });
        return () => { cancelled = true; };
    }, [selectedShop]);

    // ─────────────────────────────────────────────────────────────────────────
    // ── Derived: filtered shops (3-way search: Name, Phone, Area) ────────────
    const filteredShops = shops.filter(s => {
        if (!shopSearch) return true;
        const q = shopSearch.toLowerCase().trim();
        if (!q) return true;

        const nameStr = (s.name || '').toLowerCase();
        const phoneStr = (s.phone || s.mobile || s.phoneNumber || '').toLowerCase();

        // Extract area from s.area, s.address, s.location, s.city, or email encoded area ("area:Chennai")
        let areaStr = (s.area || s.address || s.location || s.city || '').toLowerCase();
        if (s.email && s.email.toLowerCase().startsWith('area:')) {
            areaStr += ' ' + s.email.toLowerCase().replace('area:', '').trim();
        } else if (s.email) {
            areaStr += ' ' + s.email.toLowerCase();
        }

        return nameStr.includes(q) || phoneStr.includes(q) || areaStr.includes(q);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Derived: categories from inventory
    // ─────────────────────────────────────────────────────────────────────────
    const categories = ['All', ...Array.from(new Set(inventory.map(i => i.category || 'General').filter(Boolean)))];

    // ─────────────────────────────────────────────────────────────────────────
    // Auto-default selectedLocation based on logged-in employee's allocated location
    useEffect(() => {
        try {
            const userObj = JSON.parse(localStorage.getItem('km_user') || '{}');
            if (userObj && (userObj.role === 'biller' || userObj.role === 'waiter' || userObj.role === 'inventory')) {
                const assignedLoc = getAssignedVehicle(userObj);
                if (assignedLoc && assignedLoc !== 'Godown') {
                    setSelectedLocation(assignedLoc);
                }
            }
        } catch (_) { }
    }, []);

    const getItemLocation = (item) => {
        try {
            if (item.linePosLocation) return item.linePosLocation;
            if (item.notes) {
                const parsed = JSON.parse(item.notes);
                return parsed.linePosLocation || 'Godown';
            }
        } catch (_) { }
        return 'Godown';
    };

    const filteredInventory = inventory.filter(item => {
        const catOk = selectedCategory === 'All' || item.category === selectedCategory;
        const locStockMap = getItemLocationStock(item);
        const hasLocStock = selectedLocation === 'All' || (locStockMap && locStockMap[selectedLocation] !== undefined ? parseFloat(locStockMap[selectedLocation]) > 0 : (selectedLocation === 'Godown' ? parseFloat(item.currentStock || 0) > 0 : false));
        const locOk = selectedLocation === 'All' || getItemLocation(item) === selectedLocation || hasLocStock;
        return catOk && locOk;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Frequent/last purchase items derived from history
    // ─────────────────────────────────────────────────────────────────────────
    const frequentItems = (() => {
        const countMap = {};
        purchaseHistory.forEach(order => {
            (order.items || order.orderItems || []).forEach(item => {
                const name = item.name || item.itemName;
                if (!name) return;
                countMap[name] = (countMap[name] || 0) + 1;
            });
        });
        return Object.entries(countMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count }));
    })();

    const lastOrder = purchaseHistory[0] || null;

    // ─────────────────────────────────────────────────────────────────────────
    // Customer Custom Price Storage & Auto-Lookup Helpers
    // ─────────────────────────────────────────────────────────────────────────
    const CUSTOMER_PRICES_KEY = 'km_customer_item_prices';

    function getSavedCustomerPrices() {
        try {
            const raw = localStorage.getItem(CUSTOMER_PRICES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomerPrice(shopId, itemName, price) {
        if (!shopId || !itemName) return;
        try {
            const map = getSavedCustomerPrices();
            if (!map[shopId]) map[shopId] = {};
            map[shopId][String(itemName).toLowerCase()] = Number(price);
            localStorage.setItem(CUSTOMER_PRICES_KEY, JSON.stringify(map));
        } catch (e) {
            console.warn('Failed to save customer item price:', e);
        }
    }

    function getCustomerItemPrice(shopId, item, purchaseHistory = []) {
        if (!item) return 0;
        const stdPrice = Number(item.salePrice ?? item.price ?? item.costPrice ?? 0);
        const itemName = item.name;
        if (!shopId || !itemName) return stdPrice;

        // 1. Check saved customer price map
        const map = getSavedCustomerPrices();
        const shopMap = map[shopId];
        if (shopMap && shopMap[String(itemName).toLowerCase()] != null) {
            return shopMap[String(itemName).toLowerCase()];
        }

        // 2. Check purchase history for this shop
        for (const order of purchaseHistory) {
            const lineItems = order.items || order.orderItems || [];
            for (const line of lineItems) {
                const lName = line.name || line.itemName;
                if (lName && String(lName).toLowerCase() === String(itemName).toLowerCase()) {
                    const hPrice = Number(line.price ?? line.unitPrice ?? 0);
                    if (hPrice > 0) return hPrice;
                }
            }
        }

        return stdPrice;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cart operations
    // ─────────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    // Cart operations
    // ─────────────────────────────────────────────────────────────────────────
    const addToCart = useCallback((item, targetType = 'SALE') => {
        if (!item) return;
        const itemId = item.id ?? item._id ?? item.itemId ?? item.name;
        const itemName = item.name;
        const shopId = selectedShop?.id || selectedShop?._id;
        const stdPrice = Number(item.salePrice ?? item.price ?? item.costPrice ?? 0);
        const resolvedPrice = getCustomerItemPrice(shopId, item, purchaseHistory);
        const initialPrice = targetType === 'FREE' ? 0 : resolvedPrice;

        setCart(prev => {
            const existing = prev.find(c => {
                const cType = c.itemType || (c.isReturn ? 'RETURN' : c.isFree ? 'FREE' : 'SALE');
                const sameId = (itemId != null && c.itemId != null && String(c.itemId) === String(itemId)) ||
                    (itemName != null && c.name === itemName);
                return sameId && cType === targetType;
            });

            if (existing) {
                return prev.map(c => c.cartId === existing.cartId
                    ? { ...c, qty: c.qty + 1 }
                    : c
                );
            }

            return [...prev, {
                cartId: Date.now() + Math.random(),
                itemId: itemId,
                name: item.name || 'Unnamed Item',
                standardPrice: stdPrice,
                savedPrice: resolvedPrice,
                price: initialPrice,
                qty: 1,
                unit: item.unit || 'pcs',
                image: item.image || null,
                itemType: targetType, // 'SALE' | 'RETURN' | 'FREE'
                isReturn: targetType === 'RETURN',
                isFree: targetType === 'FREE',
            }];
        });
    }, [selectedShop, purchaseHistory]);

    const addSpecificCartLine = useCallback((item, type) => {
        addToCart(item, type);
    }, [addToCart]);

    const updateItemType = useCallback((cartId, newType) => {
        setCart(prev => prev.map(c => {
            if (c.cartId === cartId) {
                const isRet = newType === 'RETURN';
                const isFr = newType === 'FREE';
                const restoredPrice = isFr ? 0 : (c.price > 0 ? c.price : (c.savedPrice || c.standardPrice || 0));
                return {
                    ...c,
                    itemType: newType,
                    isReturn: isRet,
                    isFree: isFr,
                    price: restoredPrice,
                };
            }
            return c;
        }));
    }, []);

    const updateUnitPrice = useCallback((cartId, newPrice) => {
        const numPrice = Math.max(0, Number(newPrice) || 0);
        setCart(prev => prev.map(c => {
            if (c.cartId === cartId) {
                const updated = { ...c, price: numPrice, savedPrice: numPrice > 0 ? numPrice : c.savedPrice };
                if (selectedShop && numPrice > 0 && c.itemType !== 'FREE') {
                    const shopId = selectedShop.id || selectedShop._id;
                    saveCustomerPrice(shopId, c.name, numPrice);
                }
                return updated;
            }
            return c;
        }));
    }, [selectedShop]);

    const updateQty = useCallback((cartId, qty) => {
        if (qty <= 0) {
            setCart(prev => prev.filter(c => c.cartId !== cartId));
            return;
        }
        setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, qty } : c));
    }, []);

    const toggleReturn = useCallback((cartId) => {
        setCart(prev => prev.map(c => {
            if (c.cartId === cartId) {
                const currentType = c.itemType || (c.isReturn ? 'RETURN' : 'SALE');
                const nextType = currentType === 'RETURN' ? 'SALE' : 'RETURN';
                return {
                    ...c,
                    itemType: nextType,
                    isReturn: nextType === 'RETURN',
                    isFree: false,
                    price: c.price > 0 ? c.price : (c.savedPrice || c.standardPrice || 0),
                };
            }
            return c;
        }));
    }, []);

    const removeFromCart = useCallback((cartId) => {
        setCart(prev => prev.filter(c => c.cartId !== cartId));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        setDiscount(0);
        setBillResult(null);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Totals
    // ─────────────────────────────────────────────────────────────────────────
    const subtotal = cart.reduce((sum, c) => {
        const isRet = c.itemType === 'RETURN' || c.isReturn;
        const isFr = c.itemType === 'FREE' || c.isFree;
        if (isFr) return sum;
        const line = Number(c.price || 0) * Number(c.qty || 0);
        return sum + (isRet ? -line : line);
    }, 0);
    const grandTotal = Math.max(0, subtotal - Number(discount || 0));

    // ─────────────────────────────────────────────────────────────────────────
    // Submit bill
    // ─────────────────────────────────────────────────────────────────────────
    const submitBill = useCallback(async () => {
        if (!cart.length) { showToast('error', 'Cart is empty'); return; }
        setBillingLoading(true);
        try {
            const orderItems = cart.map(c => {
                const isRet = c.itemType === 'RETURN' || c.isReturn;
                const isFr = c.itemType === 'FREE' || c.isFree;
                const unitPrice = isFr ? 0 : Number(c.price || 0);
                const signedQty = isRet ? -Math.abs(c.qty) : Math.abs(c.qty);
                const lineTotal = unitPrice * signedQty;
                let suffix = '';
                if (isRet) suffix = ' (Return)';
                else if (isFr) suffix = ' (Free)';

                return {
                    name: (c.name || 'Item') + suffix,
                    quantity: signedQty,
                    price: unitPrice,
                    total: lineTotal,
                    inventoryItemId: c.itemId,
                    itemType: c.itemType || (isRet ? 'RETURN' : isFr ? 'FREE' : 'SALE'),
                    isFree: isFr,
                };
            });

            const userObj = JSON.parse(localStorage.getItem('km_user') || '{}');
            const generatedBillNo = generateBillNumber(userObj, 'DIS');
            const currentTimestamp = new Date().toISOString();
            const shopName = selectedShop?.name || 'Distributor Customer';
            const shopPhone = selectedShop?.phone || '';

            // Active Vehicle / Storage Location
            const assignedLoc = getAssignedVehicle(userObj);
            const activeVehicle = selectedLocation !== 'All' ? selectedLocation : (assignedLoc || 'Godown');

            const rawPayload = {
                orderType: 'LINE_POS',
                billNumber: generatedBillNo,
                billNo: generatedBillNo,
                orderNumber: generatedBillNo,
                createdAt: currentTimestamp,
                paymentMethod,
                paymentStatus: 'PAID',
                status: 'PAID',
                tableNumber: 'Takeaway', // Enforce Takeaway so backend NEVER merges into active table orders
                discount: Number(discount || 0),
                total: grandTotal,
                items: orderItems,
                customerName: shopName,
                customerPhone: shopPhone,
                notes: `||BILLNO:${generatedBillNo}|| | ||VEHICLE:${activeVehicle}|| | Customer: ${shopName} | Phone: ${shopPhone}`,
            };

            const payload = attachBillerMetaToPayload(rawPayload, userObj);

            let order;
            // Deduct stock from assigned vehicle / location
            deductVehicleStock(cart, activeVehicle);

            // Check if user is offline upfront
            if (!navigator.onLine) {
                order = saveOfflineOrder(payload);
                setBillResult(order);
                setPurchaseHistory(prev => [order, ...prev]);
                showToast('success', `⚡ Offline Mode: Bill saved! ${activeVehicle} stock deducted.`);
                clearCart();
                return;
            }

            try {
                let res;
                try {
                    res = await api.post('/orders', payload);
                } catch (postErr) {
                    const errDetail = String(postErr.response?.data?.message || postErr.message || '');
                    if (errDetail.includes('OrderType') || errDetail.includes('LINE_POS')) {
                        payload.orderType = 'TAKEAWAY';
                        res = await api.post('/orders', payload);
                    } else if (!postErr.response || postErr.code === 'ECONNABORTED' || postErr.message?.includes('Network Error')) {
                        order = saveOfflineOrder(payload);
                        setBillResult(order);
                        setPurchaseHistory(prev => [order, ...prev]);
                        showToast('success', '⚡ Connection lost: Bill saved offline! Will auto-sync when reconnected.');
                        clearCart();
                        return;
                    } else {
                        throw postErr;
                    }
                }
                order = res.data?.data || { ...payload, id: generatedBillNo };
                setBillResult(order);
                setPurchaseHistory(prev => [order, ...prev]);

                // Inventory adjustment for each cart line
                for (const c of cart) {
                    if (c.itemId) {
                        const isRet = c.itemType === 'RETURN' || c.isReturn;
                        const isFr = c.itemType === 'FREE' || c.isFree;
                        try {
                            await api.post(`/inventory/${c.itemId}/adjust`, {
                                type: isRet ? 'ADD' : 'REMOVE',
                                quantity: Math.abs(c.qty),
                                reason: isRet
                                    ? `Line POS Return – Order ${order?.id || ''}`
                                    : isFr
                                        ? `Line POS Free Sample – Order ${order?.id || ''}`
                                        : `Line POS Sale – Order ${order?.id || ''}`,
                            });
                        } catch (_) { /* non-fatal */ }
                    }
                }

                showToast('success', 'Bill saved successfully!');
                clearCart();
                loadInventory(); // refresh stock
            } catch (err) {
                if (!err.response) {
                    order = saveOfflineOrder(payload);
                    setBillResult(order);
                    showToast('success', '⚡ Connection lost: Bill saved offline! Will auto-sync when reconnected.');
                    clearCart();
                } else {
                    showToast('error', err.response?.data?.message || 'Failed to save bill');
                }
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to save bill');
        } finally {
            setBillingLoading(false);
        }
    }, [cart, paymentMethod, discount, grandTotal, selectedShop, showToast, clearCart, loadInventory]);

    // ─────────────────────────────────────────────────────────────────────────
    // Add new shop (customer)
    // ─────────────────────────────────────────────────────────────────────────
    const addShop = useCallback(async () => {
        if (!newShop.name || !newShop.phone) { showToast('error', 'Name and phone required'); return; }
        try {
            const res = await api.post('/customers', {
                name: newShop.name,
                phone: newShop.phone,
                email: newShop.area ? `area:${newShop.area}` : undefined,
            });
            const created = res.data;
            setShops(prev => [created, ...prev]);
            setSelectedShop(created);
            setShowAddShop(false);
            setNewShop({ name: '', phone: '', area: '' });
            showToast('success', 'Shop added!');
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to add shop');
        }
    }, [newShop, showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // Location management
    // ─────────────────────────────────────────────────────────────────────────
    const refreshLocations = useCallback(() => {
        setLocations(getLinePOSLocations());
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Update item location (saves to backend notes field)
    // ─────────────────────────────────────────────────────────────────────────
    const updateItemLocation = useCallback(async (itemId, location) => {
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;
        let notes = {};
        try { notes = JSON.parse(item.notes || '{}'); } catch (_) { }
        notes.linePosLocation = location;
        await api.put(`/inventory/${itemId}`, { ...item, notes: JSON.stringify(notes) });
        setInventory(prev => prev.map(i => i.id === itemId
            ? { ...i, notes: JSON.stringify(notes), linePosLocation: location }
            : i
        ));
    }, [inventory]);

    return {
        // Shops
        shops, filteredShops, shopSearch, setShopSearch, selectedShop, setSelectedShop,
        shopsLoading, showAddShop, setShowAddShop, newShop, setNewShop, addShop,
        // Inventory
        inventory, filteredInventory, inventoryLoading, loadInventory,
        categories, selectedCategory, setSelectedCategory,
        locations, selectedLocation, setSelectedLocation, refreshLocations, updateItemLocation, getItemLocation,
        // Cart
        cart, addToCart, addSpecificCartLine, updateItemType, updateQty, updateUnitPrice, toggleReturn, removeFromCart, clearCart,
        // Totals
        subtotal, grandTotal, discount, setDiscount,
        // Billing
        paymentMethod, setPaymentMethod, billingLoading, submitBill, billResult, setBillResult,
        // History
        purchaseHistory, historyLoading, frequentItems, lastOrder,
        // Toast
        toast,
    };
}
