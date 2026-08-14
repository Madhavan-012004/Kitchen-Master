import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import socket from '../api/socket.js';
import './PoultryHistory.css';

export default function PoultryHistory() {
    const today = new Date().toISOString().split('T')[0];
    const sevenAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];

    const [bills, setBills] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [from, setFrom] = useState(sevenAgo);
    const [to, setTo] = useState(today);
    const [clientId, setClientId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedBill, setExpandedBill] = useState(null);

    const fetchClients = () => {
        try {
            const localClients = localStorage.getItem('poultry_clients');
            if (localClients) {
                setClients(JSON.parse(localClients));
            }
        } catch (e) {
            console.warn('Failed to load local clients', e);
        }
    };

    const deleteBill = async (e, bill) => {
        e.stopPropagation();
        const id = bill._id || bill.id;
        if (!id) return;

        if (!window.confirm(`Are you sure you want to delete bill #${bill.billNumber || String(id).slice(-6)}? This action cannot be undone.`)) {
            return;
        }

        try {
            // Delete from remote Java backend if it was synced there
            try {
                await api.delete(`/orders/${id}`);
            } catch (err) {
                console.warn('Failed to delete remote order (might only be offline)', err);
            }

            // Delete from local cache
            let localBills = [];
            try {
                localBills = JSON.parse(localStorage.getItem('poultry_history_bills')) || [];
            } catch (e) { }

            localBills = localBills.filter(b => (b.id || b._id) !== id);
            localStorage.setItem('poultry_history_bills', JSON.stringify(localBills));

            // Remove any paid overrides
            let overrides = JSON.parse(localStorage.getItem('poultry_paid_bills')) || {};
            if (overrides[id]) {
                delete overrides[id];
                localStorage.setItem('poultry_paid_bills', JSON.stringify(overrides));
            }

            // Immediately remove from UI
            setBills(prev => prev.filter(b => (b.id || b._id) !== id));
            if (expandedBill === id) setExpandedBill(null);

        } catch (e) {
            console.warn('Failed to delete bill', e);
        }
    };

    const fetchBills = useCallback(async () => {
        setLoading(true);
        try {
            let fetchedBills = [];

            // 1. Fetch remote orders from standard POS fallback
            try {
                const res = await api.get('/orders/history');
                let genericBills = [];
                if (res.data?.data?.orders && Array.isArray(res.data.data.orders)) {
                    genericBills = res.data.data.orders;
                } else if (res.data?.data && Array.isArray(res.data.data)) {
                    genericBills = res.data.data;
                }

                // Filter and reconstruct
                const remotePoultry = genericBills.filter((b) => b.source === 'poultry' || (b.notes && b.notes.includes('||CLIENTID:')) || (b.notes && b.notes.includes('||BILLNO:')));

                remotePoultry.forEach((b) => {
                    let clientId = null;
                    let parsedBillNo = b.billNumber || b.orderNumber || b._id || b.id;
                    if (b.notes) {
                        try {
                            const cMatch = b.notes.match(/\|\|CLIENTID:([^|]+)\|\|/);
                            if (cMatch && cMatch[1]) clientId = cMatch[1];
                            const bMatch = b.notes.match(/\|\|BILLNO:([^|]+)\|\|/);
                            if (bMatch && bMatch[1]) parsedBillNo = bMatch[1];
                        } catch (e) { }
                    }

                    fetchedBills.push({
                        ...b,
                        id: parsedBillNo,
                        _id: parsedBillNo,
                        billNumber: parsedBillNo,
                        orderNumber: parsedBillNo,
                        client: clientId ? { id: clientId } : null,
                        grandTotal: b.totalAmount || b.grandTotal || b.total || 0,
                        createdAt: b.createdAt || b.orderDate || b.date || new Date().toISOString()
                    });
                });
            } catch (e) {
                console.warn('Failed remote /orders sync', e);
            }

            // 2. Merge with offline Cache
            try {
                const rawLocal = localStorage.getItem('poultry_history_bills');
                if (rawLocal) {
                    const localBills = JSON.parse(rawLocal);
                    localBills.forEach((offlineBill) => {
                        const existsIndex = fetchedBills.findIndex(b => (b.id || b._id) === (offlineBill.id || offlineBill._id));
                        if (existsIndex >= 0) {
                            fetchedBills[existsIndex] = { ...fetchedBills[existsIndex], ...offlineBill, _synced: true };
                        } else {
                            fetchedBills.push(offlineBill);
                        }
                    });
                }
            } catch (e) { }

            // Sort by latest
            fetchedBills.sort((a, b) => new Date(b.createdAt || new Date().toISOString()) - new Date(a.createdAt || new Date().toISOString()));

            // Apply JS-side overriding of Paid/Unpaid status
            const overrides = JSON.parse(localStorage.getItem('poultry_paid_bills')) || {};
            fetchedBills = fetchedBills.map(b => {
                const id = b._id || b.id;
                if (overrides[id]) {
                    if (overrides[id].force === 'UNPAID') {
                        return { ...b, paymentMethod: 'CREDIT', status: 'PENDING', _overridden: true };
                    } else if (overrides[id].force === 'PAID' || overrides[id] === true) {
                        return { ...b, paymentMethod: 'CASH', status: 'PAID', _overridden: true };
                    }
                }
                return b;
            });

            // Apply JS-side caching
            localStorage.setItem('poultry_history_bills', JSON.stringify(fetchedBills));

            // Filtering in JS
            const fromTime = new Date(from + 'T00:00:00').getTime();
            const toTime = new Date(to + 'T23:59:59').getTime();

            fetchedBills = fetchedBills.filter((b) => {
                const bTime = new Date(b.createdAt || new Date().toISOString()).getTime();
                if (bTime < fromTime || bTime > toTime) return false;
                if (clientId && b.client?.id !== clientId && b.client?._id !== clientId) return false;
                if (statusFilter && b.paymentMethod !== statusFilter && b.status !== statusFilter) return false;
                return true;
            });

            setBills(fetchedBills);
        } catch (e) {
            console.warn('Poultry bills load error:', e);
        } finally {
            setLoading(false);
        }
    }, [from, to, clientId, statusFilter]);

    useEffect(() => { fetchClients(); }, []);
    useEffect(() => { fetchBills(); }, [fetchBills]);

    // Real-time synchronization for remote POS drops
    useEffect(() => {
        if (socket) {
            socket.on('kot:new', fetchBills);
            socket.on('kot:update', fetchBills);
            socket.on('billing:newRequest', fetchBills);

            return () => {
                socket.off('kot:new', fetchBills);
                socket.off('kot:update', fetchBills);
                socket.off('billing:newRequest', fetchBills);
            };
        }
    }, [fetchBills]);

    const togglePaid = async (e, bill) => {
        e.stopPropagation();
        const id = bill._id || bill.id;
        if (!id) return;

        let overrides = JSON.parse(localStorage.getItem('poultry_paid_bills')) || {};

        // Determine current effective status
        const isCurrentlyPaid = bill.status === 'PAID' || bill.paymentMethod !== 'CREDIT';

        // Toggle state in local storage (Save explicit object rather than boolean)
        if (isCurrentlyPaid) {
            // We want to force it to UNPAID
            overrides[id] = { force: 'UNPAID' };
        } else {
            // We want to force it to PAID
            overrides[id] = { force: 'PAID' };
        }

        // Adjust customer pending amount (Add if reverting to UNPAID, Deduct if marking PAID)
        const clientId = bill.client?.id || bill.client?._id;
        if (clientId) {
            try {
                // 1. Update the backend if reachable
                const cRes = await api.get(`/customers/${clientId}`);
                const cData = cRes.data?.data || cRes.data;
                let meta = {};
                if (cData.email && cData.email.startsWith('||META:')) {
                    try { meta = JSON.parse(cData.email.replace('||META:', '')); } catch (e) { }
                }
                const billTotal = bill.grandTotal || bill.total || 0;

                if (isCurrentlyPaid) {
                    // Reverting to UNPAID
                    meta.pendingAmount = (meta.pendingAmount || 0) + billTotal;
                } else {
                    // Marking as PAID
                    meta.pendingAmount = Math.max(0, (meta.pendingAmount || 0) - billTotal);
                }

                await api.post(`/customers`, {
                    name: cData.name,
                    phone: cData.phone,
                    email: '||META:' + JSON.stringify(meta)
                });
            } catch (err) {
                console.warn('Backend update failed, falling back to local storage cache');
            }

            // 2. Critically: ALWAYS update the offline cache so the Client UI immediately recalculates it natively!
            try {
                const localClientsRaw = localStorage.getItem('poultry_clients');
                if (localClientsRaw) {
                    const localClients = JSON.parse(localClientsRaw);
                    const clientIndex = localClients.findIndex(c => c.id === clientId || c._id === clientId);
                    if (clientIndex >= 0) {
                        const billTotal = bill.grandTotal || bill.total || 0;
                        if (isCurrentlyPaid) {
                            localClients[clientIndex].pendingAmount = (localClients[clientIndex].pendingAmount || 0) + billTotal;
                        } else {
                            localClients[clientIndex].pendingAmount = Math.max(0, (localClients[clientIndex].pendingAmount || 0) - billTotal);
                        }
                        localStorage.setItem('poultry_clients', JSON.stringify(localClients));
                    }
                }
            } catch (e) { console.error('Cache update error', e); }
        }

        localStorage.setItem('poultry_paid_bills', JSON.stringify(overrides));

        // Fire real server status patch so history pages sync!
        try {
            if (!String(id).startsWith('OFFLINE-')) {
                await api.patch(`/orders/${id}/status`, {
                    status: isCurrentlyPaid ? 'PENDING' : 'PAID',
                    paymentStatus: isCurrentlyPaid ? 'PENDING' : 'PAID',
                    paymentMethod: isCurrentlyPaid ? 'CREDIT' : 'CASH'
                });
            }
        } catch (e) {
            console.warn('Failed to sync payment status change remotely', e);
        }

        // Update local state instantly
        setBills(prev => prev.map(b => {
            if ((b._id || b.id) === id) {
                if (isCurrentlyPaid) {
                    return { ...b, paymentMethod: 'CREDIT', status: 'PENDING', _overridden: true };
                } else {
                    return { ...b, paymentMethod: 'CASH', status: 'PAID', _overridden: true };
                }
            }
            return b;
        }));
    };

    // Summary calculations
    const totalRevenue = bills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
    const totalPending = bills.reduce((s, b) => s + (b.paymentMethod === 'CREDIT' || b.status === 'PENDING' ? (b.grandTotal || b.total || 0) : 0), 0);
    const billCount = bills.length;

    const fmtMoney = (n) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const statusColor = (b) => {
        const pm = (b.paymentMethod || '').toUpperCase();
        if (pm === 'CREDIT' || b.status === 'PENDING') return 'ph-badge-orange';
        if (pm === 'CASH') return 'ph-badge-green';
        if (pm === 'UPI') return 'ph-badge-blue';
        if (pm === 'CARD') return 'ph-badge-purple';
        return 'ph-badge-grey';
    };

    return (
        <div className="ph-page">
            {/* Topbar */}
            <div className="ph-topbar">
                <div>
                    <h1 className="ph-title">Ledger</h1>
                    <div className="ph-subtitle">BILLS & LEDGER</div>
                </div>
                <div className="ph-filters">
                    <div className="ph-filter-group">
                        <label>From</label>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="ph-date-input" />
                    </div>
                    <div className="ph-filter-group">
                        <label>To</label>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="ph-date-input" />
                    </div>
                    <div className="ph-filter-group">
                        <label>Client</label>
                        <select value={clientId} onChange={e => setClientId(e.target.value)} className="ph-select">
                            <option value="">All Clients</option>
                            {clients.map(c => (
                                <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="ph-filter-group">
                        <label>Payment</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ph-select">
                            <option value="">All</option>
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="CARD">Card</option>
                            <option value="CREDIT">Credit</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="ph-apply-btn" onClick={fetchBills}>Apply</button>
                        <button
                            className="ph-apply-btn"
                            style={{ background: '#ef4444', color: '#fff' }}
                            onClick={() => {
                                if (!window.confirm("Are you sure you want to clear ALL offline poultry bills from this device? This action cannot be undone.")) return;
                                localStorage.removeItem('poultry_history_bills');
                                localStorage.removeItem('poultry_paid_bills');
                                setBills([]);
                                alert("Local offline bills cleared successfully.");
                                fetchBills();
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Strip */}
            <div className="ph-summary-strip">
                {[
                    { label: 'Total Sales', value: fmtMoney(totalRevenue), color: '#C6F53D', icon: '💰' },
                    { label: 'Pending / Credit', value: fmtMoney(totalPending), color: '#fbbf24', icon: '⏳' },
                    { label: 'Bills Count', value: billCount, color: '#60a5fa', icon: '🧾' },
                    { label: 'Collected', value: fmtMoney(totalRevenue - totalPending), color: '#34d399', icon: '✅' },
                ].map((s, i) => (
                    <div key={i} className="ph-summary-card">
                        <div className="ph-summary-icon">{s.icon}</div>
                        <div className="ph-summary-label">{s.label}</div>
                        <div className="ph-summary-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Bills Table */}
            <div className="ph-body">
                {loading ? (
                    <div className="ph-loading">Loading bills…</div>
                ) : bills.length === 0 ? (
                    <div className="ph-empty">
                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🧾</div>
                        <div>No bills found for the selected period.</div>
                        <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.5 }}>Try adjusting the date range or filters above.</div>
                    </div>
                ) : (
                    <div className="ph-table-wrapper">
                        <table className="ph-table">
                            <thead>
                                <tr>
                                    <th>Bill #</th>
                                    <th>Date &amp; Time</th>
                                    <th>Client</th>
                                    <th>Items</th>
                                    <th>Subtotal</th>
                                    <th>Discount</th>
                                    <th>Total</th>
                                    <th>Payment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map(bill => {
                                    const billId = bill._id || bill.id;
                                    const isExpanded = expandedBill === billId;
                                    return (
                                        <React.Fragment key={billId}>
                                            <tr
                                                className={`ph-row ${isExpanded ? 'expanded' : ''}`}
                                                onClick={() => setExpandedBill(isExpanded ? null : billId)}
                                            >
                                                <td className="ph-bill-num">#{bill.billNumber || bill.orderNumber || String(billId).slice(-6)}</td>
                                                <td className="ph-date">{fmtDate(bill.createdAt || bill.date)}</td>
                                                <td className="ph-client">{bill.clientName || bill.client?.name || <span className="ph-walkin">Walk-in</span>}</td>
                                                <td className="ph-items-count">{(bill.items || []).length} item{(bill.items || []).length !== 1 ? 's' : ''}</td>
                                                <td>{fmtMoney(bill.subtotal)}</td>
                                                <td className="ph-discount">{bill.discount > 0 ? `— ${fmtMoney(bill.discount)}` : '—'}</td>
                                                <td className="ph-total">{fmtMoney(bill.grandTotal || bill.total)}</td>
                                                <td>
                                                    <span className={`ph-badge ${statusColor(bill)}`}>
                                                        {bill.paymentMethod || 'CASH'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className={`ph-status-toggle ${bill.status === 'PAID' || bill.paymentMethod !== 'CREDIT' ? 'is-paid' : 'is-unpaid'}`}
                                                            onClick={(e) => togglePaid(e, bill)}
                                                            title={bill.status === 'PAID' || bill.paymentMethod !== 'CREDIT' ? 'Click to revert to UNPAID' : 'Click to mark as PAID'}
                                                        >
                                                            {bill.status === 'PAID' || bill.paymentMethod !== 'CREDIT' ? 'PAID' : 'UNPAID ▼'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ph-delete-btn"
                                                            onClick={(e) => deleteBill(e, bill)}
                                                            title="Delete Bill"
                                                            style={{
                                                                background: '#fee2e2',
                                                                color: '#ef4444',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                width: '32px',
                                                                height: '32px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                fontSize: '16px'
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="ph-expand-row">
                                                    <td colSpan="9">
                                                        <div className="ph-expand-panel">
                                                            <table className="ph-items-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Item</th>
                                                                        <th>Rate</th>
                                                                        <th>Weight / Qty</th>
                                                                        <th>Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(bill.items || []).map((item, idx) => (
                                                                        <tr key={idx}>
                                                                            <td>{item.name || item.itemName}</td>
                                                                            <td>₹{item.rate || item.sellingPrice || 0}/{item.quantityType || 'kg'}</td>
                                                                            <td>{item.weight > 0 ? `${item.weight} kg` : `${item.qty || item.quantity || 0} pcs`}</td>
                                                                            <td style={{ color: '#C6F53D', fontWeight: 700 }}>₹{(item.amount || item.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            {bill.notes && (
                                                                <div className="ph-notes">📝 {bill.notes}</div>
                                                            )}
                                                            {(bill.paymentMethod === 'CREDIT' || bill.status === 'PENDING') && !bill._overridden && (
                                                                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={(e) => togglePaid(e, bill)}
                                                                        style={{ padding: '8px 16px', backgroundColor: '#a3e635', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                    >
                                                                        ✓ Mark as PAID
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
