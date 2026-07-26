import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useTranslation } from 'react-i18next'
import './Kitchen.css'

export default function KitchenPage() {
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const { showTamilName } = useLanguage()
    const [orders, setOrders] = useState([])
    const [pendingApprovals, setPendingApprovals] = useState([])
    const [loading, setLoading] = useState(true)

    const openConfirm = (message, onConfirm) => {
        if (window.confirm(message)) {
            onConfirm();
        }
    };

    const closeConfirm = () => {
        // No-op
    };

    const restaurantId = user?.role === 'owner' ? user?._id : user?.parentOwnerId

    const fetchOrders = async () => {
        try {
            const res = await api.get('/orders')
            const raw = res.data.data.orders || []
            // Dedup by _id in case of any Hibernate Cartesian product leftovers
            const unique = [...new Map(raw.map(o => [o._id, o])).values()]
            const sorted = unique.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            setOrders(sorted)

            const pendingRes = await api.get('/orders/pending-ack')
            setPendingApprovals(pendingRes.data.orders || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!restaurantId) return
        fetchOrders()

        // Polling fallback: refresh every 30 seconds in case socket events are missed
        const pollInterval = setInterval(fetchOrders, 30000)

        // Real-time events
        // ✅ Store ALL handlers as named variables so cleanup removes the EXACT same references
        if (socket) {
            const joinRoom = () => socket.emit('join:restaurant', String(restaurantId))

            if (socket.connected) joinRoom()
            socket.on('connect', joinRoom)

            const handleKotNew = (data) => {
                if (!data.order) return
                if (data.order.status === 'READY' || data.order.status === 'PAID') return
                setOrders(prev => {
                    if (prev.find(o => o._id === data.order._id)) return prev
                    return [...prev, data.order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                })
            }

            const handleKotUpdate = (data) => {
                if (!data.order) return
                if (data.order.status?.toUpperCase() === 'PAID') {
                    setOrders(prev => prev.filter(o => o._id !== data.order._id))
                    return
                }
                setOrders(prev => {
                    const idx = prev.findIndex(o => o._id === data.order._id)
                    if (idx === -1) return [...prev, data.order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                    const updated = [...prev]
                    updated[idx] = data.order
                    return updated
                })
            }

            const handleItemUpdate = (data) => {
                setOrders(prev => {
                    const orderIdx = prev.findIndex(o => o._id === data.orderId)
                    if (orderIdx === -1) return prev
                    const updated = [...prev]
                    const order = { ...updated[orderIdx] }
                    order.items = order.items.map(item =>
                        item._id === data.itemId ? { ...item, status: data.status } : item
                    )
                    order.status = data.orderStatus
                    updated[orderIdx] = order
                    return updated
                })
            }

            const handleStatusUpdate = (data) => {
                const status = data.status?.toUpperCase();
                if (status === 'PAID' || status === 'CANCELLED' || status === 'READY') {
                    setOrders(prev => prev.filter(o => o._id !== data.orderId || o.orderNumber !== data.orderNumber))
                }
            }

            const handleWaiterRequest = (data) => {
                if (!data.order) return;
                setPendingApprovals(prev => {
                    if (prev.find(o => o._id === data.order._id)) return prev;
                    return [...prev, data.order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                });
            }

            const handleWaiterAcknowledged = (data) => {
                if (!data.orderId) return;
                setPendingApprovals(prev => prev.filter(o => o._id !== data.orderId));
            }

            socket.on('kot:new', handleKotNew)
            socket.on('kot:update', handleKotUpdate)
            socket.on('kot:itemUpdate', handleItemUpdate)
            socket.on('kot:statusUpdate', handleStatusUpdate)
            socket.on('waiter:newOrderRequest', handleWaiterRequest)
            socket.on('waiter:orderAcknowledged', handleWaiterAcknowledged)

            return () => {
                clearInterval(pollInterval)
                // ✅ Pass the exact same handler reference to .off() so only OUR listeners are removed
                socket.off('connect', joinRoom)
                socket.off('kot:new', handleKotNew)
                socket.off('kot:update', handleKotUpdate)
                socket.off('kot:itemUpdate', handleItemUpdate)
                socket.off('kot:statusUpdate', handleStatusUpdate)
                socket.off('waiter:newOrderRequest', handleWaiterRequest)
                socket.off('waiter:orderAcknowledged', handleWaiterAcknowledged)
            }
        }

        return () => clearInterval(pollInterval)
    }, [restaurantId])

    // Update wait times every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => [...prev])
        }, 60000)
        return () => clearInterval(interval)
    }, [])

    // Mark a SINGLE partial unit of an item as ready
    const markReadyPartial = async (orderId, itemId, originalItemObj) => {
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}/ready-partial`)
            // Optimistically update local item statuses directly on screen bounce
            setOrders(prev => {
                const orderIdx = prev.findIndex(o => o._id === orderId)
                if (orderIdx === -1) return prev
                const updated = [...prev]
                const order = { ...updated[orderIdx] }
                
                order.items = order.items.map(item => {
                    if (item._id === itemId) {
                        const newCompleted = (item.completedQuantity || 0) + 1;
                        const isFullyReady = newCompleted >= item.quantity;
                        return { 
                            ...item, 
                            completedQuantity: newCompleted,
                            status: isFullyReady ? 'READY' : item.status
                        }
                    }
                    return item;
                });
                
                updated[orderIdx] = order
                return updated
            })
        } catch (err) {
            alert(`Failed to update status: ${err.response?.data?.error || err.response?.data?.message || err.message}`)
            console.error('API Error:', err.response?.data || err)
        }
    }

    const askExtraTime = async (orderId) => {
        try {
            await api.patch(`/orders/${orderId}/notes`, { notes: `⏳ Kitchen needs 10 more mins.` });
            if (typeof notify === 'function') notify('Notified staff about extra time');
            fetchOrders();
        } catch (err) {
            console.error('Ask extra time error:', err);
            alert(`Failed to request extra time: ${err.response?.data?.message || err.message}`);
        }
    }

    const acknowledgeOrder = async (orderId) => {
        try {
            await api.patch(`/orders/${orderId}/waiter-acknowledge`);
            // Optimistically remove from pending approvals
            setPendingApprovals(prev => prev.filter(o => o._id !== orderId));
        } catch (err) {
            console.error('Ack error:', err);
            alert(`Failed to accept order: ${err.response?.data?.message || err.message}`);
        }
    }

    const formatTime = (iso) => {
        return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }



    return (
        <div className="kitchen-container">
            <div className="kitchen-header">
                <div className="kitchen-title">
                    <h1>{t('kitchen.title')}</h1>
                    <p>{t('kitchen.live_tickets', 'Live KOT tickets for preparation')}</p>
                </div>
                <div className="kitchen-stats">
                    <div className="stat-item">
                        <span className="stat-value">{orders.length}</span>
                        <span className="stat-label">Active Tickets</span>
                    </div>
                </div>
            </div>

            {/* Pending Waiter Approvals */}
            {pendingApprovals.length > 0 && (
                <div className="pending-approvals-section" style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', borderRadius: '12px' }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#ffb300', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔔 Pending Customer Orders ({pendingApprovals.length})
                    </h3>
                    <div className="kot-grid">
                        {pendingApprovals.map(order => (
                            <div key={order._id} className="kot-card" style={{ border: '2px dashed #ffc107', background: '#fff9e6', color: '#000' }}>
                                <div className="kot-header">
                                    <div className="kot-table-badge" style={{ background: '#ff9800' }}>T - {order.tableNumber}</div>
                                    <div className="kot-info" style={{ flex: 1, color: '#333' }}>
                                        <span className="kot-time">{formatTime(order.createdAt)}</span>

                                    </div>
                                </div>
                                <div className="kot-items" style={{ maxHeight: '150px', overflowY: 'auto', margin: '10px 0', fontSize: '14px', color: '#555' }}>
                                    {order.items.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ffe0b2', padding: '4px 0' }}>
                                            <span>{item.quantity}x {item.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="kot-footer" style={{ borderTop: 'none', background: 'transparent', padding: '0' }}>
                                    <button 
                                        onClick={() => acknowledgeOrder(order._id)}
                                        style={{ width: '100%', padding: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        ✅ Accept & Send to KOT
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading" style={{ height: '400px' }}>
                    <div className="spinner"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="empty-kitchen">
                    <div className="empty-icon">🍳</div>
                    <h2>No pending orders</h2>
                    <p>Tell the CAPTAINs to get busy!</p>
                </div>
            ) : (
                <div className="kot-grid">
                    {orders.map(order => (
                        <div key={order._id} className="kot-card">
                            <div className="kot-header">
                                <div className="kot-table-badge">T - {order.tableNumber}</div>
                                <div className="kot-info" style={{ flex: 1 }}>
                                    <span className="kot-time">{formatTime(order.createdAt)}</span>

                                </div>
                                <button 
                                    className="item-status-btn" 
                                    onClick={(e) => { e.stopPropagation(); askExtraTime(order._id); }} 
                                    title="Ask Extra Time"
                                    style={{ position: 'relative', zIndex: 10, background: '#f59e0b', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                                >
                                    ⏱️ Extra Time
                                </button>
                            </div>

                            {order.notes && (
                                <div className="kot-notes">
                                    <span>⚠️</span>
                                    {order.notes}
                                </div>
                            )}

                            <div className="kot-items">
                                {/* Waiting Items — unrolled individually */}
                                {(() => {
                                    const waitingRows = [];
                                    order.items.forEach(item => {
                                        // Skip if completely served, ready, or cancelled
                                        if (item.status?.toUpperCase() === 'SERVED' || 
                                            item.status?.toUpperCase() === 'READY' ||
                                            item.status?.toUpperCase() === 'CANCELLED') return;
                                        
                                        const completed = item.completedQuantity || 0;
                                        const pending = item.quantity - completed;
                                        
                                        for (let n = 0; n < pending; n++) {
                                            waitingRows.push({ ...item, displayQty: 1, _index: n });
                                        }
                                    });
                                    
                                    return waitingRows.map((item, idx) => (
                                        <div key={`w-${item._id}-${idx}`} className="kot-item-row">
                                            <div className="item-left">
                                                <div className="item-qty">1</div>
                                                <div>
                                                    <span className="item-name">{(showTamilName && item.tamilName) ? item.tamilName : item.name}</span>
                                                    {item.notes && <span className="item-notes">{item.notes}</span>}
                                                </div>
                                            </div>
                                            <div className="item-right" style={{ gap: '8px', display: 'flex' }}>
                                                <button
                                                    className="item-status-btn btn-ready"
                                                    onClick={() => markReadyPartial(order._id, item._id, item)}
                                                >
                                                    {t('kitchen.mark_ready')}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                })()}

                                {/* Completed Items — unrolled individually */}
                                {(() => {
                                    const readyRows = [];
                                    order.items.forEach(item => {
                                        // Ignore SERVED for KOT display, only show READY
                                        if (item.status?.toUpperCase() === 'SERVED') return;
                                        
                                        // Completed is either total quantity (if status is READY) or the partial count
                                        const completed = item.status?.toUpperCase() === 'READY' ? item.quantity : (item.completedQuantity || 0);
                                        
                                        for (let n = 0; n < completed; n++) {
                                            readyRows.push({ ...item, displayQty: 1, _index: n });
                                        }
                                    });
                                    if (readyRows.length === 0) return null
                                    return (
                                        <div className="kot-ready-section">
                                            <div className="kot-ready-divider">
                                                <span>Completed</span>
                                                <div className="divider-line"></div>
                                            </div>
                                            {readyRows.map((item, idx) => (
                                                <div key={`r-${item._id}-${idx}`} className="kot-item-row">
                                                    <div className="item-left" style={{ opacity: 0.7 }}>
                                                        <div className="item-qty">1</div>
                                                        <div>
                                                            <span className="item-name" style={{ textDecoration: 'line-through' }}>{(showTamilName && item.tamilName) ? item.tamilName : item.name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="item-right">
                                                        <span className="status-label">✅ Ready</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>

                            <div className="kot-footer">
                                <span>{order.waiterName || 'Staff'}</span>
                                <span>#{String(order._id).slice(-6).toUpperCase()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            

        </div>
    )
}
