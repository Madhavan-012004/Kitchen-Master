import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/client';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import InvoiceOcrModal from '../components/InvoiceOcrModal';
import { toast } from 'react-hot-toast';
import { ScanLine, X, Plus, Package } from 'lucide-react';
import './Expenditures.css';

const COLORS = {
    bg: 'var(--bg-main)',
    surface: 'var(--bg-card)',
    surfaceHover: 'var(--bg-card-hover)',
    border: 'var(--border)',
    accent: '#C6F53D',
    accentDark: '#a8d92e',
    text: 'var(--text-primary)',
    textMuted: 'var(--text-secondary)',
    green: '#10b981',
    red: '#ef4444',
    blue: '#60a5fa',
    amber: '#fbbf24',
    headBg: 'rgba(198,245,61,0.04)',
};

export default function Expenditures() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('vendors'); // 'invoice', 'all', 'vendors'
    
    const [formData, setFormData] = useState({
        amount: '', category: 'Maintenance', description: '', paymentMethod: 'Cash', paymentStatus: 'PAID', invoiceNumber: '', date: new Date().toISOString().split('T')[0]
    });
    const categories = ['Maintenance', 'Rent', 'Electricity', 'Water', 'Salary', 'Inventory Purchase', 'Marketing', 'Others'];

    // Vendor and Purchase States
    const [vendors, setVendors] = useState([]);
    const [vendorLoading, setVendorLoading] = useState(false);
    const [purchases, setPurchases] = useState([]);
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [selectedVendorForInvoices, setSelectedVendorForInvoices] = useState(null);
    const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState(null);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/transactions');
            setTransactions(res.data.data || []);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    }, []);

    const fetchVendors = useCallback(async () => {
        setVendorLoading(true);
        try {
            const res = await api.get('/api/vendors');
            setVendors(res.data.data || []);
        } catch (err) { console.error(err); toast.error('Failed to load vendors'); } 
        finally { setVendorLoading(false); }
    }, []);

    const fetchPurchases = useCallback(async () => {
        setPurchaseLoading(true);
        try {
            const res = await api.get('/api/purchases');
            setPurchases(res.data.data || []);
        } catch (err) { console.error(err); } 
        finally { setPurchaseLoading(false); }
    }, []);

    useEffect(() => {
        fetchTransactions();
        fetchVendors();
        fetchPurchases();
    }, [fetchTransactions, fetchVendors, fetchPurchases]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let finalDesc = formData.description;
            if (formData.category === 'Inventory Purchase' && formData.vendorName) {
                finalDesc = `${formData.vendorName} - ${formData.description || 'Inventory Stock'}`;
            }
            const payload = { ...formData, description: finalDesc, date: new Date(formData.date).toISOString() };
            await api.post('/transactions', payload);
            setShowModal(false);
            setFormData({ amount: '', category: 'Maintenance', description: '', paymentMethod: 'Cash', paymentStatus: 'PAID', invoiceNumber: '', date: new Date().toISOString().split('T')[0], vendorName: '' });
            fetchTransactions();
        } catch (err) { alert(err.response?.data?.message || err.response?.data || 'Failed to record expenditure'); }
    };

    const handleToggleStatus = async (transaction) => {
        const newStatus = transaction.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        try {
            await api.put(`/transactions/${transaction.id}/status`, { status: newStatus });
            fetchTransactions();
        } catch (err) { alert('Failed to update status'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            fetchTransactions();
        } catch (err) { alert('Failed to delete record'); }
    };

    const handleWipe = async () => {
        if (!window.confirm('⚠️ WARNING: Are you sure you want to completely WIPE the entire expenditure ledger? This cannot be undone.')) return;
        setLoading(true);
        try {
            await api.delete('/transactions/wipe');
            alert('Ledger wiped successfully!');
            fetchTransactions();
        } catch (err) { alert('Failed to wipe ledger'); } 
        finally { setLoading(false); }
    };

    const handleVendorSave = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        data.creditLimit = parseFloat(data.creditLimit || 0);

        try {
            if (editingVendor?._id || editingVendor?.id) {
                await api.put(`/api/vendors/${editingVendor.id || editingVendor._id}`, data);
                toast.success('Vendor updated');
            } else {
                await api.post('/api/vendors', data);
                toast.success('Vendor added');
            }
            setShowVendorModal(false);
            setEditingVendor(null);
            fetchVendors();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save vendor');
        }
    };

    const handleUpdatePurchasePayment = async (id, status) => {
        try {
            await api.put(`/api/purchases/${id}/payment`, { paymentStatus: status });
            toast.success('Payment status updated');
            fetchPurchases();
            fetchVendors();
        } catch (err) {
            toast.error('Failed to update payment');
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesCat = filter === 'All' || t.category === filter;
        if (!matchesCat) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (t.invoiceNumber?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || new Date(t.date).toLocaleDateString('en-IN').toLowerCase().includes(q));
    });

    const groupedByInvoice = useMemo(() => {
        const groups = {};
        filteredTransactions.forEach(t => {
            const key = t.invoiceNumber || `__solo__${t.id}`;
            if (!groups[key]) {
                groups[key] = { invoiceNumber: t.invoiceNumber || null, transactions: [], totalAmount: 0, totalGst: 0, totalDiscount: 0, latestDate: t.date, category: t.category, paymentMethod: t.paymentMethod, paymentStatus: t.paymentStatus || 'PAID', itemCount: 0 };
            }
            groups[key].transactions.push(t);
            groups[key].totalAmount += t.amount || 0;
            groups[key].itemCount += t.itemCount || 1;
            if (t.paymentStatus === 'UNPAID') groups[key].paymentStatus = 'UNPAID';
            if (new Date(t.date) > new Date(groups[key].latestDate)) groups[key].latestDate = t.date;
        });
        return Object.values(groups).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
    }, [filteredTransactions]);

    const filteredVendors = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return vendors.filter(v => (v.name || '').toLowerCase().includes(q) || (v.vendorCode || '').toLowerCase().includes(q));
    }, [vendors, searchQuery]);

    const vendorPurchasesList = useMemo(() => {
        if (!selectedVendorForInvoices) return [];
        return purchases.filter(p => p.vendorName === selectedVendorForInvoices.name).sort((a,b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
    }, [purchases, selectedVendorForInvoices]);

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch (e) { return dateStr; }
    }

    const parseItems = (jsonStr) => {
        if (!jsonStr) return [];
        try { return JSON.parse(jsonStr); } catch (e) { return []; }
    };

    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = transactions.filter(t => t.paymentStatus === 'PAID').reduce((sum, t) => sum + t.amount, 0);
    const totalUnpaid = transactions.filter(t => t.paymentStatus === 'UNPAID').reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="expenditures-page">
            <StakeholderRestaurantTabs />
            <header className="exp-header">
                <div className="title-group">
                    <h1>📒 Expenditure & Vendor Ledger</h1>
                    <p>Track purchases, vendors, maintenance, and utilities</p>
                </div>
                <div className="header-actions">

                    <button className="add-exp-btn" onClick={() => setShowModal(true)}>
                        <span>+</span> Record General Expense
                    </button>
                </div>
            </header>

            <div className="exp-stats-grid">
                <div className="exp-stat-card primary">
                    <label>General Expenditures</label>
                    <div className="value">₹{totalExpense.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                    <div className="trend">{transactions.length} transactions</div>
                </div>
                <div className="exp-stat-card">
                    <label>Amount to Pay (General)</label>
                    <div className="value status-unpaid">₹{totalUnpaid.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
                </div>
                <div className="exp-stat-card">
                    <label>Vendor Outstanding</label>
                    <div className="value status-unpaid" style={{color: COLORS.amber}}>
                        ₹{vendors.reduce((sum, v) => sum + (v.outstandingBalance || 0), 0).toLocaleString('en-IN', {maximumFractionDigits:2})}
                    </div>
                </div>
                <div className="exp-stat-card">
                    <label>Total Vendor Purchases</label>
                    <div className="value" style={{color: COLORS.green}}>
                        ₹{vendors.reduce((sum, v) => sum + (v.totalPurchased || 0), 0).toLocaleString('en-IN', {maximumFractionDigits:2})}
                    </div>
                </div>
            </div>

            <div className="exp-controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="view-mode-group" style={{ margin: 0, flexShrink: 0 }}>
                        <button className={`view-mode-btn ${viewMode === 'vendors' ? 'active' : ''}`} onClick={() => setViewMode('vendors')}>
                            🏢 Vendors
                        </button>
                        <button className={`view-mode-btn ${viewMode === 'invoice' ? 'active' : ''}`} onClick={() => setViewMode('invoice')}>
                            🧾 By Invoice
                        </button>
                        <button className={`view-mode-btn ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>
                            📋 All Transactions
                        </button>
                    </div>

                    <div className="search-bar" style={{ display: 'flex', flex: 1, margin: 0, minWidth: '250px' }}>
                        <input 
                            type="text" 
                            placeholder="Search by invoice, vendor, or description..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                    </div>

                    {viewMode === 'vendors' && (
                        <div className="header-actions" style={{ flexShrink: 0 }}>
                            <button onClick={() => { setEditingVendor(null); setShowVendorModal(true); }} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: `1px solid var(--border)`, padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Plus size={16} /> Add Vendor
                            </button>
                        </div>
                    )}
                </div>

                {viewMode !== 'vendors' && (
                    <div className="filter-tabs" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                        {['All', ...categories].map(cat => (
                            <button key={cat} className={`filter-tab ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>{cat}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="exp-table-container" style={{ background: 'var(--bg-card)', borderRadius: '12px' }}>
                {viewMode === 'vendors' ? (
                    vendorLoading ? <div className="loading-state">Loading vendors...</div> :
                    filteredVendors.length === 0 ? <div className="empty-row" style={{padding: '40px', textAlign: 'center'}}>No vendors found.</div> :
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>Vendor Name</th>
                                <th>Contact</th>
                                <th>GSTIN</th>
                                <th style={{ textAlign: 'right' }}>Total Purchased</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVendors.map(v => (
                                <tr key={v.id || v._id}>
                                    <td style={{ fontWeight: 'bold' }}>{v.name} {v.vendorCode && <span style={{opacity:0.5, fontSize:'11px', marginLeft:'8px'}}>{v.vendorCode}</span>}</td>
                                    <td>{v.phone || '—'} <br/><small style={{opacity:0.6}}>{v.email}</small></td>
                                    <td>{v.gstin || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(v.totalPurchased)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: v.outstandingBalance > 0 ? COLORS.amber : 'inherit' }}>{formatCurrency(v.outstandingBalance)}</td>
                                    <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        <button onClick={() => setSelectedVendorForInvoices(v)} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                            View Invoices
                                        </button>
                                        <button onClick={() => { setEditingVendor(v); setShowVendorModal(true); }} style={{ background: 'transparent', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : loading ? (
                    <div className="loading-state">Loading ledger...</div>
                ) : viewMode === 'invoice' ? (
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
                                        </td>
                                        <td>
                                            {group.invoiceNumber ? <span className="invoice-pill">🧾 {group.invoiceNumber}</span> : <span style={{opacity:0.4,fontSize:'12px'}}>—</span>}
                                        </td>
                                        <td><span className={`cat-pill ${group.category?.replace(' ', '-').toLowerCase()}`}>{group.category}</span></td>
                                        <td className="desc-cell">{desc || 'No description'}</td>
                                        <td>{group.paymentMethod}</td>
                                        <td>
                                            <button className={`status-pill ${group.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}`} onClick={() => { if (group.transactions.length > 0) handleToggleStatus(group.transactions[0]); }}>
                                                {group.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}
                                            </button>
                                        </td>
                                        <td className="amt-cell expense" style={{textAlign:'right'}}>₹{group.totalAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                                        <td>
                                            <div style={{display:'flex', gap:'8px'}}>
                                                <button className="icon-btn-small" style={{background:'rgba(59,130,246,0.1)',color:'#3b82f6',border:'none',borderRadius:'6px',padding:'6px',cursor:'pointer',fontSize:'12px'}} onClick={() => setSelectedInvoice(group)}>👁️ View Details</button>
                                                {group.transactions.length === 1 && <button className="del-btn" onClick={() => handleDelete(group.transactions[0].id)}>🗑️</button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {groupedByInvoice.length === 0 && <tr><td colSpan="9" className="empty-row">No expenditure records found</td></tr>}
                        </tbody>
                    </table>
                ) : (
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>Date</th>
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
                                    <td><div className="date">{new Date(t.date).toLocaleDateString('en-IN')}</div></td>
                                    <td>{t.invoiceNumber ? <span className="invoice-pill">🧾 {t.invoiceNumber}</span> : <span style={{opacity:0.4,fontSize:'12px'}}>—</span>}</td>
                                    <td><span className={`cat-pill ${t.category?.replace(' ', '-').toLowerCase()}`}>{t.category}</span></td>
                                    <td className="desc-cell">{t.description || 'No description'}</td>
                                    <td>{t.paymentMethod}</td>
                                    <td>
                                        <button className={`status-pill ${t.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}`} onClick={() => handleToggleStatus(t)}>
                                            {t.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}
                                        </button>
                                    </td>
                                    <td className="amt-cell expense" style={{textAlign:'right'}}>₹{t.amount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                                    <td><button className="del-btn" onClick={() => handleDelete(t.id)}>🗑️</button></td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && <tr><td colSpan="9" className="empty-row">No expenditure records found</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>

            {/* General Expense Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '950px', width: '90%' }}>
                        <h2>Record General Expense</h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        placeholder="e.g. 500"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {formData.category === 'Inventory Purchase' && (
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label>Vendor Name</label>
                                        <select value={formData.vendorName || ''} onChange={(e) => setFormData({...formData, vendorName: e.target.value})}>
                                            <option value="">-- Select Vendor --</option>
                                            {vendors.map(v => <option key={v.id || v._id} value={v.name}>{v.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Payment Method</label>
                                    <select value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}>
                                        <option>Cash</option>
                                        <option>Card</option>
                                        <option>UPI</option>
                                        <option>Bank Transfer</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select value={formData.paymentStatus} onChange={(e) => setFormData({...formData, paymentStatus: e.target.value})}>
                                        <option value="PAID">Paid</option>
                                        <option value="UNPAID">Unpaid</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Invoice Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                                        placeholder="e.g. INV-2023-001"
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
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Description / Reason</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="e.g. A/C Servicing, Floor repair..."
                                    rows="3"
                                />
                            </div>
                            <div className="modal-footer" style={{ marginTop: '20px' }}>
                                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="primary-btn">Save Expenditure</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Vendor Add/Edit Form Modal */}
            {showVendorModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,30,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
                    <div className="scale-in" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '16px', width: '950px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`, background: 'var(--bg-hover)', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: `${COLORS.accent}20`, padding: '8px', borderRadius: '10px', color: COLORS.accent, display: 'flex' }}><Package size={22} /></div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: COLORS.text }}>{editingVendor ? 'Edit Vendor Profile' : 'Register New Vendor'}</h3>
                            </div>
                            <button onClick={() => setShowVendorModal(false)} style={{ background: 'transparent', border: 'none', color: COLORS.textMuted, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleVendorSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
                                
                                {/* Section: Basic Info */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px', padding: '10px 14px', background: `${COLORS.blue}10`, borderRadius: '8px', borderLeft: `4px solid ${COLORS.blue}` }}>
                                        <span style={{ fontSize: '18px' }}>🏢</span>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: COLORS.blue, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Basic Information</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Vendor Name *</label>
                                            <input name="name" defaultValue={editingVendor?.name} required placeholder="E.g. Fresh Farms Ltd" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Vendor Code</label>
                                            <input name="vendorCode" defaultValue={editingVendor?.vendorCode} placeholder="E.g. V-001" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Status</label>
                                            <select name="status" defaultValue={editingVendor?.status || 'ACTIVE'} style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }}>
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                                <option value="BLACKLISTED">Blacklisted</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Contact & Tax */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 16px', padding: '10px 14px', background: `${COLORS.amber}10`, borderRadius: '8px', borderLeft: `4px solid ${COLORS.amber}` }}>
                                        <span style={{ fontSize: '18px' }}>📞</span>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: COLORS.amber, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Contact & Tax Details</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Phone Number</label>
                                            <input name="phone" defaultValue={editingVendor?.phone} placeholder="+91 9876543210" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Email Address</label>
                                            <input name="email" type="email" defaultValue={editingVendor?.email} placeholder="contact@vendor.com" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>GSTIN</label>
                                            <input name="gstin" defaultValue={editingVendor?.gstin} placeholder="22AAAAA0000A1Z5" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none', textTransform: 'uppercase' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>PAN Number</label>
                                            <input name="pan" defaultValue={editingVendor?.pan} placeholder="ABCDE1234F" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none', textTransform: 'uppercase' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Location */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 16px', padding: '10px 14px', background: `${COLORS.green}10`, borderRadius: '8px', borderLeft: `4px solid ${COLORS.green}` }}>
                                        <span style={{ fontSize: '18px' }}>📍</span>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: COLORS.green, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Location & Address</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Full Address</label>
                                            <textarea name="address" defaultValue={editingVendor?.address} placeholder="Street, Area, Landmark..." rows={2} style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none', resize: 'vertical' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>State</label>
                                                <input name="state" defaultValue={editingVendor?.state} placeholder="E.g. Tamil Nadu" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>State Code (GST)</label>
                                                <input name="stateCode" defaultValue={editingVendor?.stateCode} placeholder="E.g. 33" style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Financial & Notes */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 16px', padding: '10px 14px', background: `#8b5cf610`, borderRadius: '8px', borderLeft: `4px solid #8b5cf6` }}>
                                        <span style={{ fontSize: '18px' }}>💳</span>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#8b5cf6', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Financials & Remarks</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Credit Limit (₹)</label>
                                            <input name="creditLimit" type="number" step="0.01" defaultValue={editingVendor?.creditLimit || 0} style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: COLORS.textMuted, marginBottom: '6px', fontWeight: '600' }}>Internal Notes</label>
                                            <input name="notes" defaultValue={editingVendor?.notes} placeholder="Payment terms, delivery preferences..." style={{ width: '100%', background: 'rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: '10px 12px', borderRadius: '8px', outline: 'none' }} />
                                        </div>
                                    </div>
                                </div>

                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: `1px solid ${COLORS.border}`, background: 'var(--bg-hover)' }}>
                                <button type="button" onClick={() => setShowVendorModal(false)} style={{ background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center' }}>Cancel</button>
                                <button type="submit" style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`, color: '#000', border: 'none', padding: '10px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', boxShadow: `0 4px 12px ${COLORS.accent}40`, display: 'flex', alignItems: 'center' }}>Save Vendor Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AI Scanner / InvoiceOCR Modal */}
            {showScanner && (
                <InvoiceOcrModal
                    onClose={() => setShowScanner(false)}
                    onComplete={() => {
                        setShowScanner(false);
                        fetchPurchases();
                        fetchVendors();
                    }}
                    toast={toast}
                />
            )}

            {/* General Transactions Group View Modal */}
            {selectedInvoice && (
                <div className="exp-modal-overlay">
                    <div className="exp-modal" style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header">
                            <h2>Invoice Details: {selectedInvoice.invoiceNumber || 'N/A'}</h2>
                            <button className="close-btn" onClick={() => setSelectedInvoice(null)}>✕</button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: 'var(--bg-hover)', padding: '15px', borderRadius: '8px' }}>
                                <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Supplier</div><div style={{ fontWeight: 'bold' }}>{selectedInvoice.transactions[0]?.description?.split(' - ')[0] || 'Unknown'}</div></div>
                                <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Amount</div><div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '18px' }}>₹{selectedInvoice.totalAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}</div></div>
                                <div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status</div><div style={{ fontWeight: 'bold' }}>{selectedInvoice.paymentStatus === 'PAID' ? '✅ Paid' : '⏳ Unpaid'}</div></div>
                            </div>
                            <table className="exp-table" style={{ marginTop: '0' }}>
                                <thead><tr><th>Item Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
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
