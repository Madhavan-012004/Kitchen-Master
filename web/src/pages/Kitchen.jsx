import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import './Kitchen.css'

export default function KitchenPage() {
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    const restaurantId = user?.role === 'owner' ? user?._id : user?.parentOwnerId

    const fetchOrders = async () => {
        try {
            const res = await api.get('/orders?paymentStatus=unpaid&limit=50')
            const sorted = (res.data.data.orders || []).sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
            setOrders(sorted)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!restaurantId) return
        fetchOrders()

        // Real-time events
        if (socket) {
            socket.emit('join:kitchen', restaurantId)

            socket.on('kot:new', (data) => {
                if (!data.order) return
                setOrders(prev => {
                    if (prev.find(o => o._id === data.order._id)) return prev
                    return [...prev, data.order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                })
            })

            socket.on('kot:update', (data) => {
                if (!data.order) return
                setOrders(prev => {
                    const idx = prev.findIndex(o => o._id === data.order._id)
                    if (idx === -1) return [...prev, data.order].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                    const updated = [...prev]
                    updated[idx] = data.order
                    return updated
                })
            })

            socket.on('kot:itemUpdate', (data) => {
                setOrders(prev => prev.map(order => {
                    if (order._id === data.orderId) {
                        const items = order.items.map(item =>
                            item._id === data.itemId ? { ...item, status: data.status } : item
                        )
                        return { ...order, items, status: data.orderStatus }
                    }
                    return order
                }))
            })

            socket.on('kot:statusUpdate', (data) => {
                if (data.status === 'paid' || data.status === 'cancelled') {
                    setOrders(prev => prev.filter(o => o._id !== data.orderId))
                }
            })
        }

        return () => {
            if (socket) {
                socket.off('kot:new')
                socket.off('kot:update')
                socket.off('kot:itemUpdate')
                socket.off('kot:statusUpdate')
            }
        }
    }, [restaurantId])

    // Update wait times every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => [...prev])
        }, 60000)
        return () => clearInterval(interval)
    }, [])

    const markReady = async (orderId, itemId) => {
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status: 'ready' })
            // UI updates via socket
        } catch (e) {
            console.error(e)
            alert('Failed to update status')
        }
    }

    const formatTime = (iso) => {
        return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }

    const getWaitTime = (iso) => {
        const mins = Math.floor((new Date() - new Date(iso)) / 60000)
        return mins < 1 ? 'Just now' : `${mins}m ago`
    }

    return (
        <div className="kitchen-container">
            <div className="kitchen-header">
                <div className="kitchen-title">
                    <h1>Kitchen Display</h1>
                    <p>Live KOT tickets for preparation</p>
                </div>
                <div className="kitchen-stats">
                    <div className="stat-item">
                        <span className="stat-value">{orders.length}</span>
                        <span className="stat-label">Active Tickets</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading" style={{ height: '400px' }}>
                    <div className="spinner"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="empty-kitchen">
                    <div className="empty-icon">🍳</div>
                    <h2>No pending orders</h2>
                    <p>Tell the waiters to get busy!</p>
                </div>
            ) : (
                <div className="kot-grid">
                    {orders.map(order => (
                        <div key={order._id} className="kot-card">
                            <div className="kot-header">
                                <div className="kot-table-badge">T - {order.tableNumber}</div>
                                <div className="kot-info">
                                    <span className="kot-time">{formatTime(order.createdAt)}</span>
                                    <span className="kot-wait-time">{getWaitTime(order.createdAt)}</span>
                                </div>
                            </div>

                            {order.notes && (
                                <div className="kot-notes">
                                    <span>⚠️</span>
                                    {order.notes}
                                </div>
                            )}

                            <div className="kot-items">
                                {order.items.filter(i => i.status !== 'served').map(item => (
                                    <div key={item._id} className="kot-item-row">
                                        <div className="item-left">
                                            <div className="item-qty">{item.quantity}</div>
                                            <div>
                                                <span className={`item-name ${item.status === 'ready' ? 'text-ready' : ''}`}>
                                                    {item.name}
                                                </span>
                                                {item.notes && <span className="item-notes">{item.notes}</span>}
                                            </div>
                                        </div>
                                        <div className="item-right">
                                            {item.status === 'ready' ? (
                                                <span className="status-label">✅ Ready</span>
                                            ) : (
                                                <button
                                                    className="item-status-btn btn-ready"
                                                    onClick={() => markReady(order._id, item._id)}
                                                >
                                                    Mark Ready
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="kot-footer">
                                <span>{order.waiterName || 'Staff'}</span>
                                <span>#{order._id.slice(-6).toUpperCase()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
