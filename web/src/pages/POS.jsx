import React, { useState, useEffect, useCallback } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useTranslation } from 'react-i18next'
import SupermarketPOS from './SupermarketPOS.jsx'
import QueueManagementModal from '../components/QueueManagementModal.jsx'
import './POS.css'
import logo from '../assets/LOGO.jpeg'

// Total tables is now dynamic based on owner profile
const CATEGORIES_ALL = 'All'

export default function POSPage() {
    const { t, i18n } = useTranslation()
    const { showTamilName } = useLanguage()
    const [tables, setTables] = useState([])
    const [selectedTable, setSelectedTable] = useState(null)
    const [menuItems, setMenuItems] = useState([])
    // Print language modal state
    const [showPrintLangModal, setShowPrintLangModal] = useState(false)
    const [pendingPrintOrder, setPendingPrintOrder] = useState(null)
    const [categories, setCategories] = useState([CATEGORIES_ALL])
    const [activeCategory, setActiveCategory] = useState(CATEGORIES_ALL)
    const [cart, setCart] = useState([])
    const [orders, setOrders] = useState({}) // tableNumber -> existing order
    const [waitlistCount, setWaitlistCount] = useState(0) // Tracks active waiting customers
    const [menuSearch, setMenuSearch] = useState('')
    const [savingOrder, setSavingOrder] = useState(false)

    const [notification, setNotification] = useState('')
    const [tokenNumber, setTokenNumber] = useState(null)
    const [showSplitModal, setShowSplitModal] = useState(false)
    const [showCombineModal, setShowCombineModal] = useState(false)
    const [selectedItemsForSplit, setSelectedItemsForSplit] = useState([])
    const [splitTargetTable, setSplitTargetTable] = useState('')
    const [combineTargetTable, setCombineTargetTable] = useState('')
    const [combineCovers, setCombineCovers] = useState(2) // New state for Bug 3
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [staffMode, setStaffMode] = useState(false) // Toggle for availability editing
    const [showQueueModal, setShowQueueModal] = useState(false) // Queue management
    
    const openConfirm = (message, onConfirm) => {
        onConfirm();
        notify(message);
    };

    const closeConfirm = () => {
        // No-op if using standard window.confirm
    };

    // Barcode Scanner & Scale States
    const barcodeBufferRef = React.useRef('') // useRef instead of useState to avoid keydown listener accumulation
    const [lastScannedItem, setLastScannedItem] = useState(null)
    const [scanning, setScanning] = useState(false)
    const [settleWithGst, setSettleWithGst] = useState(true)
    const [scaleWeight, setScaleWeight] = useState(0)
    const [scalePort, setScalePort] = useState(null)
    
    // Extra Charges State
    const [orderExtraCharges, setOrderExtraCharges] = useState([])
    const [tempChargeType, setTempChargeType] = useState('')
    const [tempChargeName, setTempChargeName] = useState('')
    const [tempChargeAmount, setTempChargeAmount] = useState('')
    // Temp extra charges in review modal — only committed on Confirm
    const [tempExtraCharges, setTempExtraCharges] = useState([])
    
    // Sidebar Tab: 'order' or 'general'
    const [sidebarTab, setSidebarTab] = useState('order')

    // Supermarket Mode
    const { supermarketMode } = usePOSMode()

    // Local Tracking for newly created sets (families/groups) before they have orders
    const [localSets, setLocalSets] = useState({}) // baseTable -> Array of setNames

    // Print Queue logic to handle multiple bills and prevent popup blockers
    const queueRef = React.useRef([]);
    const isPrintingRef = React.useRef(false);
    const printedOrdersRef = React.useRef(new Set()); // To prevent duplicate prints

    // Stable refs for values used inside socket/keydown handlers — avoids stale closures and
    // prevents re-registering listeners on every state change.
    const selectedTableRef = React.useRef(selectedTable);
    useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);

    const showQueueModalRef = React.useRef(showQueueModal);
    useEffect(() => { showQueueModalRef.current = showQueueModal; }, [showQueueModal]);

    // Load menu items
    useEffect(() => {
        api.get('/menu').then(res => {
            const items = res.data.data?.menuItems || res.data.data?.items || []
            setMenuItems(items)
            const cats = [CATEGORIES_ALL, ...new Set(items.map(i => i.category).filter(Boolean))]
            setCategories(cats)
        }).catch(() => { })
    }, [])

    const fetchActiveOrders = () => {
        return api.get('/orders?paymentStatus=unpaid&limit=100').then(res => {
            const data = res.data.data?.orders || []
            const map = {}
            data.forEach(o => {
                if (o.status && o.status.toLowerCase() === 'cancelled') return;

                const isTakeaway = (o.orderType && o.orderType.toLowerCase() === 'takeaway') || 
                                   (o.tableNumber && o.tableNumber.startsWith('Takeaway')) || 
                                   !o.tableNumber;

                if (o.tableNumber && o.tableNumber.startsWith('Table')) {
                    map[o.tableNumber] = o;
                    
                    // Also map merged tables to the same order so they show as "Occupied"
                    if (o.mergedTables) {
                        const mergedList = o.mergedTables.split(',').map(t => t.trim());
                        mergedList.forEach(tableNum => {
                            if (tableNum && tableNum !== o.tableNumber) {
                                map[tableNum] = o;
                            }
                        });
                    }
                } else if (isTakeaway) {
                    const key = `Takeaway-T${o.tokenNumber || o._id || 'NEW'}`
                    map[key] = o
                }
            })
            setOrders(map)
            return map
        }).catch(() => { return {} })
    }

    const { user } = useAuth()
    const role = user?.role?.toLowerCase()
    const restaurantId = role === 'owner' ? user?._id : user?.parentOwnerId

    const fetchWaitlistCount = () => {
        if (!restaurantId) return;
        api.get('/queue/active').then(res => {
            if (res.data.success) {
                // Count customers who are 'WAITING' or 'CALLED'
                const count = res.data.data.filter(q => q.status === 'WAITING' || q.status === 'CALLED').length;
                setWaitlistCount(count);
            }
        }).catch(() => {});
    }

    // Load all active orders
    useEffect(() => {
        if (!restaurantId) return
        fetchActiveOrders()
        fetchWaitlistCount()

        if (socket) {
            const joinRoom = () => socket.emit('join:restaurant', String(restaurantId))
            if (socket.connected) joinRoom()
            socket.on('connect', joinRoom)

            const handleUpdate = () => fetchActiveOrders()

            // ✅ Named handlers stored as variables so cleanup can remove the EXACT same reference
            const handleQueueUpdate = (data) => {
                fetchWaitlistCount();
                // Use ref to read current modal state without needing it in deps
                if (!showQueueModalRef.current) {
                    setNotification("New customer joined the waitlist!");
                    setTimeout(() => setNotification(''), 5000);
                }
            };

            const handleStatusUpdate = (data) => {
                handleUpdate();
                if (data.status?.toLowerCase() === 'paid' && data.orderId) {
                    api.get(`/orders/${data.orderId}`).then(res => {
                        if (res.data.success && res.data.data) {
                            printBill(res.data.data);
                        }
                    }).catch(() => {});
                }
            };

            const handleBillingRequest = (data) => {
                if (data.order && data.order._id) {
                    const printKey = `${data.order._id}_billing`;
                    if (!printedOrdersRef.current.has(printKey)) {
                        printedOrdersRef.current.add(printKey);
                        setTimeout(() => printedOrdersRef.current.delete(printKey), 30000);
                        printBill(data.order);
                        handleUpdate();
                    }
                }
            };

            const handleItemUpdate = (data) => {
                handleUpdate();
                // Use ref to read selectedTable without needing it in effect deps
                const curTable = selectedTableRef.current;
                if (curTable && (curTable === data.tableNumber || curTable === `Table ${data.tableNumber}`)) {
                    setCart(prev => prev.map(item =>
                        item._id === data.itemId ? { ...item, status: data.status } : item
                    ));
                }
            };

            const handleNotification = (data) => {
                if (data.message) {
                    setNotification(data.message);
                    setTimeout(() => setNotification(''), 7000);
                }
            };

            socket.on('kot:new', handleUpdate)
            socket.on('kot:update', handleUpdate)
            socket.on('queue_update', handleQueueUpdate)
            socket.on('kot:statusUpdate', handleStatusUpdate)
            socket.on('billing:newRequest', handleBillingRequest)
            socket.on('kot:itemUpdate', handleItemUpdate)
            socket.on('notification:send', handleNotification)

            return () => {
                socket.off('connect', joinRoom)
                socket.off('kot:new', handleUpdate)
                socket.off('kot:update', handleUpdate)
                socket.off('queue_update', handleQueueUpdate)   // ✅ Exact same reference
                socket.off('kot:statusUpdate', handleStatusUpdate)
                socket.off('billing:newRequest', handleBillingRequest)
                socket.off('kot:itemUpdate', handleItemUpdate)
                socket.off('notification:send', handleNotification)
            }
        }
    }, [restaurantId, socket]) // ✅ Removed selectedTable — now accessed via ref instead

    // Update waitlist count when modal is fully closed so the waiter sees accurate numbers after managing queue
    useEffect(() => {
        if (!showQueueModal) {
            fetchWaitlistCount();
        }
    }, [showQueueModal]);
    
    // Global Barcode Scan Listener
    // ✅ Uses a ref for the buffer so the listener is registered ONCE (not on every keystroke)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                if (barcodeBufferRef.current.length >= 3) {
                    handleBarcodeScan(barcodeBufferRef.current);
                }
                barcodeBufferRef.current = '';
            } else if (e.key.length === 1) {
                barcodeBufferRef.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); // ✅ Empty deps — registers ONCE, never accumulates

    const handleBarcodeScan = async (code) => {
        if (!selectedTable) {
            notify("Select a table/order first!");
            return;
        }
        setScanning(true);
        try {
            // Check menu items
            let item = menuItems.find(m => m.barcode === code);
            
            if (!item) {
                // Search inventory
                const res = await api.get(`/inventory/barcode/${code}`);
                if (res.data.success && res.data.data) {
                    const invItem = res.data.data;
                    item = {
                        menuItemId: null,
                        inventoryItemId: invItem._id,
                        name: invItem.name,
                        price: invItem.price || 0,
                        barcode: invItem.barcode,
                        isAvailable: true,
                        category: invItem.category
                    };
                }
            }

            if (item) {
                addToCart(item);
                setLastScannedItem(item);
                setTimeout(() => setLastScannedItem(null), 3000);
            } else {
                notify(`Barcode ${code} not found`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setScanning(false);
        }
    };

    const getTableStatus = (num) => {
        const baseKey = `Table ${num}`
        // Check if base table OR any set (like "Table 5 - Set 2") is occupied
        const isOccupied = Object.keys(orders).some(k => k === baseKey || k.startsWith(`${baseKey} - Set`))
        return isOccupied ? 'occupied' : 'free'
    }

    const selectTable = (num) => {
        let key;
        if (num === 'Takeaway') {
            key = 'Takeaway';
        } else if (typeof num === 'string' && (num.startsWith('Table ') || num.startsWith('Takeaway-T'))) {
            key = num;
        } else {
            key = `Table ${num}`;
        }

        setSelectedTable(key)
        setTokenNumber(null)

        // Ensure this set is tracked locally as part of this table's family groups
        if (key.startsWith('Table ')) {
            const baseTable = key.split(' - Set')[0];
            setLocalSets(prev => {
                const current = prev[baseTable] || [baseTable];
                if (!current.includes(key)) {
                    return { ...prev, [baseTable]: [...current, key].sort() };
                }
                return prev;
            });
        }

        const existing = orders[key]
        if (existing?.items) {
            setCart(existing.items.map(i => ({
                _id: i._id,
                menuItemId: i.menuItemId?._id || i.menuItemId,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                notes: i.notes || '',
                status: i.status || 'preparing'
            })))
            if (existing.tokenNumber) setTokenNumber(existing.tokenNumber)
            setOrderExtraCharges(existing.extraCharges || [])
            setSidebarTab('order')
        } else {
            setCart([])
            setOrderExtraCharges([])
            setSidebarTab('general')
        }
    }

    const connectScale = async () => {
        if (!("serial" in navigator)) {
            alert("Scale requires Chrome/Edge with Web Serial support.");
            return;
        }
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            setScalePort(port);
            
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep partial line
                
                for (const line of lines) {
                    const match = line.match(/[-+]?\d*\.?\d+/);
                    if (match) {
                        const val = parseFloat(match[0]);
                        if (!isNaN(val)) setScaleWeight(Math.abs(val));
                    }
                }
            }
        } catch (err) {
            console.error("Scale connection failed:", err);
            setScalePort(null);
        }
    };

    const applyWeightToItem = (itemId, weight) => {
        setCart(prev => prev.map(item => 
            (item._id === itemId || item.menuItemId === itemId || item.inventoryItemId === itemId) 
            ? { ...item, quantity: weight } 
            : item
        ));
        notify(`Applied weight: ${weight} kg`);
    };

    const removeSet = (setKey, allSets) => {
        // Only sets with " - Set " suffix can be removed. Base table (S1) is non-removable.
        if (!setKey.includes(' - Set ')) {
            notify('S1 (main table) cannot be removed.');
            return;
        }
        
        const baseTable = setKey.split(' - Set')[0];
        
        // Confirm if there are items in the cart
        if (cart.length > 0 && selectedTable === setKey) {
            openConfirm('This set has items in the cart. Are you sure you want to remove it?', () => {
                setLocalSets(prev => ({
                    ...prev,
                    [baseTable]: (prev[baseTable] || []).filter(s => s !== setKey)
                }));
                selectTable(baseTable.replace('Table ', ''));
                notify(`${setKey} removed`);
            });
            return;
        }

        setLocalSets(prev => ({
            ...prev,
            [baseTable]: (prev[baseTable] || []).filter(s => s !== setKey)
        }));

        if (selectedTable === setKey) {
            selectTable(baseTable.replace('Table ', ''));
        }
        notify(`${setKey} removed`);
    };

    const isAcTable = React.useMemo(() => {
        if (!selectedTable || !user?.acTables) return false;
        const tableNumStr = selectedTable.replace('Table ', '').trim();
        const acTableList = user.acTables.split(',').map(s => s.trim());
        return acTableList.includes(tableNumStr);
    }, [selectedTable, user?.acTables]);
    
    const acMarkup = isAcTable ? (user?.acChargePercentage || 20) : 0;
    
    const tableMetadata = React.useMemo(() => {
        if (!user?.tableMetadata) return {};
        if (typeof user.tableMetadata === 'string') {
            try { return JSON.parse(user.tableMetadata); } catch(e) { return {}; }
        }
        return user.tableMetadata;
    }, [user?.tableMetadata]);

    const getEffectivePrice = (basePrice) => {
        if (!acMarkup) return basePrice;
        return basePrice + (basePrice * acMarkup / 100);
    };

    const addToCart = (item) => {
        const effectivePrice = getEffectivePrice(item.price);
        setSidebarTab('order');
        setCart(prev => {
            const mId = item._id || item.menuItemId;
            const invId = item.inventoryItemId;
            
            // Consolidate if same menu item or same inventory item (no _id means not saved yet)
            const existing = prev.find(c => !c._id && (
                (mId && c.menuItemId === mId) || 
                (invId && c.inventoryItemId === invId)
            ));

            if (existing) {
                return prev.map(c => (c === existing) ? { ...c, quantity: c.quantity + 1 } : c);
            }

            return [...prev, { 
                menuItemId: mId, 
                inventoryItemId: invId,
                name: item.name, 
                tamilName: item.tamilName,
                price: effectivePrice, 
                quantity: 1, 
                notes: '', 
                status: 'preparing',
                barcode: item.barcode
            }];
        });
    };

    const removeItemFromCart = async (itemToRemove) => {
        const idToRemove = itemToRemove._id || itemToRemove.menuItemId || itemToRemove.inventoryItemId;

        // If it's an already saved item (part of a KOT), we should confirm if it needs to be cancelled on the backend
        if (itemToRemove._id) {
            openConfirm(`Are you sure you want to cancel ${itemToRemove.name} from this KOT?`, async () => {
                try {
                    const existingOrder = orders[selectedTable];
                    if (existingOrder) {
                        await api.patch(`/orders/${existingOrder._id}/items/${itemToRemove._id}/status`, { status: 'CANCELLED' });
                        notify(`${itemToRemove.name} cancelled in kitchen`);
                        
                        // Local update: filter out the cancelled item immediately
                        setCart(prev => {
                            const updated = prev.filter(c => c._id !== itemToRemove._id);
                            if (updated.length === 0 && showReviewModal) setShowReviewModal(false);
                            return updated;
                        });
                    }
                } catch (err) {
                    notify('Failed to cancel item in kitchen');
                    return;
                }
            });
            return;
        }

        setCart(prev => {
            const updated = prev.filter(c => 
                !((c._id && c._id === itemToRemove._id) || 
                  (c.menuItemId && c.menuItemId === itemToRemove.menuItemId && !c._id) ||
                  (c.inventoryItemId && c.inventoryItemId === itemToRemove.inventoryItemId && !c._id))
            );
            if (updated.length === 0 && showReviewModal) setShowReviewModal(false);
            return updated;
        });
        if (!itemToRemove._id) notify(`${itemToRemove.name} removed from cart`);
    };

    const updateQty = (id, delta) => {
        setCart(prev => {
            const updated = prev
                .map(c => (c.menuItemId === id || c._id === id) ? { ...c, quantity: c.quantity + delta } : c)
                .filter(c => c.quantity > 0);
            // Bug 8: Auto-close review modal when cart becomes empty
            if (updated.length === 0) {
                setShowReviewModal(false);
            }
            return updated;
        })
    }

    const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)

    const notify = (msg) => {
        setNotification(msg)
        setTimeout(() => setNotification(''), 3000)
    }

    const saveOrder = async () => {
        if (!selectedTable || cart.length === 0) return
        setSavingOrder(true)
        try {
            const existing = orders[selectedTable]
            const payload = {
                tableNumber: (selectedTable && selectedTable.startsWith('Takeaway')) ? null : selectedTable,
                items: cart.map(c => ({
                    _id: c._id,
                    menuItemId: c.menuItemId,
                    name: c.name,
                    price: c.price,
                    quantity: c.quantity,
                    notes: c.notes,
                    status: c.status,
                    inventoryItemId: c.inventoryItemId,
                    barcode: c.barcode,
                    taxRate: c.taxRate !== undefined ? c.taxRate : (typeof user?.taxRate === 'number' ? user.taxRate : 5.0)
                })),
                orderType: (selectedTable && selectedTable.startsWith('Takeaway')) ? 'takeaway' : 'dine-in',
                extraCharges: orderExtraCharges,
                subtotal: cartTotal,
                inventoryItems: cart.map(c => ({
                    inventoryItemId: c.inventoryItemId,
                    quantity: c.quantity,
                    barcode: c.barcode
                })),
                total: cartTotal + orderExtraCharges.reduce((s,c) => s + Number(c.amount || 0), 0)
            }
            if (existing) {
                await api.put(`/orders/${existing._id}`, payload)
                notify('Order updated ✓')
            } else {
                const res2 = await api.post('/orders', payload)
                const savedOrder = res2.data.data?.order
                if (savedOrder?.tokenNumber) {
                    setTokenNumber(savedOrder.tokenNumber)
                    const newKey = `Takeaway-T${savedOrder.tokenNumber || savedOrder._id}`
                    
                    // Optimistic update
                    setOrders(prev => ({
                        ...prev,
                        [newKey]: savedOrder
                    }))
                    
                    if (selectedTable === 'Takeaway') {
                        setSelectedTable(newKey);
                    }
                }
                notify('Order created ✓')
            }
            // Refresh orders and sync cart
            const updatedMap = await fetchActiveOrders()
            // The selectedTable might have changed above if it was a new takeaway
            const updatedExisting = updatedMap[selectedTable]

            if (updatedExisting?.items) {
                setCart(updatedExisting.items.map(i => ({
                    _id: i._id,
                    menuItemId: i.menuItemId?._id || i.menuItemId,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    notes: i.notes || '',
                    status: i.status || 'preparing'
                })))
            }
            if (updatedExisting?.extraCharges) {
                setOrderExtraCharges(updatedExisting.extraCharges)
            }

            // Print KOT Automatically
            if (updatedExisting && updatedExisting.items && updatedExisting.items.length > 0) {
                printBill(updatedExisting, false, true, 'en');
            }

            // KOT Popup Message
            notify('✅ KOT Sent to Kitchen Successfully!');
        } catch (err) {
            notify('Failed: ' + (err.response?.data?.message || 'Error'))
        } finally {
            setSavingOrder(false)
        }
    }

    const closeOrder = async () => {
        openConfirm('Are you sure you want to completely cancel this order and clear the cart?', async () => {
            const existing = orders[selectedTable];
            if (!existing) {
                setCart([]);
                setOrderExtraCharges([]);
                if (typeof notify === 'function') notify('Cart cleared');
                return;
            }

            setSavingOrder(true);
            try {
                await api.patch(`/orders/${existing._id}/status`, { status: 'CANCELLED' });
                if (typeof notify === 'function') notify('Order cancelled successfully');
                await fetchActiveOrders();
                setCart([]);
                setOrderExtraCharges([]);
                if (selectedTable.startsWith('Takeaway') && selectedTable !== 'Takeaway') {
                    setSelectedTable('Takeaway');
                }
            } catch (err) {
                if (typeof notify === 'function') notify('Cancel failed: ' + (err.response?.data?.message || err.message));
            } finally {
                setSavingOrder(false);
            }
        });
    }


    const handleCombine = async () => {
        if (!combineTargetTable) return;
        
        const targetKey = combineTargetTable.startsWith('Table ') ? combineTargetTable : `Table ${combineTargetTable}`;
        const targetOrder = orders[targetKey];
        
        setSavingOrder(true)
        try {
            await api.post(`/orders/combine-tables`, {
                sourceTable: selectedTable,
                targetOrderId: targetOrder ? targetOrder._id : null,
                targetTable: targetKey,
                covers: combineCovers // Pass covers for Bug 3
            })
            notify('Tables combined successfully')
            setShowCombineModal(false)
            setCombineTargetTable(null)
            setCombineCovers(2) // Reset
            await fetchActiveOrders()
            selectTable(targetKey.replace('Table ', ''))
        } catch (err) {
            notify('Combine failed: ' + (err.response?.data?.message || 'Error'))
        } finally {
            setSavingOrder(false)
        }
    }

    const handleUnmerge = async (tableToUnmerge) => {
        const existing = orders[selectedTable];
        if (!existing) return;
        
        openConfirm(`Are you sure you want to unmerge ${tableToUnmerge}?`, async () => {
            setSavingOrder(true);
            try {
                await api.post(`/orders/${existing._id}/uncombine-table`, {
                    tableNumber: tableToUnmerge
                });
                
                const updatedActiveOrders = await fetchActiveOrders();
                const currentSelectedTable = selectedTable;
                setCart([]);
                setOrderExtraCharges([]);
                
                if (updatedActiveOrders[currentSelectedTable]) {
                    const order = updatedActiveOrders[currentSelectedTable];
                    setCart(order.items || []);
                    if (order.extraCharges) {
                        setOrderExtraCharges(order.extraCharges);
                    }
                } else if (updatedActiveOrders[`Table ${tableToUnmerge}`]) {
                    setSelectedTable(`Table ${tableToUnmerge}`);
                } else {
                    setSelectedTable(null);
                }
                
                if (typeof notify === 'function') notify(`Table ${tableToUnmerge} unmerged successfully`);
            } catch (err) {
                if (typeof notify === 'function') notify('Failed to unmerge: ' + (err.response?.data?.message || err.message));
            } finally {
                setSavingOrder(false);
            }
        });
    };

    const toggleAvailability = async (item) => {
        try {
            await api.patch(`/menu/${item._id}/toggle`)
            setMenuItems(prev => prev.map(m => m._id === item._id ? { ...m, isAvailable: !m.isAvailable } : m))
            notify(`${item.name} is now ${!item.isAvailable ? 'Available' : 'Out of Stock'}`)
        } catch (err) {
            notify('Update failed')
        }
    }

    const settleOrder = async (method = 'cash') => {
        const existing = orders[selectedTable]
        if (!existing) return
        try {
            await api.patch(`/orders/${existing._id}/status`, { 
                status: 'paid', 
                paymentStatus: 'paid', 
                paymentMethod: method,
                printWithGst: settleWithGst
            })
            const newOrders = { ...orders }
            delete newOrders[selectedTable]
            setOrders(newOrders)

            // Auto-remove additional sets on payment
            if (selectedTable.includes(' - Set ')) {
                const baseTable = selectedTable.split(' - Set')[0];
                setLocalSets(prev => ({
                    ...prev,
                    [baseTable]: (prev[baseTable] || []).filter(s => s !== selectedTable)
                }));
            }

            setCart([])
            setSelectedTable(null)
             setShowPaymentModal(false)
            notify(`Payment received via ${method.toUpperCase()} ✓`)
        } catch (e) {
            notify('Failed to settle bill')
        }
    }

    const printBill = (order, printCustomerCopy = true, printKitchenCopy = true, printLang = 'en') => {
        if (!order || !order._id) return;
        
        const restaurantName = user?.restaurantName || 'RESTAURANT';
        const logoUrl = user?.logo ? (user.logo.startsWith('http') ? user.logo : window.location.origin + user.logo) : (logo.startsWith('http') ? logo : window.location.origin + logo);
        const logoImg = `<img src="${logoUrl}" class="logo" alt="logo" />`;

        const newJobs = [];
        
        // Evaluate user printer settings (default to true if undefined)
        const isCashCounterPrinterEnabled = user?.billPrinterEnabled !== false;
        const isKitchenPrinterEnabled = user?.kotPrinterEnabled !== false;

        if (printCustomerCopy && isCashCounterPrinterEnabled) {
            const count = user?.printCount || 1;
            for (let i = 0; i < count; i++) {
                newJobs.push({ 
                    type: t('bill.customer_copy', 'CUSTOMER COPY'), 
                    itemWiseKOT: user.itemWiseKOT ?? false,
                    printCount: user.printCount ?? 1,
                    pharmacyFontSize: user.pharmacyFontSize || 11,
                    quickMode: user.quickMode ?? false,
                    printCategoryInBill: user?.printCategoryInBill ?? false,
                    printLang,
                    isKot: false,
                    orderData: {
                        items: order.items,
                        orderNumber: order.orderNumber || (order._id ? String(order._id).slice(-8).toUpperCase() : 'NEW'),
                        table: order.tableNumber || (order.tokenNumber ? `Token ${order.tokenNumber}` : 'Takeaway'),
                        subtotal: order.subtotal !== undefined ? order.subtotal : (order.total || 0),
                        extraCharges: order.extraCharges || [],
                        createdAt: order.createdAt || new Date(),
                        paymentMethod: order.paymentMethod || paymentMethod || 'Cash',
                        // Pharmacy / custom bill fields
                        billTemplate: user?.basicBillTemplate || order.billTemplate || 'standard',
                        printWithGst: order.printWithGst !== false,
                        taxType: order.taxType || user?.taxType || 'Inclusive',
                        doctorName: order.doctorName || '',
                        numberOfDays: order.numberOfDays || '',
                        customerName: order.customerName || '',
                        customerPhone: order.customerPhone || '',
                        customerFirm: order.customerFirm || '',
                        billNo: order.billNo || order.orderNumber || '',
                        discountPct: order.discountPct || 0,
                        source: order.source || '',
                        totalDiscount: order.totalDiscount,
                        totalTax: order.totalTax,
                        totalSgst: order.totalSgst,
                        totalCgst: order.totalCgst,
                        total: order.total
                    } 
                });
            }
        }

        if (printKitchenCopy && !order.skipKOT && isKitchenPrinterEnabled) {
            newJobs.push({ 
                type: t('bill.kitchen_copy', 'KITCHEN COPY'), 
                isKot: true,
                printLang,
                orderData: {
                    items: order.items,
                    orderNumber: order.orderNumber || (order._id ? String(order._id).slice(-8).toUpperCase() : 'NEW'),
                    table: order.tableNumber || (order.tokenNumber ? `Token ${order.tokenNumber}` : 'Takeaway'),
                    subtotal: order.total || order.subtotal || 0,
                    createdAt: order.createdAt || new Date()
                } 
            });
        }

        queueRef.current.push(...newJobs);

        if (!isPrintingRef.current) {
            processQueue(logoImg, restaurantName);
        }
    }

    const handlePrintAndClose = async () => {
        if (!selectedTable || cart.length === 0) return;
        const existing = orders[selectedTable];
        if (!existing) {
            alert('Please confirm KOT first before closing the order!');
            return;
        }
        // Show language picker before printing
        setPendingPrintOrder(existing);
        setShowPrintLangModal(true);
    };

    const handlePrintWithLanguage = (lang) => {
        setShowPrintLangModal(false);
        if (pendingPrintOrder) {
            printBill({...pendingPrintOrder, printWithGst: settleWithGst}, true, false, lang);
            setPendingPrintOrder(null);
        }
        setShowPaymentModal(true);
    };

    const handleA4Invoice = async () => {
        if (!selectedTable) return;
        const existing = orders[selectedTable];
        if (!existing) return;
        try {
            const res = await api.get(`/orders/${existing._id}/invoice/a4`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice-${existing.orderNumber || existing._id}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Failed to download invoice', e);
            notify('Failed to download A4 Invoice');
        }
    };

    const handleWhatsApp = () => {
        if (!selectedTable) return;
        const existing = orders[selectedTable];
        if (!existing) return;
        const phone = prompt("Enter customer WhatsApp number (e.g. 919876543210):", existing.customerPhone || "");
        if (!phone) return;
        const text = `*${user?.restaurantName || 'RESTAURANT'}*\n\nOrder #${existing.orderNumber || String(existing._id).slice(-8).toUpperCase()}\nAmount: ₹${existing.total?.toFixed(2) || existing.subtotal?.toFixed(2) || 0}\nStatus: ${existing.status || 'PREPARING'}\n\nThank you for your order!`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const processQueue = async (logoImg, restaurantName) => {
        if (isPrintingRef.current || queueRef.current.length === 0) return;
        isPrintingRef.current = true;

        const printIframe = document.getElementById('print-iframe');
        if (!printIframe) {
            console.error('Print iframe not found');
            isPrintingRef.current = false;
            return;
        }
        const printWindow = printIframe.contentWindow;

        while (queueRef.current.length > 0) {
            const job = queueRef.current.shift();
            const { type, isKot, orderData, printLang = 'en', pharmacyFontSize = 11, printCategoryInBill = false } = job;
            const { items, orderNumber, table, subtotal, extraCharges, createdAt } = orderData;

            // ── Destructure pharmacy-specific fields FIRST (used inside getBillBody) ──
            const {
                billTemplate: jobBillTemplate,
                doctorName: jobDoctorName,
                numberOfDays: jobNumberOfDays,
                customerName: jobCustomerName,
                customerPhone: jobCustomerPhone,
                customerFirm: jobCustomerFirm,
                billNo: jobBillNo,
                discountPct: jobDiscountPct,
                paymentMethod: jobPaymentMethod,
                printWithGst: jobPrintWithGst,
                taxType,
            } = orderData;

            // KOT is ALWAYS thermal, never pharmacy A4
            const isPharmacy = !isKot && (jobBillTemplate === 'pharmacy' || jobBillTemplate === 'A4');
            const isGstBill = !isKot && (jobBillTemplate === 'gst');
            
            const getBillBody = () => {
                const isSupermarket = orderData.source === 'supermarket';
                const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
                const discountRate = parseFloat(jobDiscountPct) || 0;
                const taxRate = typeof user?.taxRate === 'number' ? user.taxRate : 18;
                const effectiveTaxType = orderData.taxType || user?.taxType || 'Inclusive';
                
                const originalSubtotal = items.reduce((s, item) => {
                    const price = parseFloat(item.price || 0);
                    const qty = parseFloat(item.quantity || 0);
                    let basePrice;
                    if (jobPrintWithGst !== false) {
                        if (effectiveTaxType === 'Exclusive') {
                            basePrice = price;
                        } else {
                            const itemTaxRate = typeof item.taxRate === 'number' ? item.taxRate : taxRate;
                            basePrice = price / (1 + itemTaxRate / 100);
                        }
                    } else {
                        basePrice = price;
                    }
                    return s + (basePrice * qty);
                }, 0);
                
                const discountAmount = originalSubtotal * (discountRate / 100);
                const netSubtotal = originalSubtotal - discountAmount;
                const taxableSubtotal = netSubtotal;

                let totalGstAmount = 0;
                if (jobPrintWithGst !== false) {
                    items.forEach(item => {
                        const price = parseFloat(item.price || 0);
                        const qty = parseFloat(item.quantity || 0);
                        const itemTaxRate = typeof item.taxRate === 'number' ? item.taxRate : taxRate;
                        const finalItemPrice = price * (1 - discountRate / 100);
                        
                        if (effectiveTaxType === 'Inclusive') {
                            const itemBaseRate = finalItemPrice / (1 + itemTaxRate / 100);
                            totalGstAmount += (finalItemPrice - itemBaseRate) * qty;
                        } else {
                            totalGstAmount += finalItemPrice * (itemTaxRate / 100) * qty;
                        }
                    });
                }
                
                const sgstAmount = totalGstAmount / 2;
                const cgstAmount = totalGstAmount / 2;
                
                const extraTotal = extraCharges ? extraCharges.reduce((s,c) => s + Number(c.amount || 0), 0) : 0;
                
                const grandTotal = isSupermarket && orderData.total !== undefined
                    ? orderData.total.toFixed(2)
                    : (netSubtotal + totalGstAmount + extraTotal).toFixed(2);
                
                const sgstPct = taxRate / 2;
                const cgstPct = taxRate / 2;

                return `
                <div class="${isKot ? 'kot-section' : 'customer-section'}">
                    <div class="center header">
                        <div style="font-size: 11px; margin-bottom: 2px; border: 1px solid #000; display: inline-block; padding: 1px 5px; font-weight: bold;">${type}</div>
                        <br/>
                        ${logoImg}
                        <h2 style="margin: 3px 0; text-transform: uppercase; font-size: 20px; font-weight: bold;">${restaurantName}</h2>
                        ${(!isKot && user?.address) ? `<div style="font-size: 13px; margin: 2px auto; max-width: 95%; line-height: 1.2; font-weight: normal; color: #333;">${user.address}</div>` : ''}
                        ${(!isKot && jobPrintWithGst !== false) ? `<div style="font-size: 15px; margin-bottom: 3px; font-weight: normal;">GSTIN: ${user.gstNumber || 'N/A'}</div>` : ''}
                    </div>
                    <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; margin: 4px 0; padding: 3px 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 15px; padding: 0 10px; font-weight: normal;">
                            <span>${t('bill.bill_no', 'Bill No')}: <span>${orderNumber}</span></span>
                            <span>${t('bill.table_no', 'Table No')}: <span>${table}</span></span>
                        </div>
                    </div>
                    <div class="center" style="font-size: 15px; font-weight: normal;">${t('bill.date', 'Date')}: ${new Date(createdAt).toLocaleString()}</div>
                    ${jobDoctorName ? `<div class="center" style="font-size:12px; margin-top:2px;">Dr: <b>${jobDoctorName}</b></div>` : ''}
                    ${jobNumberOfDays ? `<div class="center" style="font-size:12px;">Days: <b>${jobNumberOfDays}</b></div>` : ''}
                    <hr style="border-top:1px dashed #000; margin: 5px 0;"/>
                    <table>
                        <thead>
                            <tr style="border-bottom: 1px solid #000; font-size: ${printLang === 'ta' ? '12px' : '15px'}; font-weight: bold;">
                                <th style="text-align: left; width: ${!isKot && printCategoryInBill ? '30%' : '42%'};">${t('bill.item', 'Item')}</th>
                                ${!isKot && printCategoryInBill ? `<th style="text-align: left; width: 18%;">${t('bill.category', 'Grp')}</th>` : ''}
                                <th style="text-align: center; width: 12%;">${t('bill.qty', 'Qty')}</th>
                                ${!isKot ? `<th style="text-align: right; width: ${printCategoryInBill ? '17%' : '18%'};">${t('bill.rate', 'Price')}</th>` : ''}
                                ${!isKot ? `<th style="text-align: right; width: ${printCategoryInBill ? '23%' : '25%'};">${t('bill.amount', 'Amt')}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((c, index) => {
                                const matchedMenu = menuItems.find(m => String(m._id) === String(c.menuItemId));
                                const tName = c.tamilName || (matchedMenu ? matchedMenu.tamilName : null);
                                const displayName = (printLang === 'ta' && tName) ? tName : c.name;
                                
                                let itemBaseRate, rowTotal;
                                if (jobPrintWithGst !== false) {
                                    const finalItemPrice = parseFloat(c.price || 0) * (1 - discountRate / 100);
                                    const itemTaxRate = typeof c.taxRate === 'number' ? c.taxRate : taxRate;
                                    if (effectiveTaxType === 'Exclusive') {
                                        itemBaseRate = finalItemPrice;
                                    } else {
                                        itemBaseRate = finalItemPrice / (1 + itemTaxRate / 100);
                                    }
                                    rowTotal = itemBaseRate * c.quantity;
                                } else {
                                    const finalItemPrice = parseFloat(c.price || 0) * (1 - discountRate / 100);
                                    itemBaseRate = finalItemPrice;
                                    rowTotal = itemBaseRate * c.quantity;
                                }

                                return `
                                <tr>
                                    <td style="padding: 2px 0; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: bold; padding-right: 2px;">${displayName}</td>
                                    ${!isKot && printCategoryInBill ? `<td style="padding: 2px 0; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal; padding-right: 2px; text-transform: capitalize;">${matchedMenu?.category || c.category || 'General'}</td>` : ''}
                                    <td style="padding: 2px 0; text-align: center; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${c.quantity}</td>
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${itemBaseRate.toFixed(2)}</td>` : ''}
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${rowTotal.toFixed(2)}</td>` : ''}
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    ${!isKot ? `
                        <div class="total" style="border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; font-weight: normal; font-size: 15px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${t('bill.subtotal', 'Gross Total')}:</span>
                                <span>₹${originalSubtotal.toFixed(2)}</span>
                            </div>
                            
                            ${discountAmount > 0 ? `
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px; color: #555;">
                                <span>Discount (${discountRate.toFixed(2)}%):</span>
                                <span>-₹${discountAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}

                            ${extraCharges && extraCharges.length > 0 ? extraCharges.map(c => `
                                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px;">
                                    <span>${c.name}:</span>
                                    <span>₹${c.amount.toFixed(2)}</span>
                                </div>
                            `).join('') : ''}

                            ${(jobPrintWithGst !== false) ? `
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px; border-top: 1px dotted #ccc; padding-top: 2px;">
                                <span>Actual Value:</span>
                                <span>₹${taxableSubtotal.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                                <span>SGST (${sgstPct.toFixed(1)}%):</span>
                                <span>₹${sgstAmount.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                                <span>CGST (${cgstPct.toFixed(1)}%):</span>
                                <span>₹${cgstAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 3px;">
                                <span>${t('bill.total', 'GRAND TOTAL')}:</span>
                                <span>₹${grandTotal}</span>
                            </div>
                        </div>
                        <hr style="border-top:1px dashed #000; margin: 10px 0;"/>
                        <div style="font-size: 12px; padding: 0 10px; margin-bottom: 5px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">${t('pos.items', 'Total Items')}: ${totalItemsCount}</div>
                        </div>
                        <div class="center footer">
                            <div class="bold" style="font-size: 14px; margin-bottom: 3px;">${t('bill.thank_you', 'Thank You! Visit Again')}</div>
                            <div class="software-ref">${t('bill.powered_by', 'Software by ProBloom')}</div>
                        </div>
                    ` : `
                        <hr style="border-top:1px dashed #000; margin: 5px 0;"/>
                        <div class="center footer" style="margin-top: 5px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">Total Items: ${totalItemsCount}</div>
                            <div class="bold" style="font-size: 16px;">(KITCHEN COPY)</div>
                        </div>
                    `}
                </div>
                `;
            };

            // ── Pharmacy A4 Invoice Template ──────────────────────────────
            const getPharmacyBillBody = () => {
                const invoiceDate = new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const invoiceTime = new Date(createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, grandTotalPharm = 0;
                const gstSummary = {}; // To group by GST%

                const itemRows = (items || []).map((item, i) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const mrp = parseFloat(item.mrp || item.price) || 0;
                    const total = +(mrp * qty).toFixed(2);
                    grandTotalPharm += total;

                    const fSize = pharmacyFontSize;

                    return `<tr>
                        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 4px;text-align:center;font-size:${fSize}px">${i + 1}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:center;font-size:${fSize}px">${item.hsnCode || '-'}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:left;font-size:${fSize}px"><b>${item.name || ''}</b></td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:center;font-size:${fSize}px">${item.batchNo || '-'}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:center;font-size:${fSize}px">${item.expDate || '-'}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:center;font-size:${fSize}px">${qty}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:right;font-size:${fSize}px">${mrp.toFixed(2)}</td>
                        <td style="border-right:1px solid #000;padding:2px 4px;text-align:right;font-size:${fSize}px">${total.toFixed(2)}</td>
                    </tr>`;
                }).join('');

                const taxRows = Object.keys(gstSummary).map(pct => {
                    const s = gstSummary[pct];
                    const halfPct = (parseFloat(pct) / 2).toFixed(2);
                    return `<tr>
                        <td style="border:1px solid #ccc;padding:2px 4px;text-align:center">${halfPct}+${halfPct}</td>
                        <td style="border:1px solid #ccc;padding:2px 4px;text-align:right">${s.taxable.toFixed(2)}</td>
                        <td style="border:1px solid #ccc;padding:2px 4px;text-align:right">${s.cgst.toFixed(2)}</td>
                        <td style="border:1px solid #ccc;padding:2px 4px;text-align:right">${s.sgst.toFixed(2)}</td>
                        <td style="border:1px solid #ccc;padding:2px 4px;text-align:right">${s.total.toFixed(2)}</td>
                    </tr>`;
                }).join('');

                return `
                <div style="font-family:Calibri, 'Segoe UI', Arial, sans-serif;font-size:11px;color:#000;max-width:210mm;margin:0 auto;padding:10px;border:1px solid #3b82f6;border-radius:12px;position:relative;">
                  
                  <!-- HEADER -->
                  <div style="text-align:center;position:relative;margin-bottom:10px">
                    ${logoImg ? `<img src="${logoImg.match(/src="([^"]+)"/)?.[1]||''}" style="position:absolute;left:0;top:0;max-height:60px"/>` : ''}
                    <div style="font-size:24px;font-weight:900;color:#1e40af;letter-spacing:1px">${restaurantName.toUpperCase()}</div>
                    <div style="font-size:12px;margin:2px 0;font-weight:bold">${user?.address || ''}</div>
                    <div style="font-size:12px">Phones : ${user?.phone || ''}  E-mail : ${user?.email || ''}</div>
                    <div style="font-size:11px;margin-top:4px">DL. No. ${user?.dlNumber || ''} TIN. No. ${user?.tinNumber || ''} GST No. ${user?.gstNumber || ''}</div>
                    <div style="font-size:11px">CIN No. ${user?.cinNumber || ''}</div>
                    ${logoImg ? `<img src="${logoImg.match(/src="([^"]+)"/)?.[1]||''}" style="position:absolute;right:0;top:0;max-height:60px"/>` : ''}
                  </div>

                  <div style="display:flex;justify-content:space-between;font-weight:700;border-top:2px solid #000;padding:4px 0">
                    <div>${restaurantName.toUpperCase()} SALES</div>
                    <div style="font-size:14px">Sales Bill</div>
                  </div>

                  <!-- BILL INFO GRID -->
                  <table width="100%" style="border-collapse:collapse;margin-bottom:10px">
                    <tr>
                        <td width="15%" style="border:1px solid #000;padding:4px">Bill No</td>
                        <td width="30%" style="border:1px solid #000;padding:4px;font-weight:900;font-size:14px">${jobBillNo || orderNumber || ''}</td>
                        <td rowspan="2" style="border:1px solid #000;text-align:center;vertical-align:middle;padding:5px">
                            <svg id="pharmacy-barcode-${jobBillNo || orderNumber || '0000'}"></svg>
                            <script>
                                if (window.JsBarcode) {
                                    JsBarcode("#pharmacy-barcode-${jobBillNo || orderNumber || '0000'}", "${jobBillNo || orderNumber || '0000'}", {
                                        format: "CODE128",
                                        lineColor: "#000",
                                        width: 1.5,
                                        height: 35,
                                        displayValue: true,
                                        fontSize: 12
                                    });
                                }
                            </script>
                        </td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000;padding:4px">Bill Date</td>
                        <td style="border:1px solid #000;padding:4px">${invoiceDate} ${invoiceTime}</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000;padding:4px">Reg.No</td>
                        <td colspan="2" style="border:1px solid #000;padding:4px">Reg No : ${jobCustomerFirm || '-'}</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000;padding:4px">Pat.Name</td>
                        <td colspan="2" style="border:1px solid #000;padding:4px;font-weight:700">${jobCustomerName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #000;padding:4px">Doc.Name</td>
                        <td colspan="2" style="border:1px solid #000;padding:4px">Dr. ${jobDoctorName || '-'}</td>
                    </tr>
                  </table>

                  <!-- ITEM TABLE -->
                  <table width="100%" style="border-collapse:collapse;margin-bottom:10px">
                    <thead>
                        <tr style="border:1px solid #000;background:#f8fafc">
                            <th style="border:1px solid #000;padding:4px;width:30px">S. No</th>
                            <th style="border:1px solid #000;padding:4px;width:70px">HSN</th>
                            <th style="border:1px solid #000;padding:4px">Description</th>
                            <th style="border:1px solid #000;padding:4px;width:70px">Batch</th>
                            <th style="border:1px solid #000;padding:4px;width:60px">Exp.dt</th>
                            <th style="border:1px solid #000;padding:4px;width:40px">Qty</th>
                            <th style="border:1px solid #000;padding:4px;width:60px">Price</th>
                            <th style="border:1px solid #000;padding:4px;width:70px">Amount</th>
                        </tr>
                    </thead>
                    <tbody style="min-height:300px">
                        ${itemRows}
                        <!-- Fill empty space -->
                        ${Array(Math.max(0, 10 - (items?.length || 0))).fill(0).map(() => `
                            <tr>
                                <td style="border-left:1px solid #000;border-right:1px solid #000;padding:8px"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                                <td style="border-right:1px solid #000;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:1px solid #000">
                            <td colspan="8" style="border:1px solid #000;padding:0"></td>
                        </tr>
                    </tfoot>
                  </table>

                  <!-- PAID STAMP -->
                  <div style="position:absolute;top:55%;left:40%;transform:rotate(-20deg);border:4px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.3);font-size:60px;font-weight:900;padding:10px 20px;border-radius:10px;pointer-events:none">PAID</div>

                  <!-- SUMMARY SECTION -->
                  <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div width="60%">
                        <div style="margin-bottom:10px;font-weight:bold">Total No.of Medicines : ${(items || []).length}</div>
                        <div style="font-weight:bold;margin-top:20px;font-size:12px">Included GST</div>
                    </div>
                    <div width="40%" style="text-align:right">
                        <table align="right" style="font-size:18px">
                            <tr style="font-size:18px">
                                <td style="padding:10px 10px 2px 10px;text-align:left"><b>Grand Total :</b></td>
                                <td style="padding:10px 0 2px 0"><b>Rs ${Math.round(grandTotalPharm).toFixed(2)}</b></td>
                            </tr>
                        </table>
                    </div>
                  </div>

                </div>`;
            };

            // ─── GST Bill A4 Invoice Template ───
            const getGstBillBody = () => {
                const invoiceDate = new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const discountRate = parseFloat(jobDiscountPct) || 0;
                const taxRate = typeof user?.taxRate === 'number' ? user.taxRate : 18;
                const sgstPct = taxRate / 2;
                const cgstPct = taxRate / 2;

                let grandTotalGst = 0;
                let totalTaxableSubtotal = 0;
                let totalCgstAmount = 0;
                let totalSgstAmount = 0;
                let totalTaxAmount = 0;

                const rawGrossSubtotal = (items || []).reduce((s, item) => s + (parseFloat(item.mrp || item.price || 0) * (parseFloat(item.quantity) || 0)), 0);

                const itemRows = (items || []).map((item, i) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const mrp = parseFloat(item.mrp || item.price) || 0; // unit price before discount
                    const finalSellingPrice = mrp * (1 - discountRate / 100);
                    const baseRate = jobPrintWithGst !== false ? finalSellingPrice * (1 - taxRate / 100) : finalSellingPrice;
                    const amount = +(baseRate * qty).toFixed(2);
                    
                    const cgst = jobPrintWithGst !== false ? finalSellingPrice * (cgstPct / 100) : 0;
                    const sgst = jobPrintWithGst !== false ? finalSellingPrice * (sgstPct / 100) : 0;
                    const taxPerUnit = cgst + sgst;
                    
                    const itemTax = taxPerUnit * qty;
                    const itemCgst = cgst * qty;
                    const itemSgst = sgst * qty;
                    
                    totalTaxableSubtotal += amount;
                    totalCgstAmount += itemCgst;
                    totalSgstAmount += itemSgst;
                    totalTaxAmount += itemTax;
                    grandTotalGst += (finalSellingPrice * qty);
                    
                    return `<tr>
                        <td style="border:1px solid #000;padding:2px 4px;text-align:center;">${i + 1}</td>
                        <td style="border:1px solid #000;padding:2px 4px;text-align:left;"><b>${item.name || ''}</b></td>
                        <td style="border:1px solid #000;padding:2px 4px;text-align:center;">${item.hsnCode || '-'}</td>
                        <td style="border:1px solid #000;padding:2px 4px;text-align:center;">${qty}</td>
                        <td style="border:1px solid #000;padding:2px 4px;text-align:right;">${baseRate.toFixed(2)}</td>
                        ${jobPrintWithGst !== false ? `
                        <td style="border:1px solid #000;padding:2px 4px;text-align:right;">${taxPerUnit.toFixed(2)}</td>
                        ` : ''}
                        <td style="border:1px solid #000;padding:2px 4px;text-align:right;">${amount.toFixed(2)}</td>
                    </tr>`;
                }).join('');

                return `
                <div style="font-family:Arial, sans-serif;font-size:12px;color:#000;width:210mm;margin:0 auto;padding:10px;position:relative;">
                  <table width="100%" style="border: 2px solid #000; border-collapse: collapse;">
                    <tr>
                      <td width="50%" style="border: 1px solid #000; padding: 10px; vertical-align: top;">
                        <h2 style="margin: 0; font-size: 22px; font-weight: bold;">${restaurantName.toUpperCase()}</h2>
                        <p style="margin: 5px 0 0 0;">${user?.address || ''}</p>
                        <p style="margin: 2px 0 0 0;">Phone: ${user?.phone || ''}</p>
                        <p style="margin: 2px 0 0 0;"><b>GSTIN:</b> ${user?.gstNumber || ''}</p>
                        <p style="margin: 2px 0 0 0;"><b>PAN:</b> ${user?.panNumber || ''}</p>
                      </td>
                      <td width="50%" style="border: 1px solid #000; padding: 10px; vertical-align: top;">
                        <h2 style="margin: 0; text-align: right; font-size: 20px;">TAX INVOICE</h2>
                        <table width="100%" style="margin-top: 10px;">
                          <tr><td><b>Invoice No:</b></td><td style="text-align: right">${jobBillNo || orderNumber || ''}</td></tr>
                          <tr><td><b>Invoice Date:</b></td><td style="text-align: right">${invoiceDate}</td></tr>
                          <tr><td><b>Email:</b></td><td style="text-align: right">${user?.email || ''}</td></tr>
                          <tr><td><b>FSSAI No:</b></td><td style="text-align: right">${user?.fssaiNumber || ''}</td></tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px 10px;">
                        <b>BILL TO</b><br/>
                        ${jobCustomerName ? `<b>${jobCustomerName}</b><br/>` : ''}
                        ${jobCustomerFirm ? `${jobCustomerFirm}<br/>` : ''}
                        ${jobCustomerPhone ? `Phone: ${jobCustomerPhone}<br/>` : ''}
                      </td>
                      <td style="border: 1px solid #000; padding: 5px 10px;">
                        <b>SHIP TO</b><br/>
                        ${jobCustomerName ? `<b>${jobCustomerName}</b><br/>` : ''}
                        ${jobCustomerFirm ? `${jobCustomerFirm}<br/>` : ''}
                        ${jobCustomerPhone ? `Phone: ${jobCustomerPhone}<br/>` : ''}
                      </td>
                    </tr>
                  </table>
                  
                  <!-- ITEM TABLE -->
                  <table width="100%" style="border: 2px solid #000; border-collapse: collapse; border-top: none; min-height: 400px;">
                    <thead>
                      <tr style="background: #f0f0f0;">
                        <th style="border: 1px solid #000; padding: 5px; width: 40px;">S.No</th>
                        <th style="border: 1px solid #000; padding: 5px;">Item</th>
                        <th style="border: 1px solid #000; padding: 5px; width: 80px;">HSN</th>
                        <th style="border: 1px solid #000; padding: 5px; width: 50px;">Qty</th>
                        <th style="border: 1px solid #000; padding: 5px; width: 80px;">Rate</th>
                        ${jobPrintWithGst !== false ? `
                        <th style="border: 1px solid #000; padding: 5px; width: 80px;">Tax/Unit</th>
                        ` : ''}
                        <th style="border: 1px solid #000; padding: 5px; width: 100px;">Amount</th>
                      </tr>
                    </thead>
                    <tbody style="vertical-align: top;">
                      ${itemRows}
                      <tr>
                        <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 10px;"></td>
                        <td style="border-right: 1px solid #000;"></td>
                        <td style="border-right: 1px solid #000;"></td>
                        <td style="border-right: 1px solid #000;"></td>
                        <td style="border-right: 1px solid #000;"></td>
                        ${jobPrintWithGst !== false ? `<td style="border-right: 1px solid #000;"></td>` : ''}
                        <td style="border-right: 1px solid #000;"></td>
                      </tr>
                    </tbody>
                  </table>

                  <table width="100%" style="border: 2px solid #000; border-collapse: collapse; border-top: none;">
                    <tr>
                      <td width="50%" style="border: 1px solid #000; padding: 10px; vertical-align: top;">
                        <div style="display:flex; justify-content: space-between; margin-bottom: 5px;">
                          <span>Received Amount:</span>
                          <b>₹${jobPaymentMethod !== 'CREDIT' ? grandTotalGst.toFixed(2) : '0.00'}</b>
                        </div>
                        <div style="display:flex; justify-content: space-between;">
                          <span>Balance Amount:</span>
                          <b>₹${jobPaymentMethod === 'CREDIT' ? grandTotalGst.toFixed(2) : '0.00'}</b>
                        </div>
                      </td>
                      <td width="50%" style="border: 1px solid #000; padding: 0;">
                        <table width="100%" style="border-collapse: collapse; height: 100%;">
                          <tr>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000;"><b>Gross Amount:</b></td>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000; width: 100px;"><b>₹${rawGrossSubtotal.toFixed(2)}</b></td>
                          </tr>
                          ${discountRate > 0 ? `
                          <tr>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000;"><b>Discount (${discountRate.toFixed(2)}%):</b></td>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000; width: 100px;"><b>₹${(rawGrossSubtotal * discountRate / 100).toFixed(2)}</b></td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000;"><b>Total Amount:</b></td>
                            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #000; width: 100px;"><b>₹${grandTotalGst.toFixed(2)}</b></td>
                          </tr>
                          ${jobPrintWithGst !== false ? `
                          <tr>
                            <td style="padding: 5px 10px; text-align: right;"><b>Grand Total:</b></td>
                            <td style="padding: 5px 10px; text-align: right; width: 100px;"><b>₹${grandTotalGst.toFixed(2)}</b></td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${jobPrintWithGst !== false ? `
                  <table width="100%" style="border: 2px solid #000; border-collapse: collapse; border-top: none;">
                    <tr style="background: #f0f0f0;">
                      <th style="border: 1px solid #000; padding: 5px;">HSN</th>
                      <th style="border: 1px solid #000; padding: 5px;">Taxable Amount</th>
                      <th style="border: 1px solid #000; padding: 5px;" colspan="2">CGST</th>
                      <th style="border: 1px solid #000; padding: 5px;" colspan="2">SGST</th>
                      <th style="border: 1px solid #000; padding: 5px;">Total Tax Amount</th>
                    </tr>
                    <tr style="background: #f0f0f0;">
                      <th style="border: 1px solid #000; padding: 5px;"></th>
                      <th style="border: 1px solid #000; padding: 5px;"></th>
                      <th style="border: 1px solid #000; padding: 5px;">Rate</th>
                      <th style="border: 1px solid #000; padding: 5px;">Amount</th>
                      <th style="border: 1px solid #000; padding: 5px;">Rate</th>
                      <th style="border: 1px solid #000; padding: 5px;">Amount</th>
                      <th style="border: 1px solid #000; padding: 5px;"></th>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">-</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${totalTaxableSubtotal.toFixed(2)}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${cgstPct.toFixed(1)}%</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${totalCgstAmount.toFixed(2)}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${sgstPct.toFixed(1)}%</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${totalSgstAmount.toFixed(2)}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${totalTaxAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;"><b>Total</b></td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;"><b>${totalTaxableSubtotal.toFixed(2)}</b></td>
                      <td style="border: 1px solid #000; padding: 5px;"></td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;"><b>${totalCgstAmount.toFixed(2)}</b></td>
                      <td style="border: 1px solid #000; padding: 5px;"></td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;"><b>${totalSgstAmount.toFixed(2)}</b></td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: right;"><b>${totalTaxAmount.toFixed(2)}</b></td>
                    </tr>
                  </table>
                  ` : ''}
                  
                  <table width="100%" style="border: 2px solid #000; border-collapse: collapse; border-top: none;">
                    <tr>
                      <td width="70%" style="border: 1px solid #000; padding: 10px; vertical-align: top;">
                        <b>Remark:</b><br/>
                        <div style="font-size: 10px; margin-top: 5px;">
                          <b>Terms & Conditions:</b><br/>
                          1. Goods once sold will not be taken back.<br/>
                          2. Interest @ 18% p.a. will be charged if payment is delayed.
                        </div>
                        <div style="margin-top: 10px;">
                          <b>Bank Details:</b><br/>
                          A/c Name: ${user?.bankAccountName || restaurantName}<br/>
                          A/c No: ${user?.bankAccountNumber || '-'}<br/>
                          Bank: ${user?.bankName || '-'}<br/>
                          IFSC: ${user?.bankIfsc || '-'}
                        </div>
                      </td>
                      <td width="30%" style="border: 1px solid #000; padding: 10px; vertical-align: bottom; text-align: right;">
                        <div>For <b>${restaurantName.toUpperCase()}</b></div>
                        <br/><br/><br/>
                        <div>Authorised Signatory</div>
                      </td>
                    </tr>
                  </table>

                </div>`;
            };

            const billHTML = (isPharmacy || isGstBill) ? `
                <html><head><title>BILL - ${jobBillNo || orderNumber}</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; }
                    * { box-sizing: border-box; }
                    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
                </head>
                <body>${isPharmacy ? getPharmacyBillBody() : getGstBillBody()}</body></html>
            ` : `
                <html>
                <head>
                    <title>${t('bill.receipt', 'Bill')} - ${table}</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        body { 
                            font-family: 'Mukta Malar', 'Latha', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; 
                            width: 72mm; 
                            margin: 0 auto;
                            padding: 2mm 0;
                            box-sizing: border-box;
                            font-size: ${printLang === 'ta' ? '12px' : '14px'};
                            color: #000;
                            overflow-x: hidden;
                            line-height: 1.2;
                        }
                        .center { text-align: center; }
                        .header { padding: 2px 0; }
                        table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 5px 0; }
                        th, td { padding: 2px 2px; text-align: left; border-bottom: none; word-wrap: break-word; overflow-wrap: break-word; }
                        .total { font-weight: bold; padding: 5px 10px; }
                        .logo { max-height: 55px; max-width: 140px; margin-bottom: 2px; object-fit: contain; }
                        .software-ref { font-size: 9px; margin-top: 5px; color: #444; border-top: 1px dotted #ccc; padding-top: 3px; }
                        .bold { font-weight: bold; }
                        @media print { body { width: 80mm; } }
                    </style>
                </head>
                <body>
                    ${getBillBody()}
                </body>
                </html>
            `;


            printWindow.document.open();
            printWindow.document.write(billHTML);
            printWindow.document.close();

            await new Promise(resolve => {
                const img = printWindow.document.querySelector('img');
                if (img && !img.complete) {
                    img.onload = resolve;
                    img.onerror = resolve;
                    setTimeout(resolve, 1000);
                } else {
                    setTimeout(resolve, 300);
                }
            });

            printWindow.print();

            // Small delay between jobs to allow the printer/browser to reset
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        isPrintingRef.current = false;
    };

    const filteredMenu = menuItems.filter(item => {
        const catMatch = activeCategory === CATEGORIES_ALL || item.category === activeCategory
        const searchMatch = !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase())
        return catMatch && searchMatch
    })

    return (
        <div className="pos-page">
            {notification && <div className="pos-toast">{notification}</div>}

            {supermarketMode ? (
                <SupermarketPOS printBill={printBill} />
            ) : (
                <>
                    {/* COLUMN 1: TABLES */}
                    <div className="pos-column pos-tables">
                <div className="panel table-panel">
                    <div className="panel-header" style={{ padding: '12px 10px' }}>
                        <span className="panel-title">Tables</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button 
                                className={`primary-btn ${waitlistCount > 0 ? 'pulse-badge' : ''}`} 
                                style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '11px', 
                                    borderRadius: '2px',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    lineHeight: 1,
                                    backgroundColor: waitlistCount > 0 ? 'var(--accent)' : 'transparent',
                                    color: waitlistCount > 0 ? 'var(--accent-text)' : 'var(--text-primary)',
                                    border: waitlistCount > 0 ? 'none' : '1px solid var(--border)'
                                }}
                                onClick={() => setShowQueueModal(true)}
                            >
                                Queue <span>👥</span>
                                {waitlistCount > 0 && (
                                    <span style={{
                                        background: 'var(--accent-text)', 
                                        color: 'var(--accent)', 
                                        borderRadius: '2px', 
                                        padding: '1px 6px', 
                                        fontWeight: 'bold'
                                    }}>
                                        {waitlistCount}
                                    </span>
                                )}
                            </button>
                            <span 
                                className="panel-badge occupied-badge"
                                style={{ 
                                    whiteSpace: 'nowrap',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    lineHeight: 1
                                }}
                            >
                                {Object.values(orders).filter(o => o.status !== 'PAID').length} Busy
                            </span>
                        </div>
                    </div>
                    
                    <div className="takeaway-section">
                        <div className="takeaway-header-row">
                            <span className="section-subtitle">Takeaway Line</span>
                            <button className={`new-takeaway-btn ${selectedTable === 'Takeaway' ? 'active' : ''}`} onClick={() => selectTable('Takeaway')}>+ New</button>
                        </div>
                        <div className="takeaway-line">
                            {Object.keys(orders).filter(k => k.startsWith('Takeaway-T')).map(k => (
                                <button key={k} className={`takeaway-token-btn ${selectedTable === k ? 'selected' : ''}`} onClick={() => selectTable(k)}>
                                    <span className="token-label">T</span>
                                    <span className="token-val">{orders[k].tokenNumber || '...'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="table-categories-list" style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                        {(() => {
                            const tableCats = (typeof user?.tableCategories === 'string' ? JSON.parse(user.tableCategories) : user?.tableCategories) || [];
                            const tableMeta = (typeof user?.tableMetadata === 'string' ? JSON.parse(user.tableMetadata) : user?.tableMetadata) || {};

                            const groupedTables = {};
                            const totalT = user?.totalTables || 10;
                            
                            for (let i = 1; i <= totalT; i++) {
                                const loc = tableMeta[i]?.location || 'Uncategorized';
                                if (!groupedTables[loc]) groupedTables[loc] = [];
                                groupedTables[loc].push(i);
                            }

                            const displayCats = tableCats.length > 0 
                                ? [...tableCats, ...(groupedTables['Uncategorized'] ? ['Uncategorized'] : [])]
                                : ['All Tables'];
                            
                            if (tableCats.length === 0) groupedTables['All Tables'] = groupedTables['Uncategorized'] || [];

                            return displayCats.map(cat => {
                                const tablesInCat = groupedTables[cat] || [];
                                if (tablesInCat.length === 0) return null;

                                return (
                                    <div key={cat} className="table-category-group" style={{ marginBottom: '15px' }}>
                                        {tableCats.length > 0 && (
                                            <div className="section-subtitle" style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', sticky: 'top', zIndex: 1 }}>
                                                {cat}
                                            </div>
                                        )}
                                        <div className="table-grid">
                                            {tablesInCat.map(num => {
                                                const status = getTableStatus(num);
                                                const key = `Table ${num}`;
                                                const isSelected = selectedTable === key;
                                                const order = orders[key];
                                                const parentMergedOrder = Object.values(orders).find(o => o && o.mergedTables && o.mergedTables.includes(key));

                                                let totalItems = 0;
                                                let readyItems = 0;
                                                if (order && order.items) {
                                                    totalItems = order.items.length;
                                                    readyItems = order.items.filter(i => i.status === 'ready' || i.status === 'served').length;
                                                }
                                                const isAllReady = totalItems > 0 && readyItems === totalItems;

                                                const handleClick = () => {
                                                    if (parentMergedOrder) selectTable(parentMergedOrder.tableNumber);
                                                    else selectTable(num);
                                                };

                                                const displayNum = parentMergedOrder ? `${num}🔗` : 
                                                                 (order?.mergedTables ? `${num}, ${order.mergedTables.replace(/Table /g, '')}` : num);

                                                return (
                                                    <button
                                                        key={num}
                                                        className={`table-btn ${status} ${isSelected ? 'selected' : ''} ${isAllReady ? 'all-ready' : ''} ${order?.status ? `status-${order.status.toLowerCase()}` : ''} ${parentMergedOrder ? 'merged-source' : ''}`}
                                                        onClick={handleClick}
                                                    >
                                                        <span className="table-num">{displayNum}</span>
                                                        {status === 'occupied' && <span className="table-dot" />}
                                                        {(() => {
                                                            const baseKey = `Table ${num}`
                                                            const activeSets = Object.keys(orders).filter(k => k === baseKey || k.startsWith(`${baseKey} - Set`)).length;
                                                            if (activeSets > 1) return <span className="set-count-badge">{activeSets}</span>
                                                            return null
                                                        })()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* 
                        REMOVED: Split tables now integrated into main table sets.
                    */}
                </div>
            </div>

            {/* COLUMN 2: ORDER REVIEW */}
            <div className="pos-column pos-order">
                <div className="panel order-panel">
                    <div className="panel-tab-header">
                        <button 
                            className={`panel-tab-btn ${sidebarTab === 'general' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('general')}
                        >
                            📋 General
                        </button>
                        <button 
                            className={`panel-tab-btn ${sidebarTab === 'order' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('order')}
                        >
                            🛒 Current Order
                        </button>
                    </div>

                    <div className="panel-header premium-sidebar-header">
                        <div className="panel-header-top">
                            <span className="panel-title">{sidebarTab === 'general' ? 'Table Details' : 'Current Order'}</span>
                            {selectedTable && (
                                <div className="table-badge-small">
                                    {selectedTable === 'Takeaway' ? '🥡' : `T${selectedTable.replace('Table ', '').split(' - ')[0]}`}
                                </div>
                            )}
                        </div>
                        {selectedTable && selectedTable.startsWith('Table ') && (
                            <div className="table-meta-actions-row">
                                {(() => {
                                    const baseTable = selectedTable.split(' - Set')[0];
                                    const backendSets = Object.keys(orders).filter(k => k === baseTable || k.startsWith(`${baseTable} - Set`));
                                    const trackedLocalSets = localSets[baseTable] || [baseTable];
                                    const allSets = Array.from(new Set([...backendSets, ...trackedLocalSets])).sort();
                                    
                                    return (
                                        <>
                                            <div className="set-management-mini">
                                                <div className="set-switcher-compact">
                                                    {allSets.map((setKey, idx) => (
                                                        <div key={setKey} className="set-btn-mini-wrap">
                                                            <button 
                                                                className={`set-btn-mini ${selectedTable === setKey ? 'active' : ''}`}
                                                                onClick={() => selectTable(setKey)}
                                                            >
                                                                S{idx + 1}
                                                            </button>
                                                            {/* Bug 1: S1 (base table, idx===0) is non-removable; only extra sets can be removed */}
                                                            {idx > 0 && (
                                                                <button
                                                                    className="set-remove-mini"
                                                                    title={`Remove ${setKey}`}
                                                                    onClick={(e) => { e.stopPropagation(); removeSet(setKey, allSets); }}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button 
                                                        className="add-set-btn-mini"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const nextIdx = allSets.length + 1;
                                                            const newSetKey = `${baseTable} - Set ${nextIdx}`;
                                                            setLocalSets(prev => ({
                                                                ...prev,
                                                                [baseTable]: [...(prev[baseTable] || [baseTable]), newSetKey]
                                                            }));
                                                            selectTable(newSetKey);
                                                            setSidebarTab('order');
                                                        }}
                                                        title="Add Set"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                className="merge-action-btn-mini"
                                                onClick={(e) => { e.stopPropagation(); setShowCombineModal(true); }}
                                                title="Merge Tables"
                                            >
                                                🔗 Merge
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {selectedTable === 'Takeaway' && tokenNumber && sidebarTab === 'order' && (
                        <div className="token-badge">
                            <span className="token-label">TOKEN</span>
                            <span className="token-number">{tokenNumber}</span>
                        </div>
                    )}

                    {!selectedTable ? (
                        <div className="order-empty">
                            <span>👈</span>
                            <p>{t('pos.select_table_hint')}</p>
                        </div>
                    ) : sidebarTab === 'general' ? (
                        <div className="table-details-view">
                            <div className="table-details-card">
                                <div className="table-details-number">
                                    {(() => {
                                        const text = selectedTable.replace('Table ', '');
                                        if (text.includes(' - Set ')) {
                                            const [num, setPart] = text.split(' - Set ');
                                            const setNum = setPart.trim();
                                            return (
                                                <div className="table-details-set-display">
                                                    <span className="big-num">{num}</span>
                                                    <span className="small-set">SET {setNum}</span>
                                                </div>
                                            );
                                        }
                                        return text;
                                    })()}
                                </div>
                                <div className="table-details-info">
                                    {(() => {
                                        const baseNum = selectedTable.replace('Table ', '').split(' - Set')[0];
                                        return (
                                            <>
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('common.status')}</span>
                                                    <span className={`detail-value status-pill ${orders[selectedTable] ? 'occupied' : 'free'}`}>
                                                        {orders[selectedTable] ? t('common.occupied') : t('common.free')}
                                                    </span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('pos.seats')}</span>
                                                    <span className="detail-value">
                                                        {(() => {
                                                            const currentOrder = orders[selectedTable];
                                                            let totalSeats = Number(tableMetadata[baseNum]?.seats || 0);
                                                            if (currentOrder?.mergedTables) {
                                                                const others = currentOrder.mergedTables.split(',').map(t => t.trim().replace('Table ', ''));
                                                                others.forEach(tNum => {
                                                                    if (tNum !== baseNum && tableMetadata[tNum]) {
                                                                        totalSeats += Number(tableMetadata[tNum].seats || 0);
                                                                    }
                                                                });
                                                            }
                                                            return totalSeats || 'N/A';
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('common.location')}</span>
                                                    <span className="detail-value">{tableMetadata[baseNum]?.location || t('pos.not_specified')}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">{t('pos.area_type')}</span>
                                                    <span className="detail-value">{isAcTable ? t('pos.ac_area') : t('pos.general_area')}</span>
                                                </div>

                                                {orders[selectedTable]?.mergedTables && (
                                                    <div className="merged-tables-details">
                                                        <h4 className="merge-list-title">🔗 Currently Merged</h4>
                                                        <div className="merge-pill-container">
                                                            {orders[selectedTable].mergedTables.split(',').map(t => t.trim()).map(tableNum => (
                                                                <div key={tableNum} className="merge-pill-item">
                                                                    <span>{tableNum}</span>
                                                                    <button 
                                                                        className="unmerge-pill-btn"
                                                                        onClick={(e) => { e.stopPropagation(); handleUnmerge(tableNum); }}
                                                                        title={`Unmerge ${tableNum}`}
                                                                        disabled={savingOrder}
                                                                        style={{ position: 'relative', zIndex: 100, pointerEvents: 'auto' }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                            {!orders[selectedTable] && (
                                <div className="start-order-hint">
                                    ** Select items from the menu to start ordering **
                                </div>
                            )}
                        </div>
                    ) : cart.length === 0 ? (
                        <div className="order-empty">
                            <span>🍴</span>
                            <p>Cart is empty. Add items from the menu →</p>
                        </div>
                    ) : (
                        <>
                            <div className="cart-items">
                                {cart.map((item, idx) => (
                                    <div key={item._id || `new-${idx}`} className={`cart-item ${item.status === 'served' ? 'served' : ''}`}>
                                        <div className="cart-item-info">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="cart-item-name">{(showTamilName && item.tamilName) ? item.tamilName : item.name}</span>
                                                {item.status && (item.status.toLowerCase() === 'ready' || item.status.toLowerCase() === 'served') && (
                                                    <span className="item-status-badge">
                                                        {item.status.toLowerCase() === 'served' ? 'Served' : 'Ready'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="cart-item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                        <div className="cart-item-qty">
                                            <button className="qty-btn" onClick={() => updateQty(item._id || item.menuItemId, -1)} disabled={item.status === 'served'}>−</button>
                                            <span>{item.quantity}</span>
                                            <button className="qty-btn" onClick={() => updateQty(item._id || item.menuItemId, 1)} disabled={item.status === 'served'}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="cart-summary-compact">
                                <div className="summary-header-compact">
                                    <div className="compact-total">
                                        <span className="total-label">{t('common.total')}</span>
                                        <span className="total-value">₹{(cartTotal + orderExtraCharges.reduce((s,c) => s + Number(c.amount||0), 0)).toFixed(2)}</span>
                                    </div>
                                    <button className="review-btn-compact" onClick={() => setShowReviewModal(true)}>
                                        🔍 {t('pos.review_order')}
                                    </button>
                                </div>

                                <div className="compact-actions-grid single-action">
                                    <button
                                        className="compact-btn kot"
                                        onClick={saveOrder}
                                        disabled={cart.length === 0 || savingOrder}
                                    >
                                        👨‍🍳 {savingOrder ? '...' : 'KOT'}
                                    </button>
                                    <button
                                        className="compact-btn settle"
                                        onClick={handlePrintAndClose}
                                        disabled={!orders[selectedTable] || savingOrder}
                                    >
                                        🧾 {t('bill.receipt')}
                                    </button>
                                </div>
                                <div className="compact-actions-grid single-action" style={{ marginTop: '5px' }}>
                                    <button
                                        className="compact-btn"
                                        onClick={handleA4Invoice}
                                        disabled={!orders[selectedTable] || savingOrder}
                                        style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: '#fff' }}
                                    >
                                        📄 A4 PDF
                                    </button>
                                    <button
                                        className="compact-btn"
                                        onClick={handleWhatsApp}
                                        disabled={!orders[selectedTable] || savingOrder}
                                        style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff' }}
                                    >
                                        💬 WhatsApp
                                    </button>
                                </div>
                                <button 
                                    className="compact-cancel-btn" 
                                    onClick={(e) => { e.stopPropagation(); closeOrder(); }}
                                    disabled={savingOrder}
                                    style={{ position: 'relative', zIndex: 50, pointerEvents: 'auto' }}
                                >
                                     ✕ {t('common.cancel')} {t('pos.cart')}
                                </button>
                                
                                {scalePort ? (
                                    <div className="scale-controls-pos">
                                        <div className="scale-data">
                                            <span className="label">Live Weight:</span>
                                            <span className="val">{scaleWeight.toFixed(3)} KG</span>
                                        </div>
                                        <button className="apply-scale-btn" onClick={() => {
                                            if (cart.length > 0) {
                                                const lastItem = cart[cart.length - 1];
                                                applyWeightToItem(lastItem._id || lastItem.menuItemId || lastItem.inventoryItemId, scaleWeight);
                                            }
                                        }}>
                                            Apply to Last Item
                                        </button>
                                    </div>
                                ) : (
                                    <button className="connect-scale-pos-btn" onClick={connectScale}>
                                        ⚖️ {t('pos.connect_scale')}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* COLUMN 3: MENU */}
            <div className="pos-column pos-menu">
                {/* Search + Category Filter */}
                <div className="menu-header">
                    <input
                        className="menu-search"
                        placeholder={`🔍  ${t('pos.search_placeholder')}`}
                        value={menuSearch}
                        onChange={e => setMenuSearch(e.target.value)}
                    />
                    <div className="category-tabs">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <button
                        className={`staff-mode-btn ${staffMode ? 'active' : ''}`}
                        onClick={() => setStaffMode(!staffMode)}
                        title={t('pos.staff_mode_title')}
                    >
                        {staffMode ? `🔒 ${t('pos.staff_mode_on')}` : `🔑 ${t('pos.staff_mode_off')}`}
                    </button>
                </div>

                {/* Menu Item Grid */}
                <div className="menu-grid" style={{ gridTemplateColumns: `repeat(${user?.menuItemColumnCount || 4}, 1fr)` }}>
                    {filteredMenu.map(item => (
                        <div key={item._id} className="menu-item-container" style={{ position: 'relative' }}>
                            {(() => {
                                const cartItem = cart.find(c => c.menuItemId === item._id || c._id === item._id);
                                const qty = cartItem ? cartItem.quantity : 0;
                                return (
                                    /* Bug 7: wrapper div with overflow: visible so badge isn't clipped */
                                    <div style={{ position: 'relative', overflow: 'visible' }}>
                                        <button
                                            className={`menu-item-card ${qty > 0 ? 'selected' : ''} ${!item.isAvailable ? 'out-of-stock' : ''}`}
                                            onClick={() => item.isAvailable && addToCart(item)}
                                            disabled={!selectedTable || !item.isAvailable}
                                            title={!item.isAvailable ? `${(showTamilName && item.tamilName) ? item.tamilName : item.name} ${t('pos.is_out_of_stock')}` : (selectedTable ? `${t('common.add')} ${(showTamilName && item.tamilName) ? item.tamilName : item.name}` : t('pos.select_table_hint'))}
                                            style={{ position: 'relative' }}
                                        >
                                            <div className={`veg-dot ${item.isVeg ? 'veg' : 'nonveg'}`} />
                                            <div className="menu-item-name">{(showTamilName && item.tamilName) ? item.tamilName : item.name}</div>
                                            <div className="menu-item-category">{item.category}</div>
                                            <div className="menu-item-price">₹{getEffectivePrice(item.price)}</div>
                                            {!item.isAvailable && <div className="out-of-stock-badge">{t('pos.set_out_of_stock').toUpperCase()}</div>}
                                        </button>
                                        {/* Bug 7: badge outside button so overflow: visible works */}
                                        {qty > 0 && <div className="item-qty-badge">{qty}</div>}
                                    </div>
                                );
                            })()}
                            {/* Bug 5: Staff mode toggle - e.stopPropagation ensures it doesn't bubble to parent */}
                            {staffMode && (
                                <button
                                    className={`item-availability-toggle ${item.isAvailable ? 'available' : 'oos'}`}
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleAvailability(item); }}
                                >
                                    {item.isAvailable ? t('pos.set_out_of_stock') : t('pos.set_available')}
                                </button>
                            )}
                        </div>
                    ))}
                    {filteredMenu.length === 0 && (
                        <div className="menu-empty">No items found</div>
                    )}
                </div>
            </div>

            {/* MODALS */}

            {showCombineModal && (
                <div className="pos-modal">
                    <div className="modal-content combine-modal-premium">
                        <div className="modal-header-premium">
                            <h2>{t('pos.combine_order')}</h2>
                            <p>{t('pos.select_target_table', { table: selectedTable })}</p>
                            <button className="close-btn" onClick={() => setShowCombineModal(false)}>×</button>
                        </div>
                        
                        <div className="modal-body-premium">
                            <div className="table-selection-grid">
                                {Array.from({ length: user?.totalTables || 10 }, (_, i) => i + 1).map(num => {
                                    const key = `Table ${num}`;
                                    if (key === selectedTable) return null;
                                    const isOccupied = !!orders[key];
                                    const isSelected = combineTargetTable === key || combineTargetTable === String(num);

                                    return (
                                        <div
                                            key={num}
                                            className={`selectable-table-item ${isOccupied ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setCombineTargetTable(key)}
                                        >
                                            <span className="table-num">{num}</span>
                                            {isOccupied && <span className="occupied-indicator" title="Occupied" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-footer premium">
                            <button className="secondary-btn" onClick={() => setShowCombineModal(false)}>{t('common.cancel')}</button>
                            <button className="primary-btn-premium" onClick={handleCombine} disabled={savingOrder || !combineTargetTable}>
                                {savingOrder ? t('pos.combining') : t('pos.confirm_combine')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPaymentModal && (
                <div className="pos-modal">
                    <div className="modal-content payment-modal">
                        <div className="modal-header">
                            <h2>{t('pos.select_payment_method')}</h2>
                            <button className="close-btn" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        
                        <div className="payment-summary">
                            <span className="summary-label">{t('pos.amount_due')}</span>
                            <span className="summary-val">₹{cartTotal.toLocaleString()}</span>
                        </div>

                        <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>Print Bill with GST</span>
                            <label className="switch" style={{ margin: 0 }}>
                                <input type="checkbox" checked={settleWithGst} onChange={e => setSettleWithGst(e.target.checked)} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="payment-options-grid">
                            <button 
                                className={`payment-option-card ${paymentMethod === 'cash' ? 'active' : ''}`}
                                onClick={() => setPaymentMethod('cash')}
                            >
                                <span className="option-icon">💵</span>
                                <span className="option-name">{t('pos.cash')}</span>
                            </button>
                            <button 
                                className={`payment-option-card ${paymentMethod === 'upi' ? 'active' : ''}`}
                                onClick={() => setPaymentMethod('upi')}
                            >
                                <span className="option-icon">📱</span>
                                <span className="option-name">{t('pos.upi_scan')}</span>
                            </button>
                            <button 
                                className={`payment-option-card ${paymentMethod === 'card' ? 'active' : ''}`}
                                onClick={() => setPaymentMethod('card')}
                            >
                                <span className="option-icon">💳</span>
                                <span className="option-name">{t('pos.card_chip')}</span>
                            </button>
                        </div>

                        <div className="modal-footer" style={{ marginTop: 30 }}>
                            <button className="secondary-btn" onClick={() => setShowPaymentModal(false)}>{t('common.back')}</button>
                            <button 
                                className="confirm-settle-btn" 
                                onClick={() => settleOrder(paymentMethod)}
                            >
                                {t('pos.complete_settlement')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReviewModal && cart.length > 0 && (
                <div className="pos-modal review-modal">
                    <div className="modal-content large">
                        <div className="modal-header">
                            <h2>{t('pos.review_items_title', { table: selectedTable })}</h2>
                            <button className="close-btn" onClick={() => { setShowReviewModal(false); setTempExtraCharges([]); setTempChargeName(''); setTempChargeAmount(''); }}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="review-items-container">
                                <table className="review-table">
                                    <thead>
                                        <tr>
                                            <th>{t('common.name')}</th>
                                            <th>{t('common.quantity')}</th>
                                            <th>{t('common.price')}</th>
                                            <th>{t('common.total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cart.map((item, idx) => {
                                            const itemId = item._id || item.menuItemId;
                                            const isSentToKot = !!item._id;
                                            const existingOrder = orders[selectedTable];
                                            const orderCreatedAt = existingOrder?.createdAt ? new Date(existingOrder.createdAt).getTime() : Date.now();
                                            const diffMins = (Date.now() - orderCreatedAt) / 60000;
                                            const isEditable = item.status !== 'served' && (!isSentToKot || diffMins <= 3);
                                            return (
                                                <tr key={itemId || idx}>
                                                    <td>
                                                        <div className="review-item-name-cell">
                                                            <span className="review-item-name">{(showTamilName && item.tamilName) ? item.tamilName : item.name}</span>
                                                            {item.status && item.status.toLowerCase() === 'served' && <span className="badge-served">{t('pos.served')}</span>}
                                                            {item.status && item.status.toLowerCase() === 'ready' && <span className="badge-ready">{t('pos.ready')}</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="review-qty-controls">
                                                            <button
                                                                className="review-qty-btn minus"
                                                                onClick={() => updateQty(itemId, -1)}
                                                                disabled={!isEditable}
                                                            >−</button>
                                                            <span className="review-qty-val">{item.quantity}</span>
                                                            <button
                                                                className="review-qty-btn plus"
                                                                onClick={() => updateQty(itemId, 1)}
                                                                disabled={!isEditable}
                                                            >+</button>
                                                        </div>
                                                    </td>
                                                    <td>₹{item.price}</td>
                                                    <td>
                                                        <div className="review-price-cell">
                                                            <span>₹{item.price * item.quantity}</span>
                                                            {isEditable && (
                                                                <button
                                                                    className="review-remove-btn"
                                                                    onClick={(e) => { e.stopPropagation(); removeItemFromCart(item); }}
                                                                    title="Remove Item"
                                                                    style={{ position: 'relative', zIndex: 5 }}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="review-summary">
                                <div className="summary-row" style={{ borderBottom: '1px dashed #ddd', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <span>{t('common.subtotal', 'Subtotal')}</span>
                                    <span>₹{cartTotal.toFixed(2)}</span>
                                </div>

                                {[...orderExtraCharges.map((c,i) => ({...c, _idx: i, _type: 'order'})), ...tempExtraCharges.map((c,i) => ({...c, _idx: i, _type: 'temp'}))].map((c, idx) => {
                                    const amountAbs = Math.abs(c.amount);
                                    let percentage = 0;
                                    if (c.amount < 0 && cartTotal > 0) percentage = ((amountAbs / cartTotal) * 100).toFixed(1);
                                    
                                    return (
                                        <div key={'all-chg-'+idx} className="summary-row" style={{ color: c.amount < 0 ? '#22c55e' : 'inherit' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {c._type === 'temp' ? '⏳ ' : '✓ '}
                                                {c.amount < 0 && c.name === 'Discount' ? t('common.discount', 'Discount') : c.name}
                                                {percentage > 0 ? ` (${percentage}%)` : ''}
                                                <button onClick={() => {
                                                    if (c._type === 'temp') setTempExtraCharges(prev => prev.filter((_, i) => i !== c._idx));
                                                    else setOrderExtraCharges(prev => prev.filter((_, i) => i !== c._idx));
                                                }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }} title="Remove">×</button>
                                            </span>
                                            <span>{c.amount < 0 ? `-₹${amountAbs.toFixed(2)}` : `₹${amountAbs.toFixed(2)}`}</span>
                                        </div>
                                    );
                                })}

                                <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <select 
                                            className="form-input" 
                                            style={{ padding: '6px', flex: 1 }}
                                            value={tempChargeType} 
                                            onChange={e => {
                                                setTempChargeType(e.target.value);
                                                if (e.target.value !== 'Custom') {
                                                    setTempChargeName(e.target.value);
                                                } else {
                                                    setTempChargeName('');
                                                }
                                            }}
                                        >
                                            <option value="">{t('pos.select_charge', 'Select Charge')}</option>
                                            <option value="Discount">{t('common.discount', 'Discount')}</option>
                                            <option value="Custom">{t('pos.custom_charge', 'Custom')}</option>
                                        </select>
                                        {tempChargeType === 'Custom' && (
                                            <input type="text" className="form-input" style={{ padding: '6px', width: '100px' }} placeholder={t('common.name', 'Name')} value={tempChargeName} onChange={e => setTempChargeName(e.target.value)} />
                                        )}
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            style={{ padding: '6px', width: '70px' }} 
                                            placeholder="₹" 
                                            min="0"
                                            value={tempChargeAmount} 
                                            onChange={e => setTempChargeAmount(e.target.value)} 
                                        />
                                        <button 
                                            className="secondary-btn" 
                                            style={{ padding: '6px 12px' }}
                                            onClick={() => {
                                                if (tempChargeName && tempChargeAmount) {
                                                    const amount = Number(tempChargeAmount);
                                                    const isDiscount = (tempChargeName === 'Discount');
                                                    if (!isDiscount && amount < 0) {
                                                        alert(t('pos.extra_charges_positive'));
                                                        return;
                                                    }
                                                    const absAmount = Math.abs(amount);
                                                    const finalAmount = isDiscount ? -absAmount : absAmount;
                                                    setTempExtraCharges(prev => [...prev, { 
                                                        name: tempChargeName === 'Custom' ? 'Custom Charge' : tempChargeName, 
                                                        amount: finalAmount 
                                                    }]);
                                                    setTempChargeType('');
                                                    setTempChargeName('');
                                                    setTempChargeAmount('');
                                                }
                                            }}>{t('common.add')}</button>
                                    </div>
                                </div>
                                <div className="summary-row total">
                                    <span>{t('bill.total')}</span>
                                    <span>₹{(cartTotal + (orderExtraCharges?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0) + (tempExtraCharges?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0)).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="secondary-btn" onClick={() => { setShowReviewModal(false); setTempExtraCharges([]); setTempChargeName(''); setTempChargeAmount(''); }}>{t('pos.close_review')}</button>
                                <button 
                                    className="secondary-btn" 
                                    style={{ borderColor: '#ef4444', color: '#ef4444', position: 'relative', zIndex: 10, pointerEvents: 'auto' }} 
                                    onClick={(e) => { e.stopPropagation(); setShowReviewModal(false); closeOrder(); }}
                                >
                                    Cancel Entire Order
                                </button>
                            </div>
                            <button className="primary-btn" onClick={() => {
                                // Bug 9: Commit temp charges to orderExtraCharges on confirm
                                if (tempExtraCharges.length > 0) {
                                    setOrderExtraCharges(prev => [...prev, ...tempExtraCharges]);
                                }
                                setTempExtraCharges([]);
                                setTempChargeName('');
                                setTempChargeAmount('');
                                setShowReviewModal(false);
                                saveOrder();
                            }} disabled={savingOrder || cart.length === 0}>
                                {savingOrder ? t('pos.processing') : t('pos.confirm_send_kot')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanning HUD */}
            {(scanning || lastScannedItem) && (
                <div className={`scanning-hud ${scanning ? 'active' : ''}`}>
                    <div className="hud-content">
                        {scanning ? (
                            <div className="scanning-pulse">
                                <span className="scanner-line" />
                                <span className="hud-text">{t('pos.reading_barcode')}</span>
                            </div>
                        ) : (
                            <div className="scan-success">
                                <span className="hud-icon">✓</span>
                                <div className="hud-details">
                                    <span className="hud-label">{t('pos.added_to_bill')}</span>
                                    <span className="hud-val">{lastScannedItem?.name} - ₹{lastScannedItem?.price}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Scale Overlay (Optional) */}
            {scalePort && (
                <div className="scale-hud-mini">
                    <span className="scale-icon">⚖️</span>
                    <span className="scale-val">{scaleWeight.toFixed(3)} KG</span>
                </div>
            )}
                </>
            )}
            
            {showQueueModal && (
                <QueueManagementModal 
                    restaurantId={restaurantId}
                    socket={socket}
                    onClose={() => setShowQueueModal(false)}
                    onSeatCustomer={(q) => {
                        notify(t('pos.customer_seated', { name: q.customerName }));
                        setShowQueueModal(false);
                    }}
                />
            )}
            
            {/* Print Language Selection Modal */}
            {showPrintLangModal && (
                <div className="pos-modal" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '360px', textAlign: 'center', padding: '32px 28px' }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧾</div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                            {t('bill.print_language_title', 'Print Bill In')}
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '22px' }}>
                            {t('bill.print_language_hint', 'Choose the language for the printed receipt')}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => handlePrintWithLanguage('en')}
                                style={{
                                    flex: 1,
                                    padding: '14px 0',
                                    borderRadius: '10px',
                                    border: '2px solid #3b82f6',
                                    background: '#3b82f6',
                                    color: '#fff',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span style={{ fontSize: '22px' }}>🇬🇧</span>
                                <span>English</span>
                            </button>
                            <button
                                onClick={() => handlePrintWithLanguage('ta')}
                                style={{
                                    flex: 1,
                                    padding: '14px 0',
                                    borderRadius: '10px',
                                    border: '2px solid #f59e0b',
                                    background: '#f59e0b',
                                    color: '#fff',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span style={{ fontSize: '22px' }}>🇮🇳</span>
                                <span>தமிழ்</span>
                            </button>
                        </div>
                        <button
                            onClick={() => { setShowPrintLangModal(false); setPendingPrintOrder(null); }}
                            style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden iframe for professional silent printing */}
            <iframe
                id="print-iframe"
                title="print-iframe"
                style={{ 
                    position: 'absolute', 
                    top: '-10000px', 
                    left: '-10000px', 
                    width: '0px', 
                    height: '0px', 
                    border: 'none',
                    visibility: 'hidden'
                }}
            />
        </div>
    )
}
