import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../api/client.js'
import socket from '../api/socket.js'
import { getPrinterSettings, printBill as networkPrintBill } from '../api/printerUtils.js'
import { useAuth } from '../context/AuthContext.jsx'
import logo from '../assets/LOGO.jpeg'
import { useTranslation } from 'react-i18next'
import './Simple.css'

import { getDisplayBillNumber } from './useLinePOS.js'
import { filterOrdersForUser, extractBillerMeta, getEmployeeCode } from '../utils/billNumberUtils.js'

const STATUS_COLORS = { open: '#f59e0b', preparing: '#f59e0b', ready: '#3b82f6', served: '#8b5cf6', paid: '#22c55e', completed: '#22c55e', cancelled: '#ef4444' }

export default function OrdersPage() {
    const getDisplayOrderNumber = (order, allOrders = orders) => {
        return getDisplayBillNumber(order, allOrders);
    };

    const { t } = useTranslation()
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
    const [filterEmployee, setFilterEmployee] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')

    const loadOrders = useCallback(() => {
        setLoading(true)
        const params = new URLSearchParams()
        params.append('limit', '100') // fetch more so we can see
        if (filterDate) params.append('date', filterDate)
        if (filterType !== 'All') params.append('orderType', filterType)
        if (filterStatus !== 'All') params.append('status', filterStatus)
        if (searchTerm) params.append('search', searchTerm)

        api.get(`/orders/history?${params.toString()}`).then(r => {
            let fetched = r.data.data?.orders || [];
            try {
                // Merge offline queue orders from OfflineSyncService (Line POS offline bills)
                const rawQueue = localStorage.getItem('km_offline_orders_queue');
                if (rawQueue) {
                    const queueList = JSON.parse(rawQueue);
                    const queueOnly = queueList.filter(qo => !fetched.some(fb =>
                        fb.orderNumber === qo.orderNumber ||
                        fb.billNumber === qo.billNumber ||
                        (fb.notes && qo.billNumber && fb.notes.includes(`||BILLNO:${qo.billNumber}||`))
                    ));
                    const formattedQueue = queueOnly.map(qo => ({
                        ...qo,
                        source: qo.source || 'line_pos',
                        orderType: qo.orderType || 'LINE_POS',
                        status: qo.status || 'PAID',
                        items: (qo.items || []).map(i => ({
                            name: i.name || i.itemName || 'Item',
                            price: i.price || i.rate || 0,
                            quantity: i.quantity || i.qty || 1,
                            itemType: i.itemType,
                            isReturn: i.isReturn,
                            isFree: i.isFree,
                        }))
                    }));
                    fetched = [...formattedQueue, ...fetched];
                }
            } catch (e) { console.warn('Failed merging offline queue orders', e); }

            try {
                const rawLocal = localStorage.getItem('poultry_history_bills');
                if (rawLocal) {
                    const localBills = JSON.parse(rawLocal);
                    // Filter those already existing on backend by matching billNumber
                    const localOnly = localBills.filter(lb => !fetched.some(fb => fb.orderNumber === lb.billNumber || fb.billNumber === lb.billNumber || fb.notes?.includes(`||BILLNO:${lb.billNumber}||`)));
                    // Structure local bills closely to backend model so they display perfectly
                    const formattedLocal = localOnly.map(lb => ({
                        _id: lb._id,
                        id: lb.id,
                        orderNumber: lb.billNumber,
                        billNumber: lb.billNumber,
                        source: 'poultry',
                        orderType: 'takeaway',
                        status: lb.status === 'PENDING' ? 'PENDING' : 'PAID',
                        total: lb.total,
                        items: (lb.items || []).map(i => ({
                            menuItemId: i.menuItemId,
                            name: i.itemName || i.name || 'Item',
                            price: i.rate || i.price || 0,
                            quantity: i.quantity || i.qty || 0,
                            amount: i.amount
                        })),
                        createdAt: lb.createdAt || new Date().toISOString(),
                        paymentMethod: lb.paymentMethod || 'CASH',
                        notes: lb.notes || `||BILLNO:${lb.billNumber}||`
                    }));

                    fetched = [...formattedLocal, ...fetched];
                }
            } catch (e) { console.warn('Failed merging offline poultry bills', e); }

            fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setOrders(fetched);
        }).catch(() => { }).finally(() => setLoading(false))
    }, [filterDate, filterType, filterStatus, searchTerm])

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
            const printerSettings = getPrinterSettings();
            const connectionType = printerSettings.connectionType;

            if (connectionType === 'network' || !connectionType) {
                printBill(pendingPrintOrder, lang);
            } else {
                networkPrintBill(pendingPrintOrder._id, { connectionType, printLang: lang });
            }
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
                                <span>Bill No: <span>${getDisplayOrderNumber(order)}</span></span>
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
                                    <td style="padding: 2px 0; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: bold; padding-right: 2px;">${displayName}</td>
                                    <td style="padding: 2px 0; text-align: center; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${c.quantity}</td>
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${itemBaseRate.toFixed(2)}</td>` : ''}
                                    ${!isKot ? `<td style="padding: 2px 0; text-align: right; font-size: ${printLang === 'ta' ? '12px' : '14px'}; font-weight: normal;">${rowTotal.toFixed(2)}</td>` : ''}
                                </tr>
                                `;
                }).join('')}
                        </tbody>
                    </table>
                    ${!isKot ? `
                        <div class="total-section" style="font-size: 15px; font-weight: normal;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${printLang === 'ta' ? 'மொத்தம்' : 'Gross Total'}:</span>
                                <span>&#8377;${originalSubtotal.toFixed(2)}</span>
                            </div>
                            ${discountAmount > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #555;">
                                <span>Discount (${discountRate.toFixed(2)}%):</span>
                                <span>-&#8377;${discountAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            ${order.extraCharges?.length > 0 ? order.extraCharges.map(charge => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>${charge.name}:</span>
                                <span>&#8377;${charge.amount.toFixed(2)}</span>
                            </div>
                            `).join('') : ''}
                            ${isPrintWithGst ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; border-top: 1px dotted #ccc; padding-top: 2px;">
                                <span>Taxable Value:</span>
                                <span>&#8377;${taxableSubtotal.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px;">
                                <span>SGST (${sgstPct.toFixed(1)}%):</span>
                                <span>&#8377;${sgstAmount.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px;">
                                <span>CGST (${cgstPct.toFixed(1)}%):</span>
                                <span>&#8377;${cgstAmount.toFixed(2)}</span>
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
                            <div class="bold" style="font-size: 16px;">ORDER REF: #${getDisplayOrderNumber(order)}</div>
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

    const handleA4Invoice = async (order) => {
        try {
            const res = await api.get(`/orders/${order._id}/invoice/a4`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice-${getDisplayOrderNumber(order)}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Failed to download invoice', e);
            alert('Failed to download A4 Invoice');
        }
    };

    const handleWhatsApp = (order) => {
        const text = `*${user?.restaurantName || 'RESTAURANT'}*\n\nOrder #${getDisplayOrderNumber(order)}\nAmount: ₹${order.total?.toFixed(2) || 0}\nStatus: ${order.status}\n\nThank you for your order!`;
        const phone = order.customerPhone || '';
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handleDeleteOrder = async (order) => {
        const orderId = order._id || order.id;
        const orderNo = getDisplayOrderNumber(order);
        if (!window.confirm(`Are you sure you want to delete bill #${orderNo}? This will restore stock levels for all items and permanently delete the record.`)) return;
        try {
            if (orderId && !String(orderId).startsWith('offline_')) {
                try {
                    await api.delete(`/orders/${orderId}`);
                } catch (apiErr) {
                    console.warn("Backend order delete failed or item is local-only:", apiErr);
                }
            }

            // Clean from km_offline_orders_queue
            try {
                const rawQueue = localStorage.getItem('km_offline_orders_queue');
                if (rawQueue) {
                    const queueList = JSON.parse(rawQueue);
                    const filtered = queueList.filter(q => q.orderNumber !== orderNo && q.billNumber !== orderNo && q._id !== orderId && q.id !== orderId);
                    localStorage.setItem('km_offline_orders_queue', JSON.stringify(filtered));
                }
            } catch (e) { console.warn("Failed clearing order from km_offline_orders_queue", e); }

            // Clean from poultry_history_bills
            try {
                const rawLocal = localStorage.getItem('poultry_history_bills');
                if (rawLocal) {
                    const localBills = JSON.parse(rawLocal);
                    const filtered = localBills.filter(b => b.billNumber !== orderNo && b.orderNumber !== orderNo && b._id !== orderId && b.id !== orderId);
                    localStorage.setItem('poultry_history_bills', JSON.stringify(filtered));
                }
            } catch (e) { console.warn("Failed clearing order from poultry_history_bills", e); }

            // Clean from poultry_paid_bills
            try {
                const rawPaid = localStorage.getItem('poultry_paid_bills');
                if (rawPaid) {
                    const paidMap = JSON.parse(rawPaid);
                    delete paidMap[orderNo];
                    delete paidMap[orderId];
                    localStorage.setItem('poultry_paid_bills', JSON.stringify(paidMap));
                }
            } catch (e) { }

            alert("Bill deleted successfully");
            loadOrders();
        } catch (err) {
            console.error(err);
            alert("Failed to delete bill: " + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="simple-page order-history-page">
            <div className="orders-page-header">
                <div className="header-top">
                    <div>
                        <h1 className="page-title">{t('orders.title')}</h1>
                        <p className="page-subtitle">Track and manage past sales across all channels</p>
                    </div>
                    <div className="stats-pill">
                        <span className="stats-number">{orders.length}</span>
                        <span className="stats-label">Sales Found</span>
                    </div>
                </div>

                <div className="filters-container">
                    <div className="filter-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Date</span>
                            {filterDate && (
                                <button
                                    onClick={() => setFilterDate('')}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        padding: '0 4px',
                                        fontWeight: '600'
                                    }}
                                    title="Show all history without date filter"
                                >
                                    Clear
                                </button>
                            )}
                        </label>
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

                    <div className="filter-group" style={{ minWidth: '220px' }}>
                        <label>Search Customer / Phone</label>
                        <div className="input-wrapper">
                            <span className="input-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Enter name, phone, or bill #"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="filter-input"
                            />
                        </div>
                    </div>

                    {user?.businessType === 'restaurant' && (
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
                                    <option value="LINE_POS">🚚 Line POS</option>
                                    <option value="takeaway">🥡 Takeaway</option>
                                    <option value="dine-in">Dine-In</option>
                                </select>
                            </div>
                        </div>
                    )}

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

                    {(user?.role === 'owner' || user?.role === 'manager' || user?.role === 'stakeholder') && (
                        <div className="filter-group">
                            <label>Employee / Biller</label>
                            <div className="input-wrapper">
                                <span className="input-icon">👤</span>
                                <select
                                    value={filterEmployee}
                                    onChange={(e) => setFilterEmployee(e.target.value)}
                                    className="filter-input"
                                >
                                    <option value="All">All Staff / Owner</option>
                                    {Array.from(new Set(orders.map(o => extractBillerMeta(o).billerName).filter(Boolean))).map(empName => (
                                        <option key={empName} value={empName}>👤 {empName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="filter-group filter-action" style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={loadOrders} className="refresh-btn">
                            <span className="btn-icon">↻</span> Refresh
                        </button>
                        <button
                            onClick={async () => {
                                if (!window.confirm("Are you sure you want to CLEAR ALL order history? This action cannot be undone.")) return;
                                if (!window.confirm("FINAL WARNING: This will PERMANENTLY DELETE all orders for your restaurant. Proceed?")) return;
                                try {
                                    await api.delete('/orders/history/clear');
                                } catch (e) {
                                    console.warn("Backend history clear notice:", e);
                                }
                                try {
                                    localStorage.removeItem('km_offline_orders_queue');
                                    localStorage.removeItem('poultry_history_bills');
                                    localStorage.removeItem('poultry_paid_bills');
                                    localStorage.removeItem('km_offline_orders_counter');
                                } catch (e) { }
                                alert("Order history cleared successfully");
                                setOrders([]);
                            }}
                            className="refresh-btn"
                            style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                        >
                            <span className="btn-icon">🗑️</span> Clear All
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
                    {(() => {
                        const userFiltered = filterOrdersForUser(orders, user);
                        const displayedOrders = filterEmployee === 'All'
                            ? userFiltered
                            : userFiltered.filter(o => extractBillerMeta(o).billerName === filterEmployee);

                        if (displayedOrders.length === 0) {
                            return (
                                <div className="empty-state">
                                    <div className="empty-icon">📭</div>
                                    <h3>No Orders Found</h3>
                                    <p>Try adjusting your filters to see more results.</p>
                                </div>
                            );
                        }

                        return displayedOrders.map(o => {
                            const isLinePos = o.orderType?.toUpperCase() === 'LINE_POS' || o.source === 'line_pos' || o.tableNumber?.startsWith('SHOP-') || (o.customerName && !o.tableNumber);
                            const isPoultry = o.source === 'poultry' || o.orderType === 'POULTRY_POS';
                            const billNo = getDisplayOrderNumber(o);
                            const billerMeta = extractBillerMeta(o);

                            return (
                                <div key={o._id || o.id} className="modern-order-card" style={{
                                    borderLeft: `4px solid ${STATUS_COLORS[o.status?.toLowerCase()] || 'var(--accent)'}`,
                                    border: `1px solid ${STATUS_COLORS[o.status?.toLowerCase()] || 'var(--accent)'}`
                                }}>
                                    <div className="card-header">
                                        <div className="card-header-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span className={`type-badge ${isLinePos ? 'line-pos' : isPoultry ? 'poultry' : (o.orderType || 'takeaway')}`}>
                                                    {isLinePos ? '🚚 Line POS' : isPoultry ? '🐔 Poultry' : o.orderType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-In'}
                                                </span>
                                                <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                                    👤 Biller: {billerMeta.billerName} {billerMeta.employeeCode ? `(${billerMeta.employeeCode})` : ''}
                                                </span>
                                            </div>
                                            <h3 className="table-identifier">
                                                {isLinePos ? `🚚 ${o.customerName || 'Distributor'} — Bill #${billNo}` :
                                                    isPoultry ? `🐔 Poultry — Bill #${billNo}` :
                                                        user?.businessType === 'restaurant' ? (o.tableNumber ? o.tableNumber : (o.tokenNumber ? `Token ${o.tokenNumber}` : `Bill #${billNo}`)) :
                                                            `Bill #${billNo}`}
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
                                                {o.items?.slice(0, 3).map(i => {
                                                    const q = Math.abs(i.quantity ?? i.qty ?? 1);
                                                    const n = i.name || i.itemName || 'Item';
                                                    const isRet = i.itemType === 'RETURN' || i.isReturn || n.includes('(Return)');
                                                    const isFr = i.itemType === 'FREE' || i.isFree || n.includes('(Free)');
                                                    return `${q}x ${n}${isRet ? ' ↩' : isFr ? ' 🎁' : ''}`;
                                                }).join(', ')}
                                                {o.items?.length > 3 && ' ...'}
                                            </p>
                                        </div>

                                        {o.rating && (
                                            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ color: '#FFD700', fontSize: '14px', marginBottom: '4px' }}>
                                                    {'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}
                                                </div>
                                                {o.feedback && (
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                                                        "{o.feedback}"
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-footer">
                                        <div className="footer-left">
                                            <span className="total-label">Total</span>
                                            <span className="total-amount">&#8377;{(o.total || o.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="footer-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                            <button
                                                className="icon-btn print-action"
                                                onClick={() => handleA4Invoice(o)}
                                                title="Download A4 Invoice"
                                            >
                                                📄
                                            </button>
                                            <button
                                                className="icon-btn print-action"
                                                onClick={() => handleWhatsApp(o)}
                                                title="Send via WhatsApp"
                                                style={{ color: '#25D366' }}
                                            >
                                                💬
                                            </button>
                                            {(user?.role === 'owner' || user?.role === 'manager') && (
                                                <button
                                                    className="icon-btn print-action"
                                                    onClick={() => handleDeleteOrder(o)}
                                                    title="Delete Bill"
                                                    style={{ color: '#ef4444' }}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
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
