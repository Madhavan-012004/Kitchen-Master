import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import './Expenditures.css';

export default function Expenditures() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('invoice'); // 'invoice' or 'all'
    const [formData, setFormData] = useState({
        amount: '',
        category: 'Maintenance',
        description: '',
        paymentMethod: 'Cash',
        paymentStatus: 'PAID',
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = ['Maintenance', 'Rent', 'Electricity', 'Water', 'Salary', 'Inventory Purchase', 'Marketing', 'Others'];

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/transactions');
            setTransactions(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch transactions', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                date: new Date(formData.date).toISOString()
            };
            await api.post('/transactions', payload);
            setShowModal(false);
            setFormData({
                amount: '',
                category: 'Maintenance',
                description: '',
                paymentMethod: 'Cash',
                paymentStatus: 'PAID',
                invoiceNumber: '',
                date: new Date().toISOString().split('T')[0]
            });
            fetchTransactions();
        } catch (err) {
            alert('Failed to record expenditure');
        }
    };

    const handleToggleStatus = async (transaction) => {
        const newStatus = transaction.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        try {
            await api.put(`/transactions/${transaction.id}/status`, { status: newStatus });
            fetchTransactions();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            fetchTransactions();
        } catch (err) {
            alert('Failed to delete record');
        }
    };

    const handleWipe = async () => {
        if (!window.confirm('⚠️ WARNING: Are you sure you want to completely WIPE the entire expenditure ledger? This cannot be undone.')) return;
        setLoading(true);
        try {
            await api.delete('/transactions/wipe');
            alert('Ledger wiped successfully!');
            fetchTransactions();
        } catch (err) {
            alert('Failed to wipe ledger');
        } finally {
            setLoading(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesCat = filter === 'All' || t.category === filter;
        if (!matchesCat) return false;
        
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        
        const dateStr = new Date(t.date).toLocaleDateString('en-IN').toLowerCase();
        const invoiceMatch = t.invoiceNumber?.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        const dateMatch = dateStr.includes(q);
        
        return invoiceMatch || descMatch || dateMatch;
    });

    // Group transactions by invoice number (for invoice view)
    const groupedByInvoice = React.useMemo(() => {
        const groups = {};
        filteredTransactions.forEach(t => {
            const key = t.invoiceNumber || `__solo__${t.id}`;
            if (!groups[key]) {
                groups[key] = {
                    invoiceNumber: t.invoiceNumber || null,
                    transactions: [],
                    totalAmount: 0,
                    totalGst: 0,
                    totalDiscount: 0,
                    latestDate: t.date,
                    category: t.category,
                    paymentMethod: t.paymentMethod,
                    paymentStatus: t.paymentStatus || 'PAID',
                    itemCount: 0,
                };
            }
            groups[key].transactions.push(t);
            groups[key].totalAmount += t.amount || 0;
            groups[key].totalGst += t.gstAmount || 0;
            groups[key].totalDiscount += t.discountAmount || 0;
            groups[key].itemCount += t.itemCount || 1;
            // Aggregate status: if any transaction is UNPAID, the invoice is UNPAID
            if (t.paymentStatus === 'UNPAID') {
                groups[key].paymentStatus = 'UNPAID';
            }
            if (new Date(t.date) > new Date(groups[key].latestDate)) {
                groups[key].latestDate = t.date;
            }
        });
        return Object.values(groups).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
    }, [filteredTransactions]);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalPaid = transactions
        .filter(t => t.paymentStatus === 'PAID')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalUnpaid = transactions
        .filter(t => t.paymentStatus === 'UNPAID')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalDiscount = transactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);

    return (
        <div className="expenditures-page">
            <StakeholderRestaurantTabs />
            <header className="exp-header">
                <div className="title-group">
                    <h1>📒 Expenditure Ledger</h1>
                    <p>Track purchases, maintenance, utilities, and operational costs</p>
                </div>
                <div className="header-actions">
                    <button className="wipe-btn" onClick={handleWipe} disabled={loading || transactions.length === 0}>
                        🗑️ Wipe Ledger
                    </button>
                    <button className="add-exp-btn" onClick={() => setShowModal(true)}>
                        <span>+</span> Record New Expense
                    </button>
                </div>
            </header>

            <div className="exp-stats-grid">
                <div className="exp-stat-card primary">
                    <label>Total Expenditure</label>
                    <div className="value">₹{totalExpense.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                    <div className="trend">{transactions.length} transactions</div>
                </div>
                <div className="exp-stat-card">
                    <label>Paid Amount</label>
                    <div className="value status-paid">₹{totalPaid.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                </div>
                <div className="exp-stat-card">
                    <label>Amount to Pay</label>
                    <div className="value status-unpaid">₹{totalUnpaid.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                </div>
                <div className="exp-stat-card">
                    <label>Inventory Purchases</label>
                    <div className="value">
                        ₹{transactions.filter(t => t.category === 'Inventory Purchase').reduce((s,t) => s+t.amount, 0).toLocaleString('en-IN', {maximumFractionDigits:2})}
                    </div>
                </div>
            </div>

            <div className="exp-controls">
                {/* View Mode Toggle */}
                <div className="view-mode-group">
                    <button
                        className={`view-mode-btn ${viewMode === 'invoice' ? 'active' : ''}`}
                        onClick={() => setViewMode('invoice')}
                    >
                        🧾 By Invoice
                    </button>
                    <button
                        className={`view-mode-btn ${viewMode === 'all' ? 'active' : ''}`}
                        onClick={() => setViewMode('all')}
                    >
                        📋 All Transactions
                    </button>
                </div>

                <div className="search-bar" style={{ display: 'flex', flex: 1, margin: '0 15px' }}>
                    <input 
                        type="text" 
                        placeholder="Search by invoice, account, or date..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                </div>

                <div className="filter-tabs">
                    {['All', ...categories].map(cat => (
                        <button
                            key={cat}
                            className={`filter-tab ${filter === cat ? 'active' : ''}`}
                            onClick={() => setFilter(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="exp-table-container">
                {loading ? (
                    <div className="loading-state">Loading ledger...</div>
                ) : viewMode === 'invoice' ? (
                    /* ── INVOICE-GROUPED VIEW ── */
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice #</th>
                                <th>Category</th>
                                <th>Description / Items</th>
                                <th>Method</th>
                                <th>Payment Status</th>
                                <th style={{textAlign:'right'}}>Total Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByInvoice.map((group, idx) => {
                                const desc = group.transactions.map(t => t.description).filter(Boolean).join(' | ');
                                return (
                                    <tr key={group.invoiceNumber || `inv-${idx}`} className={group.invoiceNumber ? 'invoice-row' : ''}>
                                        <td>
                                            <div className="date">{new Date(group.latestDate).toLocaleDateString('en-IN')}</div>
                                            <small>{new Date(group.latestDate).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</small>
                                        </td>
                                        <td>
                                            {group.invoiceNumber
                                                ? <span className="invoice-pill">🧾 {group.invoiceNumber}</span>
                                                : <span style={{opacity:0.4,fontSize:'12px'}}>—</span>
                                            }
                                            {group.itemCount > 1 && <small style={{display:'block',opacity:0.6,fontSize:'11px'}}>{group.itemCount} items</small>}
                                        </td>
                                        <td>
                                            <span className={`cat-pill ${group.category?.replace(' ', '-').toLowerCase()}`}>
                                                {group.category}
                                            </span>
                                        </td>
                                        <td className="desc-cell">{desc || 'No description'}</td>
                                        <td>{group.paymentMethod}</td>
                                        <td>
                                            <button 
                                                className={`status-pill ${group.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}`}
                                                onClick={() => {
                                                    // Toggle first transaction's status as proxy for the whole invoice
                                                    if (group.transactions.length > 0) handleToggleStatus(group.transactions[0]);
                                                }}
                                            >
                                                {group.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}
                                            </button>
                                        </td>
                                        <td className="amt-cell expense" style={{textAlign:'right'}}>
                                            ₹{group.totalAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}
                                        </td>
                                        <td>
                                            <div style={{display:'flex', gap:'8px'}}>
                                                <button 
                                                    className="icon-btn-small" 
                                                    style={{background:'rgba(59,130,246,0.1)',color:'#3b82f6',border:'none',borderRadius:'6px',padding:'6px',cursor:'pointer',fontSize:'12px'}}
                                                    onClick={() => setSelectedInvoice(group)}
                                                >
                                                    👁️ View Details
                                                </button>
                                                {group.transactions.length === 1 && (
                                                    <button className="del-btn" onClick={() => handleDelete(group.transactions[0].id)}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {groupedByInvoice.length === 0 && (
                                <tr><td colSpan="9" className="empty-row">No expenditure records found</td></tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    /* ── ALL TRANSACTIONS VIEW ── */
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Invoice #</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th style={{textAlign:'right'}}>Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="date">{new Date(t.date).toLocaleDateString('en-IN')}</div>
                                        <small>{new Date(t.date).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</small>
                                    </td>
                                    <td>
                                        {t.invoiceNumber
                                            ? <span className="invoice-pill">🧾 {t.invoiceNumber}</span>
                                            : <span style={{opacity:0.4,fontSize:'12px'}}>—</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`cat-pill ${t.category?.replace(' ', '-').toLowerCase()}`}>
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="desc-cell">{t.description || 'No description'}</td>
                                    <td>{t.paymentMethod}</td>
                                    <td>
                                        <button 
                                            className={`status-pill ${t.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}`}
                                            onClick={() => handleToggleStatus(t)}
                                        >
                                            {t.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}
                                        </button>
                                    </td>
                                    <td className="amt-cell expense" style={{textAlign:'right'}}>₹{t.amount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                                    <td>
                                        <button className="del-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr><td colSpan="9" className="empty-row">No expenditure records found</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="exp-modal-overlay">
                    <div className="exp-modal">
                        <div className="modal-header">
                            <h2>Log Expenditure</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    required
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Payment Method</label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI / GPay</option>
                                        <option value="Card">Credit Card</option>
                                        <option value="Bank">Bank Transfer</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Initial Status</label>
                                    <select
                                        value={formData.paymentStatus}
                                        onChange={(e) => setFormData({...formData, paymentStatus: e.target.value})}
                                    >
                                        <option value="PAID">Paid</option>
                                        <option value="UNPAID">Unpaid</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Invoice Number <span style={{fontWeight:'normal',opacity:0.6}}>(optional)</span></label>
                                    <input
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                                        placeholder="e.g. INV-2024-001"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description / Reason</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="e.g. A/C Servicing, Floor repair..."
                                    rows="3"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="primary-btn">Save Expenditure</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedInvoice && (
                <div className="exp-modal-overlay">
                    <div className="exp-modal" style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header">
                            <h2>Invoice Details: {selectedInvoice.invoiceNumber || 'N/A'}</h2>
                            <button className="close-btn" onClick={() => setSelectedInvoice(null)}>✕</button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: 'var(--bg-hover)', padding: '15px', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Supplier</div>
                                    <div style={{ fontWeight: 'bold' }}>{selectedInvoice.transactions[0]?.description?.split(' - ')[0] || 'Unknown'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Amount</div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '18px' }}>₹{selectedInvoice.totalAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status</div>
                                    <div style={{ fontWeight: 'bold' }}>{selectedInvoice.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}</div>
                                </div>
                            </div>

                            <table className="exp-table" style={{ marginTop: '0' }}>
                                <thead>
                                    <tr>
                                        <th>Item Description</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoice.transactions.map(t => (
                                        <tr key={t.id}>
                                            <td>{t.description}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{t.amount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
