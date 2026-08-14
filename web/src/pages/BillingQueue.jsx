import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { useAuth } from '../context/AuthContext.jsx'
import './BillingQueue.css'
import logo from '../assets/LOGO.jpeg'

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
            const joinRoom = () => socket.emit('join:restaurant', String(restaurantId))
            if (socket.connected) joinRoom()
            socket.on('connect', joinRoom)

            socket.on('billing:newRequest', (data) => {
                if (!data.order) return
                setOrders(prev => {
                    if (prev.find(o => o._id === data.order._id)) return prev
                    return [data.order, ...prev]
                })

                // Auto-print immediately (no hesitation)
                printBill(data.order)

                // Play a subtle notification sound
                new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { })
            })

            socket.on('billing:printed', (data) => {
                setOrders(prev => prev.filter(o => o._id !== data.orderId))
            })
        }

        return () => {
            if (socket) {
                socket.off('connect')
                socket.off('billing:newRequest')
                socket.off('billing:printed')
            }
        }
    }, [restaurantId])

    // Print Queue logic to handle multiple bills and prevent popup blockers
    const queueRef = React.useRef([]);
    const isPrintingRef = React.useRef(false);

    const printBill = (order) => {
        const newJobs = [];

        // If no Counter IP is set, browser needs to print the Customer Copy
        if (!user?.counterPrinterIp) {
            newJobs.push({ order, type: 'CUSTOMER COPY', isKot: false });
        }

        // If no Kitchen IP is set, browser needs to print the Kitchen Copy
        if (!user?.kitchenPrinterIp) {
            newJobs.push({ order, type: 'KITCHEN COPY', isKot: true });
        }

        if (newJobs.length > 0) {
            queueRef.current.push(...newJobs);
        }

        if (!isPrintingRef.current) {
            processQueue();
        }
    };

    const processQueue = async () => {
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
            const { order, type, isKot } = job;
            const displayName = order.tableNumber || (order.tokenNumber ? `Token ${order.tokenNumber}` : 'Takeaway');
            const restaurantName = user.restaurantName || 'RESTAURANT';
            const logoUrl = user.logo ? (user.logo.startsWith('http') ? user.logo : window.location.origin + user.logo) : (logo.startsWith('http') ? logo : window.location.origin + logo);
            const logoImg = `<img src="${logoUrl}" class="logo" alt="logo" />`;

            const getBillBody = () => {
                const items = order.items || [];
                const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
                const taxRate = typeof user?.taxRate === 'number' ? user.taxRate : 18;
                const sgstPct = taxRate / 2;
                const cgstPct = taxRate / 2;
                const effectiveTaxType = order.taxType || user?.taxType || 'Inclusive';
                const isPrintWithGst = order.taxAmount !== undefined ? order.taxAmount > 0 : true;

                const originalSubtotal = items.reduce((s, item) => {
                    const price = parseFloat(item.price || 0);
                    const qty = parseFloat(item.quantity || 0);
                    let basePrice;
                    if (isPrintWithGst) {
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

                const discountRate = order.discountPct !== undefined
                    ? (parseFloat(order.discountPct) || 0)
                    : (originalSubtotal > 0 ? (parseFloat(order.discountAmount || 0) / originalSubtotal) * 100 : 0);

                const discountAmount = originalSubtotal * (discountRate / 100);
                const netSubtotal = originalSubtotal - discountAmount;
                const taxableSubtotal = netSubtotal;

                let totalGstAmount = 0;
                if (isPrintWithGst) {
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

                const extraChargesTotal = order.extraCharges ? order.extraCharges.reduce((s, c) => s + Number(c.amount || 0), 0) : 0;
                const grandTotal = (netSubtotal + totalGstAmount + extraChargesTotal).toFixed(2);

                return `
                <div class="${isKot ? 'kot-section' : 'customer-section'}">
                    <div class="header center">
                        <div style="font-size: 11px; margin-bottom: 2px; border: 1px solid #000; display: inline-block; padding: 1px 5px; font-weight: bold;">${type}</div>
                        <br/>
                        ${logoImg}
                        <div class="bold" style="font-size: 20px; text-transform: uppercase; margin: 3px 0; font-weight: bold;">${restaurantName}</div>
                        ${(!isKot && isPrintWithGst) ? `<div style="font-size: 15px; margin-bottom: 3px; font-weight: normal;">GSTIN: ${user?.gstNumber || 'N/A'}</div>` : ''}
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
                            <tr style="border-bottom: 1px solid #000; font-size: 18px; font-weight: bold;">
                                <th style="text-align: left; width: 50%;">Item</th>
                                <th style="text-align: center; width: 15%;">Qty</th>
                                ${!isKot ? '<th style="text-align: right; width: 15%;">Price</th>' : ''}
                                ${!isKot ? '<th style="text-align: right; width: 20%;">Amt</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((c, index) => {
                    let itemBaseRate, rowTotal;
                    if (isPrintWithGst) {
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
                                    <td style="padding: 2px 0; font-size: 16px; font-weight: bold;">${c.name}</td>
                                    <td style="padding: 2px 0; text-align: center; font-size: 15px; font-weight: normal;">${c.quantity}</td>
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: 15px; font-weight: normal;">${itemBaseRate.toFixed(2)}</td>` : ''}
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: 15px; font-weight: normal;">${rowTotal.toFixed(2)}</td>` : ''}
                                </tr>
                                `;
                }).join('')}
                        </tbody>
                    </table>
                    ${!isKot ? `
                        <div class="total-section" style="font-size: 15px; font-weight: normal;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>Gross Total:</span>
                                <span>₹${originalSubtotal.toFixed(2)}</span>
                            </div>
                            ${discountAmount > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #555;">
                                <span>Discount (${discountRate.toFixed(2)}%):</span>
                                <span>-₹${discountAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${order.extraCharges?.length > 0 ? order.extraCharges.map(charge => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${charge.name}:</span>
                                <span>₹${charge.amount.toFixed(2)}</span>
                            </div>
                            `).join('') : ''}
                            ${isPrintWithGst ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; border-top: 1px dotted #ccc; padding-top: 2px;">
                                <span>Taxable Value:</span>
                                <span>₹${taxableSubtotal.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px;">
                                <span>SGST (${sgstPct.toFixed(1)}%):</span>
                                <span>₹${sgstAmount.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px;">
                                <span>CGST (${cgstPct.toFixed(1)}%):</span>
                                <span>₹${cgstAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 3px;">
                                <span>GRAND TOTAL:</span>
                                <span>₹${grandTotal}</span>
                            </div>
                        </div>
                        <div style="margin-top: 8px; font-size: 12px; border-top: 1px dashed #ccc; padding-top: 5px;">
                            <div style="font-weight: bold; margin-bottom: 2px;">Total Items: ${totalItemsCount}</div>
                            <div>Payment: <span class="bold">${order.paymentMethod?.toUpperCase() || 'CASH'}</span></div>
                            <div>CAPTAIN: ${order.waiterName || 'Staff'}</div>
                        </div>
                        <div class="footer center">
                            <div class="bold" style="font-size: 14px; margin-bottom: 3px;">Thank You! Visit Again</div>
                            <div class="software-ref">Software by ProBloom</div>
                            <div style="font-size: 9px; margin-top: 2px; opacity: 0.7;">#${String(order._id).slice(-8).toUpperCase()}</div>
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
                            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; 
                            padding: 0; 
                            width: 80mm; 
                            margin: 0;
                            font-size: 15px;
                            color: #000;
                            overflow-x: hidden;
                            line-height: 1.2;
                        }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .header { margin-bottom: 5px; padding: 5px 10px; }
                        table { width: 100%; border-collapse: collapse; margin: 5px 0; padding: 0 10px; }
                        th, td { padding: 0 10px; }
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

            // Wait for resources to load if any, then print
            await new Promise(resolve => {
                const img = printWindow.document.querySelector('img');
                if (img && !img.complete) {
                    img.onload = resolve;
                    img.onerror = resolve;
                    // Timeout as fallback
                    setTimeout(resolve, 1000);
                } else {
                    // Small delay for layout to settle
                    setTimeout(resolve, 300);
                }
            });

            printWindow.print();

            // Small delay between jobs to allow the printer/browser to reset
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        isPrintingRef.current = false;
    };



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
                    <p>Select a CAPTAIN to see their pending bill requests</p>
                </div>
                <div className="billing-stats">
                    <div className="stat-card">
                        <span className="stat-val">{orders.length}</span>
                        <span className="stat-lab">Total Pending</span>
                    </div>
                </div>
            </div>

            {/* CAPTAIN Filter Tabs */}
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
                    <p>New bill requests from CAPTAINs will appear here automatically</p>
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
                                    <span className="info-value">{order.orderNumber || order.billNumber}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">CAPTAIN</span>
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
