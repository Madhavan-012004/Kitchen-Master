import React, { useEffect, useState, useCallback } from 'react'
import api from '../api/client.js'
import './Simple.css'

const STATUS_COLORS = { open: '#f59e0b', preparing: '#f59e0b', ready: '#3b82f6', served: '#8b5cf6', paid: '#22c55e', completed: '#22c55e', cancelled: '#ef4444' }

export default function OrdersPage() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]) // Default to today
    const [filterType, setFilterType] = useState('All') // All, dine-in, takeaway
    const [filterStatus, setFilterStatus] = useState('All') // All, preparing, ready, served, paid, cancelled

    const loadOrders = useCallback(() => {
        setLoading(true)
        const params = new URLSearchParams()
        params.append('limit', '100') // fetch more so we can see
        if (filterDate) params.append('date', filterDate)
        if (filterType !== 'All') params.append('orderType', filterType)
        if (filterStatus !== 'All') params.append('status', filterStatus)

        api.get(`/orders?${params.toString()}`).then(r => {
            setOrders(r.data.data?.orders || [])
        }).catch(() => { }).finally(() => setLoading(false))
    }, [filterDate, filterType, filterStatus])

    useEffect(() => {
        loadOrders()
    }, [loadOrders])

    const printBill = (order) => {
        const printWindow = window.open('', '_blank');
        const billRows = (order.items || []).map(c => `<tr><td>${c.name}</td><td>${c.quantity}</td><td>₹${c.price * c.quantity}</td></tr>`).join('');
        const displayName = order.tableNumber ? order.tableNumber : (order.tokenNumber ? `Takeaway (Token: ${order.tokenNumber})` : 'Takeaway');

        const billHTML = `
            <html>
            <head>
                <title>Bill - ${displayName}</title>
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
                <div class="center">Receipt - ${displayName}</div>
                <hr style="border-top:1px dashed #000;"/>
                <table>
                    <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
                    ${billRows}
                </table>
                <div class="total">Total Amount: ₹${(order.total || order.totalAmount || 0).toFixed(2)}</div>
                <hr style="border-top:1px dashed #000;"/>
                <div class="center" style="margin-top:20px;">Thank You! Visit Again</div>
            </body>
            </html>
        `;

        printWindow.document.write(billHTML);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }

    return (
        <div className="simple-page order-history-page">
            <div className="orders-page-header">
                <div className="header-top">
                    <div>
                        <h1 className="page-title">Order History</h1>
                        <p className="page-subtitle">Track and manage past orders across all channels</p>
                    </div>
                    <div className="stats-pill">
                        <span className="stats-number">{orders.length}</span>
                        <span className="stats-label">Orders Found</span>
                    </div>
                </div>

                <div className="filters-container">
                    <div className="filter-group">
                        <label>Date</label>
                        <div className="input-wrapper">
                            <span className="input-icon">📅</span>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="filter-input"
                            />
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>Order Type</label>
                        <div className="input-wrapper">
                            <span className="input-icon">🍽️</span>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="filter-input"
                            >
                                <option value="All">All Types</option>
                                <option value="dine-in">Dine-In</option>
                                <option value="takeaway">Takeaway</option>
                            </select>
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>Status</label>
                        <div className="input-wrapper">
                            <span className="input-icon">📌</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="filter-input"
                            >
                                <option value="All">All Statuses</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready">Ready</option>
                                <option value="served">Served</option>
                                <option value="paid">Paid</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    <div className="filter-group filter-action">
                        <button onClick={loadOrders} className="refresh-btn">
                            <span className="btn-icon">↻</span> Refresh
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading your orders...</p>
                </div>
            ) : (
                <div className="orders-grid">
                    {orders.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <h3>No Orders Found</h3>
                            <p>Try adjusting your filters to see more results.</p>
                        </div>
                    ) : (
                        orders.map(o => (
                            <div key={o._id} className="modern-order-card">
                                <div className="card-header">
                                    <div className="card-header-left">
                                        <span className={`type-badge ${o.orderType}`}>
                                            {o.orderType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-In'}
                                        </span>
                                        <h3 className="table-identifier">
                                            {o.tableNumber ? o.tableNumber : (o.tokenNumber ? `Token ${o.tokenNumber}` : 'Takeaway')}
                                        </h3>
                                    </div>
                                    <span className="time-badge">
                                        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                <div className="card-body">
                                    <div className="items-summary">
                                        <span className="items-count">{o.items?.length || 0} Items</span>
                                        <p className="items-preview">
                                            {o.items?.slice(0, 3).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                            {o.items?.length > 3 && ' ...'}
                                        </p>
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <div className="footer-left">
                                        <span className="total-label">Total</span>
                                        <span className="total-amount">₹{(o.total || o.totalAmount || 0).toFixed(0)}</span>
                                    </div>
                                    <div className="footer-right">
                                        <span className={`status-pill status-${o.status.toLowerCase()}`}>
                                            <span className="status-dot"></span>
                                            {o.status}
                                        </span>
                                        <button className="icon-btn print-action" onClick={() => printBill(o)} title="Print Receipt">
                                            🧾
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
