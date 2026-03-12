import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import './BillingQueue.css'

export default function BillingQueue() {
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterWaiter, setFilterWaiter] = useState('All')

    const restaurantId = user?.role === 'owner' ? user?._id : user?.parentOwnerId

    const fetchQueue = async () => {
        try {
            // Fetch orders that have requested a bill but aren't printed yet
            const res = await api.get('/orders?billRequested=true&billPrinted=false&limit=50')
            setOrders(res.data.data.orders || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!restaurantId) return
        fetchQueue()

        if (socket) {
            socket.emit('join:restaurant', restaurantId)

            socket.on('billing:newRequest', (data) => {
                if (!data.order) return
                setOrders(prev => {
                    if (prev.find(o => o._id === data.order._id)) return prev
                    return [data.order, ...prev]
                })
                // Play a subtle notification sound if possible, or just a visual cue
                new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { })
            })

            socket.on('billing:printed', (data) => {
                setOrders(prev => prev.filter(o => o._id !== data.orderId))
            })
        }

        return () => {
            if (socket) {
                socket.off('billing:newRequest')
                socket.off('billing:printed')
            }
        }
    }, [restaurantId])

    const printBill = (order) => {
        const printWindow = window.open('', '_blank');
        const billRows = (order.items || []).map(c => `
            <tr>
                <td style="padding: 5px 0;">${c.name}</td>
                <td style="padding: 5px 0; text-align: center;">${c.quantity}</td>
                <td style="padding: 5px 0; text-align: right;">₹${(c.price * c.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const displayName = order.tableNumber || (order.tokenNumber ? `Token ${order.tokenNumber}` : 'Takeaway');

        const billHTML = `
            <html>
            <head>
                <title>Bill - ${displayName}</title>
                <style>
                    @page { margin: 0; }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        padding: 10px; 
                        width: 80mm; 
                        margin: 0;
                        font-size: 12px;
                        color: #000;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .header { margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    .total-section { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
                    .footer { margin-top: 15px; border-top: 1px dashed #000; padding-top: 5px; font-size: 10px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header center">
                    <div class="bold" style="font-size: 16px;">KITCHEN MASTER</div>
                    <div>Restaurant Management System</div>
                    <div style="margin-top: 5px;">Bill : ${displayName}</div>
                    <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
                </div>
                <table>
                    <thead>
                        <tr style="border-bottom: 1px solid #000;">
                            <th style="text-align: left;">Item</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${billRows}
                    </tbody>
                </table>
                <div class="total-section">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <span>₹${order.subtotal.toFixed(2)}</span>
                    </div>
                    ${order.taxAmount > 0 ? `
                        <div style="display: flex; justify-content: space-between;">
                            <span>GST:</span>
                            <span>₹${order.taxAmount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 5px;">
                        <span>TOTAL:</span>
                        <span>₹${order.total.toFixed(2)}</span>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <div>Payment: <span class="bold">${order.paymentMethod?.toUpperCase() || 'CASH'}</span></div>
                    <div>Waiter: ${order.waiterName || 'Staff'}</div>
                </div>
                <div class="footer center">
                    <div>Thank You for Dining with Us!</div>
                    <div style="font-size: 8px; margin-top: 5px;">#${order._id.slice(-8).toUpperCase()}</div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(billHTML);
        printWindow.document.close();
    }

    const markAsPrinted = async (id) => {
        // Optimistic UI update: Remove from list locally for instant feedback
        setOrders(prev => prev.filter(o => o._id !== id))
        try {
            await api.patch(`/orders/${id}/print`)
            // Socket event will also trigger filtering for other connected clients
        } catch (e) {
            console.error(e)
            // If it fails, we might want to refresh the list or show an error
            fetchQueue()
            alert('Failed to update status')
        }
    }

    const waiters = ['All', ...new Set(orders.map(o => o.waiterName).filter(Boolean))]

    const filteredOrders = filterWaiter === 'All'
        ? orders
        : orders.filter(o => o.waiterName === filterWaiter)

    return (
        <div className="billing-page">
            <div className="billing-header">
                <div className="billing-title">
                    <h1>Billing Queue 🧾</h1>
                    <p>Select a waiter to see their pending bill requests</p>
                </div>
                <div className="billing-stats">
                    <div className="stat-card">
                        <span className="stat-val">{orders.length}</span>
                        <span className="stat-lab">Total Pending</span>
                    </div>
                </div>
            </div>

            {/* Waiter Filter Tabs */}
            <div className="waiter-filters">
                {waiters.map(w => (
                    <button
                        key={w}
                        className={`waiter-filter-btn ${filterWaiter === w ? 'active' : ''}`}
                        onClick={() => setFilterWaiter(w)}
                    >
                        {w}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="billing-loading">
                    <div className="billing-spinner"></div>
                    <p>Loading print queue...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="empty-queue">
                    <div className="empty-queue-icon">📄</div>
                    <h2>{filterWaiter === 'All' ? 'Queue is empty' : `No bills for ${filterWaiter}`}</h2>
                    <p>New bill requests from waiters will appear here automatically</p>
                </div>
            ) : (
                <div className="billing-grid">
                    {filteredOrders.map(order => (
                        <div key={order._id} className="billing-card">
                            <div className="bill-card-top">
                                <div className="bill-table">{order.tableNumber || 'Takeaway'}</div>
                                <div className="bill-method-badge" data-method={order.paymentMethod}>
                                    {order.paymentMethod?.toUpperCase()}
                                </div>
                            </div>

                            <div className="bill-card-info">
                                <div className="info-row">
                                    <span className="info-label">Order #</span>
                                    <span className="info-value">{order.orderNumber}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Waiter</span>
                                    <span className="info-value">{order.waiterName}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Requested</span>
                                    <span className="info-value">
                                        {new Date(order.billRequestedAt || order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            <div className="bill-total-row">
                                <span className="total-label">Total Amount</span>
                                <span className="total-value">₹{order.total.toFixed(2)}</span>
                            </div>

                            <div className="bill-card-actions">
                                <button className="print-action-btn" onClick={() => printBill(order)}>
                                    🖨️ Print Bill
                                </button>
                                <button className="done-action-btn" onClick={() => markAsPrinted(order._id)}>
                                    ✅ Mark Printed
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
