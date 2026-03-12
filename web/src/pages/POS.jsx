import React, { useState, useEffect, useCallback } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import './POS.css'

const TOTAL_TABLES = 20
const CATEGORIES_ALL = 'All'

export default function POSPage() {
    const [tables, setTables] = useState([])
    const [selectedTable, setSelectedTable] = useState(null)
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([CATEGORIES_ALL])
    const [activeCategory, setActiveCategory] = useState(CATEGORIES_ALL)
    const [cart, setCart] = useState([])
    const [orders, setOrders] = useState({}) // tableNumber -> existing order
    const [menuSearch, setMenuSearch] = useState('')
    const [savingOrder, setSavingOrder] = useState(false)
    const [notification, setNotification] = useState('')
    const [tokenNumber, setTokenNumber] = useState(null)
    const [showSplitModal, setShowSplitModal] = useState(false)
    const [showCombineModal, setShowCombineModal] = useState(false)
    const [selectedItemsForSplit, setSelectedItemsForSplit] = useState([])
    const [splitTargetTable, setSplitTargetTable] = useState('')
    const [combineTargetTable, setCombineTargetTable] = useState('')
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [staffMode, setStaffMode] = useState(false) // Toggle for availability editing

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
                if (o.status === 'cancelled') return;

                if (o.tableNumber) {
                    map[o.tableNumber] = o
                } else if (o.orderType === 'takeaway' || !o.tableNumber) {
                    const key = `Takeaway-T${o.tokenNumber || 'NEW'}`
                    map[key] = o
                }
            })
            setOrders(map)
            return map
        }).catch(() => { return {} })
    }

    const { user } = useAuth()
    const restaurantId = user?.role === 'owner' ? user?._id : user?.parentOwnerId

    // Load all active orders
    useEffect(() => {
        if (!restaurantId) return
        fetchActiveOrders()

        if (socket) {
            socket.emit('join:restaurant', restaurantId)

            const handleUpdate = () => {
                fetchActiveOrders()
            }

            socket.on('kot:new', handleUpdate)
            socket.on('kot:update', handleUpdate)
            socket.on('kot:statusUpdate', handleUpdate)
            socket.on('kot:itemUpdate', (data) => {
                handleUpdate();
                // If the update is for the currently selected table, we should update the cart items
                const tableKey = data.tableNumber || `Table ${data.tableNumber}`; // Backend usually sends tableNumber
                // But let's check against selectedTable
                if (selectedTable && (selectedTable === data.tableNumber || selectedTable === `Table ${data.tableNumber}`)) {
                    setCart(prev => prev.map(item =>
                        item._id === data.itemId ? { ...item, status: data.status } : item
                    ));
                }
            })

            return () => {
                socket.off('kot:new', handleUpdate)
                socket.off('kot:update', handleUpdate)
                socket.off('kot:itemUpdate', handleUpdate)
                socket.off('kot:statusUpdate', handleUpdate)
            }
        }
    }, [restaurantId])

    const getTableStatus = (num) => {
        const key = `Table ${num}`
        const order = orders[key]
        if (!order) return 'free'
        return 'occupied'
    }

    const selectTable = (num) => {
        let key;
        if (num === 'Takeaway') {
            key = 'Takeaway';
        } else if (typeof num === 'string' && num.startsWith('Takeaway-T')) {
            key = num;
        } else {
            key = `Table ${num}`;
        }

        setSelectedTable(key)
        setTokenNumber(null)
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
        } else {
            setCart([])
        }
    }

    const addToCart = (item) => {
        setCart(prev => {
            // Only consolidate with items that are NOT yet saved (don't have an _id)
            const existing = prev.find(c => c.menuItemId === item._id && !c._id)
            if (existing) return prev.map(c => (c.menuItemId === item._id && !c._id) ? { ...c, quantity: c.quantity + 1 } : c)
            return [...prev, { menuItemId: item._id, name: item.name, price: item.price, quantity: 1, notes: '', status: 'preparing' }]
        })
    }

    const updateQty = (id, delta) => {
        setCart(prev => prev
            .map(c => (c.menuItemId === id || c._id === id) ? { ...c, quantity: c.quantity + delta } : c)
            .filter(c => c.quantity > 0)
        )
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
                tableNumber: selectedTable === 'Takeaway' ? null : selectedTable,
                items: cart.map(c => ({
                    _id: c._id,
                    menuItemId: c.menuItemId,
                    name: c.name,
                    price: c.price,
                    quantity: c.quantity,
                    notes: c.notes,
                    status: c.status
                })),
                orderType: selectedTable === 'Takeaway' ? 'takeaway' : 'dine-in',
                subtotal: cartTotal,
                total: cartTotal
            }
            if (existing) {
                await api.put(`/orders/${existing._id}`, payload)
                notify('Order updated ✓')
            } else {
                const res2 = await api.post('/orders', payload)
                const savedOrder = res2.data.data?.order
                if (savedOrder?.tokenNumber) {
                    setTokenNumber(savedOrder.tokenNumber)
                    // Update key if it was 'Takeaway'
                    if (selectedTable === 'Takeaway') {
                        const newKey = `Takeaway-T${savedOrder.tokenNumber}`;
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

            // KOT Popup Message
            alert('✅ KOT Sent to Kitchen Successfully!');
        } catch (err) {
            notify('Failed: ' + (err.response?.data?.message || 'Error'))
        } finally {
            setSavingOrder(false)
        }
    }

    const closeOrder = async () => {
        if (!window.confirm('Are you sure you want to cancel this entire order?')) return;

        const existing = orders[selectedTable];
        if (!existing) {
            setCart([]);
            setSelectedTable(null);
            notify('Order cancelled');
            return;
        }

        try {
            await api.patch(`/orders/${existing._id}/status`, { status: 'cancelled' })
            const newOrders = { ...orders }
            delete newOrders[selectedTable]
            setOrders(newOrders)
            setCart([])
            setSelectedTable(null)
            notify('Order cancelled')
        } catch (err) {
            notify('Cancel failed: ' + (err.response?.data?.message || err.message))
        }
    }

    const toggleSplitSelection = (id) => {
        setSelectedItemsForSplit(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const handleSplit = async () => {
        const existing = orders[selectedTable]
        if (!existing || selectedItemsForSplit.length === 0 || !splitTargetTable) return
        setSavingOrder(true)
        try {
            await api.post(`/orders/${existing._id}/split`, {
                itemIds: selectedItemsForSplit,
                newTableNumber: splitTargetTable.startsWith('Table ') ? splitTargetTable : `Table ${splitTargetTable}`
            })
            notify('Table split successful')
            setShowSplitModal(false)
            await fetchActiveOrders()
            // Refresh current view
            const num = selectedTable === 'Takeaway' ? 'Takeaway' : selectedTable.replace('Table ', '')
            selectTable(num)
        } catch (err) {
            notify('Split failed: ' + (err.response?.data?.message || 'Error'))
        } finally {
            setSavingOrder(false)
        }
    }

    const handleCombine = async () => {
        const source = orders[selectedTable]
        const target = orders[combineTargetTable]
        if (!source || !target) return
        setSavingOrder(true)
        try {
            await api.post(`/orders/${source._id}/combine`, {
                targetOrderId: target._id
            })
            notify('Tables combined successful')
            setShowCombineModal(false)
            await fetchActiveOrders()
            const num = combineTargetTable === 'Takeaway' ? 'Takeaway' : combineTargetTable.replace('Table ', '')
            selectTable(num)
        } catch (err) {
            notify('Combine failed: ' + (err.response?.data?.message || 'Error'))
        } finally {
            setSavingOrder(false)
        }
    }

    const toggleAvailability = async (item) => {
        try {
            await api.patch(`/menu/${item._id}/toggle`)
            setMenuItems(prev => prev.map(m => m._id === item._id ? { ...m, isAvailable: !m.isAvailable } : m))
            notify(`${item.name} is now ${!item.isAvailable ? 'Available' : 'Out of Stock'}`)
        } catch (err) {
            notify('Update failed')
        }
    }

    const settleOrder = async () => {
        const existing = orders[selectedTable]
        if (!existing) return
        try {
            await api.patch(`/orders/${existing._id}/status`, { status: 'paid', paymentStatus: 'paid', paymentMethod: 'cash' })
            const newOrders = { ...orders }
            delete newOrders[selectedTable]
            setOrders(newOrders)
            setCart([])
            setSelectedTable(null)
            notify('Payment received ✓')
        } catch (e) {
            notify('Failed to settle bill')
        }
    }

    const handlePrintAndClose = async () => {
        if (!selectedTable || cart.length === 0) return;
        const existing = orders[selectedTable];
        if (!existing) {
            alert('Please confirm KOT first before closing the order!');
            return;
        }

        const billRows = cart.map(c => `<tr><td>${c.name}</td><td>${c.quantity}</td><td>₹${c.price * c.quantity}</td></tr>`).join('');

        // Generate Print Output
        const printWindow = window.open('', '_blank');
        const billHTML = `
            <html>
            <head>
                <title>Bill - ${selectedTable}</title>
                <style>
                    body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
                    .center { text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { text-align: left; padding: 5px 0; border-bottom: 1px dashed #ccc; font-size: 14px; }
                    .total { font-weight: bold; font-size: 1.2em; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
                </style>
            </head>
            <body>
                <h2 class="center">KITCHEN MASTER</h2>
                <div class="center">Receipt - ${selectedTable === 'Takeaway' && tokenNumber ? 'Takeaway (Token: ' + tokenNumber + ')' : selectedTable}</div>
                <hr style="border-top:1px dashed #000;"/>
                <table>
                    <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
                    ${billRows}
                </table>
                <div class="total">Total Amount: ₹${cartTotal.toFixed(2)}</div>
                <hr style="border-top:1px dashed #000;"/>
                <div class="center" style="margin-top:20px;">Thank You! Visit Again</div>
            </body>
            </html>
        `;

        printWindow.document.write(billHTML);
        printWindow.document.close();
        printWindow.focus();

        // Print it
        printWindow.print();
        printWindow.close();

        // Close the order
        await settleOrder();
    }

    const filteredMenu = menuItems.filter(item => {
        const catMatch = activeCategory === CATEGORIES_ALL || item.category === activeCategory
        const searchMatch = !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase())
        return catMatch && searchMatch
    })

    return (
        <div className="pos-page">
            {/* Notification toast */}
            {notification && <div className="pos-toast">{notification}</div>}

            {/* ── LEFT PANEL ───────────────────────────────────────── */}
            <div className="pos-left">
                {/* Table Grid */}
                <div className="panel table-panel">
                    <div className="panel-header">
                        <span className="panel-title">Tables</span>
                        <span className="panel-badge">{Object.keys(orders).filter(k => k.startsWith('Table')).length} Occupied</span>
                    </div>
                    {/* Takeaway Button */}
                    <div className="takeaway-section">
                        <div className="takeaway-header-row">
                            <span className="section-subtitle">Takeaway Line</span>
                            <button
                                className={`new-takeaway-btn ${selectedTable === 'Takeaway' ? 'active' : ''}`}
                                onClick={() => selectTable('Takeaway')}
                            >
                                + New
                            </button>
                        </div>
                        <div className="takeaway-line">
                            {Object.keys(orders)
                                .filter(key => key.startsWith('Takeaway-T'))
                                .map(key => {
                                    const order = orders[key];
                                    const isSelected = selectedTable === key;
                                    const isReady = order.items?.every(i => i.status === 'ready' || i.status === 'served');

                                    return (
                                        <button
                                            key={key}
                                            className={`takeaway-token-btn ${isSelected ? 'selected' : ''} ${isReady ? 'ready' : ''}`}
                                            onClick={() => selectTable(key)}
                                        >
                                            <span className="token-label">T</span>
                                            <span className="token-val">{order.tokenNumber}</span>
                                            {isReady && <span className="ready-dot" />}
                                        </button>
                                    );
                                })}
                            {Object.keys(orders).filter(key => key.startsWith('Takeaway-T')).length === 0 && (
                                <div className="takeaway-empty-msg">No active takeaways</div>
                            )}
                        </div>
                    </div>
                    <div className="table-grid">
                        {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map(num => {
                            const key = `Table ${num}`
                            const status = getTableStatus(num)
                            const isSelected = selectedTable === key
                            const order = orders[key]

                            let totalItems = 0
                            let readyItems = 0
                            if (order && order.items) {
                                totalItems = order.items.length
                                readyItems = order.items.filter(i => i.status === 'ready' || i.status === 'served').length
                            }
                            const isAllReady = totalItems > 0 && readyItems === totalItems

                            let statusClass = ''
                            if (status === 'occupied') {
                                if (totalItems === 0) statusClass = 'status-empty'
                                else if (readyItems === 0) statusClass = 'status-pending'
                                else if (readyItems > 0 && readyItems < totalItems) statusClass = 'status-preparing'
                                else if (readyItems === totalItems) statusClass = 'status-ready'
                            }

                            return (
                                <button
                                    key={num}
                                    className={`table-btn ${status} ${statusClass} ${isSelected ? 'selected' : ''} ${isAllReady ? 'all-ready' : ''}`}
                                    onClick={() => selectTable(num)}
                                    title={key}
                                >
                                    <span className="table-num">{num}</span>
                                    {status === 'occupied' && <span className="table-dot" />}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Order Review */}
                <div className="panel order-panel">


                    {/* Takeaway Token Number Badge */}
                    {selectedTable === 'Takeaway' && tokenNumber && (
                        <div className="token-badge">
                            <span className="token-label">TOKEN</span>
                            <span className="token-number">{tokenNumber}</span>
                        </div>
                    )}

                    {!selectedTable && (
                        <div className="order-empty">
                            <span>👆</span>
                            <p>Tap a table above to view or start an order</p>
                        </div>
                    )}

                    {selectedTable && cart.length === 0 && (
                        <div className="order-empty">
                            <span>🍽️</span>
                            <p>No items yet. Add from the menu →</p>
                        </div>
                    )}

                    {selectedTable && cart.length > 0 && (
                        <>
                            <div className="cart-items">
                                {cart.map((item, idx) => (
                                    <div key={item._id || `new-${idx}`} className={`cart-item ${item.status === 'served' ? 'served' : ''}`}>
                                        <div className="cart-item-info">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="cart-item-name">{item.name}</span>
                                                {(item.status === 'ready' || item.status === 'served') && (
                                                    <span className="item-status-badge" style={{ fontSize: 9, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                                        {item.status === 'served' ? 'Served' : 'Ready'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="cart-item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                                        </div>
                                        <div className="cart-item-qty">
                                            <button className="qty-btn" onClick={() => updateQty(item._id || item.menuItemId, -1)} disabled={item.status === 'served'}>−</button>
                                            <span>{item.quantity}</span>
                                            <button className="qty-btn" onClick={() => updateQty(item._id || item.menuItemId, 1)} disabled={item.status === 'served'}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="cart-total">
                                <span>Total</span>
                                <span className="cart-total-amt">₹{cartTotal.toFixed(0)}</span>
                            </div>

                            <button className="review-order-trigger" onClick={() => setShowReviewModal(true)}>
                                🔍 Review Order details
                            </button>

                            <div className="cart-actions">
                                <div className="cart-actions-row">
                                    <button
                                        className="split-btn"
                                        onClick={() => {
                                            setSelectedItemsForSplit([])
                                            setSplitTargetTable('')
                                            setShowSplitModal(true)
                                        }}
                                        disabled={!orders[selectedTable] || cart.filter(i => i._id).length === 0}
                                        title="Split items to another table"
                                    >
                                        ✂️ Split
                                    </button>
                                    <button
                                        className="combine-btn"
                                        onClick={() => {
                                            setCombineTargetTable('')
                                            setShowCombineModal(true)
                                        }}
                                        disabled={!orders[selectedTable]}
                                        title="Combine with another table"
                                    >
                                        🔗 Combine
                                    </button>
                                </div>

                                <button className="action-btn save-btn" onClick={saveOrder} disabled={savingOrder}>
                                    {savingOrder ? 'Sending...' : '👨‍🍳 Confirm KOT'}
                                </button>

                                <button className="action-btn settle-btn" onClick={handlePrintAndClose}>
                                    🧾 Print Bill & Close
                                </button>

                                <button className="cancel-order-btn" onClick={closeOrder}>
                                    Cancel Order
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── RIGHT PANEL ──────────────────────────────────────── */}
            <div className="pos-right">
                {/* Search + Category Filter */}
                <div className="menu-header">
                    <input
                        className="menu-search"
                        placeholder="🔍  Search menu items..."
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
                        title="Manage item availability"
                    >
                        {staffMode ? '🔒 Exit Staff Mode' : '🔑 Staff Mode'}
                    </button>
                </div>

                {/* Menu Item Grid */}
                <div className="menu-grid">
                    {filteredMenu.map(item => (
                        <div key={item._id} className="menu-item-container">
                            {(() => {
                                const cartItem = cart.find(c => c.menuItemId === item._id || c._id === item._id);
                                const qty = cartItem ? cartItem.quantity : 0;
                                return (
                                    <button
                                        className={`menu-item-card ${qty > 0 ? 'selected' : ''} ${!item.isAvailable ? 'out-of-stock' : ''}`}
                                        onClick={() => item.isAvailable && addToCart(item)}
                                        disabled={!selectedTable || !item.isAvailable}
                                        title={!item.isAvailable ? `${item.name} is Out of Stock` : (selectedTable ? `Add ${item.name}` : 'Select a table first')}
                                    >
                                        <div className={`veg-dot ${item.isVeg ? 'veg' : 'nonveg'}`} />
                                        {qty > 0 && <div className="item-qty-badge">{qty}</div>}
                                        <div className="menu-item-name">{item.name}</div>
                                        <div className="menu-item-category">{item.category}</div>
                                        <div className="menu-item-price">₹{item.price}</div>
                                        {!item.isAvailable && <div className="out-of-stock-badge">OUT OF STOCK</div>}
                                    </button>
                                );
                            })()}
                            {staffMode && (
                                <button
                                    className={`item-availability-toggle ${item.isAvailable ? 'available' : 'oos'}`}
                                    onClick={(e) => { e.stopPropagation(); toggleAvailability(item); }}
                                >
                                    {item.isAvailable ? 'Set Out of Stock' : 'Set Available'}
                                </button>
                            )}
                        </div>
                    ))}
                    {filteredMenu.length === 0 && (
                        <div className="menu-empty">No items found</div>
                    )}
                </div>
            </div>
            {/* Split Order Modal */}
            {showSplitModal && (
                <div className="modal-overlay">
                    <div className="modal-content split-modal">
                        <div className="modal-header">
                            <h3>✂️ Split Table</h3>
                            <button className="close-btn" onClick={() => setShowSplitModal(false)}>×</button>
                        </div>
                        <p className="modal-desc">Select items to move to a new table</p>

                        <div className="split-items-list">
                            {cart.filter(item => item._id).map((item, idx) => {
                                const isSelected = selectedItemsForSplit.includes(item._id);
                                return (
                                    <div
                                        key={item._id || idx}
                                        className={`split-item-row ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleSplitSelection(item._id)}
                                    >
                                        <div className="split-item-check">
                                            {isSelected ? '✅' : '⬜'}
                                        </div>
                                        <div className="split-item-info">
                                            <span className="split-item-qty">{item.quantity}x</span>
                                            <span className="split-item-name">{item.name}</span>
                                        </div>
                                        <span className="split-item-price">₹{item.price * item.quantity}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="modal-input-group">
                            <label>Destination Table</label>
                            <input
                                type="text"
                                placeholder="e.g. 5 or Table 5"
                                value={splitTargetTable}
                                onChange={(e) => setSplitTargetTable(e.target.value)}
                                className="web-modal-input"
                            />
                        </div>

                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={() => setShowSplitModal(false)}>Cancel</button>
                            <button
                                className="primary-btn"
                                onClick={handleSplit}
                                disabled={selectedItemsForSplit.length === 0 || !splitTargetTable || savingOrder}
                            >
                                {savingOrder ? 'Processing...' : 'Confirm Split'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Combine Order Modal */}
            {showCombineModal && (
                <div className="modal-overlay">
                    <div className="modal-content combine-modal">
                        <div className="modal-header">
                            <h3>🔗 Combine Tables</h3>
                            <button className="close-btn" onClick={() => setShowCombineModal(false)}>×</button>
                        </div>
                        <p className="modal-desc">Select an active table to merge <b>{selectedTable}</b> into</p>

                        <div className="tables-selection-list">
                            {Object.keys(orders).filter(t => t !== selectedTable).map(tableNum => {
                                const order = orders[tableNum];
                                return (
                                    <div
                                        key={tableNum}
                                        className={`table-select-row ${combineTargetTable === tableNum ? 'selected' : ''}`}
                                        onClick={() => setCombineTargetTable(tableNum)}
                                    >
                                        <div className="table-select-info">
                                            <span className="table-select-number">{tableNum}</span>
                                            <span className="table-select-order">Order #{order.orderNumber} • ₹{order.total}</span>
                                        </div>
                                        {combineTargetTable === tableNum && <span className="selected-check">✓</span>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={() => setShowCombineModal(false)}>Cancel</button>
                            <button
                                className="primary-btn"
                                onClick={handleCombine}
                                disabled={!combineTargetTable || savingOrder}
                            >
                                {savingOrder ? 'Processing...' : 'Confirm Merge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Order Review Modal */}
            {showReviewModal && (
                <div className="modal-overlay">
                    <div className="modal-content review-modal">
                        <div className="modal-header">
                            <h3>📋 Order Review - {selectedTable}</h3>
                            <button className="close-btn" onClick={() => setShowReviewModal(false)}>×</button>
                        </div>
                        <p className="modal-desc">Review items before sending to kitchen</p>

                        <div className="review-items-list">
                            <table className="review-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, idx) => {
                                        const itemId = item._id || item.menuItemId;
                                        const isEditable = item.status !== 'served' && item.status !== 'ready';

                                        return (
                                            <tr key={item._id || idx} className={item.status === 'served' ? 'row-served' : ''}>
                                                <td>
                                                    <div className="review-item-name-cell">
                                                        <span className="review-item-name">{item.name}</span>
                                                        {item.status === 'served' && <span className="badge-served">Served</span>}
                                                        {item.status === 'ready' && <span className="badge-ready">Ready</span>}
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
                                                                onClick={() => updateQty(itemId, -item.quantity)}
                                                                title="Remove Item"
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
                            <div className="summary-row">
                                <span>Subtotal</span>
                                <span>₹{cartTotal}</span>
                            </div>
                            <div className="summary-row total">
                                <span>Total Amount</span>
                                <span>₹{cartTotal}</span>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={() => setShowReviewModal(false)}>Close Review</button>
                            <button className="primary-btn" onClick={() => { setShowReviewModal(false); saveOrder(); }} disabled={savingOrder}>
                                {savingOrder ? 'Processing...' : 'Confirm & Send KOT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
