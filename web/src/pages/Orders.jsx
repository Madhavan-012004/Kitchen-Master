import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import logo from '../assets/LOGO.jpeg'
import './Simple.css'

const STATUS_COLORS = { open: '#f59e0b', preparing: '#f59e0b', ready: '#3b82f6', served: '#8b5cf6', paid: '#22c55e', completed: '#22c55e', cancelled: '#ef4444' }

export default function OrdersPage() {
    const { user } = useAuth()
    const [orders, setOrders] = useState([])
    const [menuItems, setMenuItems] = useState([])
    const [loading, setLoading] = useState(true)

    // Print Queue logic
    const queueRef = useRef([]);
    const isPrintingRef = useRef(false);

    // Print language modal
    const [showPrintLangModal, setShowPrintLangModal] = useState(false)
    const [pendingPrintOrder, setPendingPrintOrder] = useState(null)

    // Filters
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]) 
    const [filterType, setFilterType] = useState('All') 
    const [filterStatus, setFilterStatus] = useState('All')

    const loadOrders = useCallback(() => {
        setLoading(true)
        const params = new URLSearchParams()
        params.append('limit', '100') // fetch more so we can see
        if (filterDate) params.append('date', filterDate)
        if (filterType !== 'All') params.append('orderType', filterType)
        if (filterStatus !== 'All') params.append('status', filterStatus)

        api.get(`/orders/history?${params.toString()}`).then(r => {
            setOrders(r.data.data?.orders || [])
        }).catch(() => { }).finally(() => setLoading(false))
    }, [filterDate, filterType, filterStatus])

    useEffect(() => {
        loadOrders()

        // Socket listener for real-time updates
        const restaurantId = user?._id || user?.parentOwnerId;
        if (socket && restaurantId) {
            const joinRoom = () => socket.emit('join:restaurant', String(restaurantId));
            if (socket.connected) joinRoom();
            socket.on('connect', joinRoom);

            // Refresh on any relevant update
            const refresh = () => loadOrders();
            socket.on('kot:new', refresh);
            socket.on('kot:update', refresh);
            socket.on('kot:statusUpdate', refresh);
            socket.on('billing:newRequest', refresh);
            socket.on('billing:printed', refresh);

            return () => {
                socket.off('connect', joinRoom);
                socket.off('kot:new', refresh);
                socket.off('kot:update', refresh);
                socket.off('kot:statusUpdate', refresh);
                socket.off('billing:newRequest', refresh);
                socket.off('billing:printed', refresh);
            }
        }
    }, [loadOrders, user]);

    useEffect(() => {
        api.get('/menu').then(res => {
            const items = res.data.data?.menuItems || res.data.data?.items || []
            setMenuItems(items)
        }).catch(() => { })
    }, [])

    // Open language picker before printing
    const handlePrintClick = (order) => {
        setPendingPrintOrder(order);
        setShowPrintLangModal(true);
    };

    const handlePrintWithLanguage = (lang) => {
        setShowPrintLangModal(false);
        if (pendingPrintOrder) {
            printBill(pendingPrintOrder, lang);
            setPendingPrintOrder(null);
        }
    };

    const printBill = (order, printLang = 'en') => {
        const restaurantName = user?.restaurantName || 'RESTAURANT';
        const logoUrl = user?.logo ? (user.logo.startsWith('http') ? user.logo : window.location.origin + user.logo) : (logo.startsWith('http') ? logo : window.location.origin + logo);
        const logoImg = `<img src="${logoUrl}" class="logo" alt="logo" />`;

        const newJobs = [
            { order, type: 'CUSTOMER COPY', isKot: false, printLang },
            { order, type: 'KITCHEN COPY', isKot: true, printLang }
        ];

        queueRef.current.push(...newJobs);

        if (!isPrintingRef.current) {
            processQueue(logoImg, restaurantName);
        }
    };

    const processQueue = async (logoImg, restaurantName) => {
        if (isPrintingRef.current || queueRef.current.length === 0) return;
        isPrintingRef.current = true;

        const printIframe = document.getElementById('orders-print-iframe');
        if (!printIframe) {
            console.error('Print iframe not found');
            isPrintingRef.current = false;
            return;
        }
        const printWindow = printIframe.contentWindow;

        while (queueRef.current.length > 0) {
            const job = queueRef.current.shift();
            const { order, type, isKot, printLang = 'en' } = job;
            const displayName = order.tableNumber || (order.tokenNumber ? `Token ${order.tokenNumber}` : 'Takeaway');
            
            const getBillBody = () => {
                const items = order.items || [];
                const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
                const subtotal = order.subtotal || 0;
                const extraChargesTotal = order.extraCharges ? order.extraCharges.reduce((s,c) => s + c.amount, 0) : 0;
                const totalGst = order.taxAmount ? order.taxAmount.toFixed(2) : ((subtotal * 0.05).toFixed(2));
                const sgst = (parseFloat(totalGst) / 2).toFixed(2);
                const cgst = (parseFloat(totalGst) / 2).toFixed(2);
                const grandTotal = order.total ? order.total.toFixed(2) : (subtotal + parseFloat(totalGst) + extraChargesTotal).toFixed(2);

                return `
                <div class="${isKot ? 'kot-section' : 'customer-section'}">
                    <div class="header center">
                        <div style="font-size: 11px; margin-bottom: 2px; border: 1px solid #000; display: inline-block; padding: 1px 5px; font-weight: bold;">${type}</div>
                        <br/>
                        ${logoImg}
                        <div class="bold" style="font-size: 20px; text-transform: uppercase; margin: 3px 0; font-weight: bold;">${restaurantName}</div>
                        ${!isKot ? `<div style="font-size: 15px; margin-bottom: 3px; font-weight: normal;">GSTIN: ${user?.gstNumber || 'N/A'}</div>` : ''}
                        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; margin: 4px 0; padding: 3px 0;">
                            <div style="display: flex; justify-content: space-between; font-size: 15px; padding: 0 5px; font-weight: normal;">
                                <span>Bill No: <span>${order.orderNumber || String(order._id).slice(-8).toUpperCase()}</span></span>
                                <span>Table: <span>${displayName}</span></span>
                            </div>
                        </div>
                        <div style="font-size: 15px; font-weight: normal;">Date: ${new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                    <table>
                        <thead>
                            <tr style="border-bottom: 1px solid #000; font-size: ${printLang === 'ta' ? '12px' : '15px'}; font-weight: bold;">
                                <th style="text-align: left; width: 42%;">${printLang === 'ta' ? 'பொருள்' : 'Item'}</th>
                                <th style="text-align: center; width: 15%;">${printLang === 'ta' ? 'அளவு' : 'Qty'}</th>
                                ${!isKot ? `<th style="text-align: right; width: 18%;">${printLang === 'ta' ? 'விலை' : 'Price'}</th>` : ''}
                                ${!isKot ? `<th style="text-align: right; width: 25%;">${printLang === 'ta' ? 'தொகை' : 'Amt'}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((c, index) => {
                                const matchedMenu = menuItems.find(m => String(m._id) === String(c.menuItemId));
                                const tName = c.tamilName || (matchedMenu ? matchedMenu.tamilName : null);
                                const displayName = (printLang === 'ta' && tName) ? tName : c.name;
                                return `
                                <tr>
                                    <td style="padding: 2px 0; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: bold; padding-right: 2px;">${displayName}</td>
                                    <td style="padding: 2px 0; text-align: center; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${c.quantity}</td>
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${c.price}</td>` : ''}
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${(c.price * c.quantity).toFixed(2)}</td>` : ''}
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    ${!isKot ? `
                        <div class="total-section" style="font-size: 15px; font-weight: normal;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${printLang === 'ta' ? 'மொத்தம்' : 'Subtotal'}:</span>
                                <span>&#8377;${subtotal.toFixed(2)}</span>
                            </div>
                            ${order.extraCharges?.length > 0 ? order.extraCharges.map(charge => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${charge.name}:</span>
                                <span>&#8377;${charge.amount.toFixed(2)}</span>
                            </div>
                            `).join('') : ''}
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; border-top: 1px dotted #ccc; padding-top: 2px;">
                                <span>SGST:</span>
                                <span>&#8377;${sgst}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px;">
                                <span>CGST:</span>
                                <span>&#8377;${cgst}</span>
                            </div>
                            ${order.discountAmount > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${printLang === 'ta' ? 'தள்ளுபடி' : 'Discount'}:</span>
                                <span>-&#8377;${order.discountAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 3px;">
                                <span>${printLang === 'ta' ? 'மொத்த தொகை' : 'GRAND TOTAL'}:</span>
                                <span>&#8377;${grandTotal}</span>
                            </div>
                        </div>
                        <div style="margin-top: 8px; font-size: 12px; border-top: 1px dashed #ccc; padding-top: 5px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">${printLang === 'ta' ? 'மொத்த பொருட்கள்' : 'Total Items'}: ${totalItemsCount}</div>
                            <div>${printLang === 'ta' ? 'கட்டண முறை' : 'Payment'}: <span class="bold">${order.paymentMethod?.toUpperCase() || 'CASH'}</span></div>
                        </div>
                        <div class="footer center">
                            <div class="bold" style="font-size: 14px; margin-bottom: 3px;">${printLang === 'ta' ? 'நன்றி! மீண்டும் வாருங்கள்' : 'Thank You! Visit Again'}</div>
                            <div class="software-ref">Software by ProBloom</div>
                        </div>
                    ` : `
                        <div class="footer center" style="margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">Total Items: ${totalItemsCount}</div>
                            <div class="bold" style="font-size: 16px;">ORDER REF: #${order.orderNumber || String(order._id).slice(-8).toUpperCase()}</div>
                            <div style="font-size: 11px; margin-top: 3px; font-weight: bold;">(KITCHEN COPY)</div>
                        </div>
                    `}
                </div>
                `;
            };

            const billHTML = `
                <html>
                <head>
                    <title>Bill - ${displayName}</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        body { 
                            font-family: 'Mukta Malar', 'Latha', system-ui, -apple-system, sans-serif; 
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
                        .bold { font-weight: bold; }
                        .header { margin-bottom: 5px; padding: 2px 0; }
                        table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 5px 0; }
                        th, td { padding: 0 2px; word-wrap: break-word; overflow-wrap: break-word; }
                        .total-section { border-top: 1px dashed #000; padding: 5px 10px; margin-top: 5px; }
                        .footer { margin-top: 10px; border-top: 1px dashed #000; padding: 5px 10px; font-size: 11px; }
                        .logo { max-height: 55px; max-width: 140px; margin-bottom: 2px; object-fit: contain; }
                        .software-ref { font-size: 9px; margin-top: 5px; color: #444; border-top: 1px dotted #ccc; padding-top: 3px; }
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
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        isPrintingRef.current = false;
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
                                <option value="All">All Status</option>
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
                            <div key={o._id} className="modern-order-card" style={{
                                borderLeft: `4px solid ${STATUS_COLORS[o.status?.toLowerCase()] || 'var(--accent)'}`,
                                border: `1px solid ${STATUS_COLORS[o.status?.toLowerCase()] || 'var(--accent)'}`
                            }}>
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
                                        <span className="total-amount">&#8377;{(o.total || o.totalAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="footer-right">
                                        <span className={`status-pill status-${o.status.toLowerCase()}`}>
                                            <span className="status-dot"></span>
                                            {o.status}
                                        </span>
                                        <button
                                            className="icon-btn print-action"
                                            onClick={() => handlePrintClick(o)}
                                            title="Print Receipt"
                                        >
                                            🧾
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Print Language Selection Modal */}
            {showPrintLangModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        background: 'var(--bg-primary, #fff)', borderRadius: '16px',
                        padding: '32px 28px', maxWidth: '360px', width: '90%',
                        textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧾</div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                            Print Bill In
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '22px' }}>
                            Choose the language for the printed receipt
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => handlePrintWithLanguage('en')}
                                style={{
                                    flex: 1, padding: '14px 0', borderRadius: '10px',
                                    border: '2px solid #3b82f6', background: '#3b82f6',
                                    color: '#fff', fontSize: '16px', fontWeight: 700,
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '4px'
                                }}
                            >
                                <span style={{ fontSize: '22px' }}>🇬🇧</span>
                                <span>English</span>
                            </button>
                            <button
                                onClick={() => handlePrintWithLanguage('ta')}
                                style={{
                                    flex: 1, padding: '14px 0', borderRadius: '10px',
                                    border: '2px solid #f59e0b', background: '#f59e0b',
                                    color: '#fff', fontSize: '16px', fontWeight: 700,
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '4px'
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
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden iframe for professional silent printing */}
            <iframe
                id="orders-print-iframe"
                title="orders-print-iframe"
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
