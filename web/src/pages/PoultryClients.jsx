import React, { useState, useEffect } from 'react';
import './PoultryClients.css';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function PoultryClients() {
    const { user } = useAuth();
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager';

    const [clients, setClients] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        name: '', phone: '', address: '', discount: 0, discountType: 'percentage', pendingAmount: 0, categoryDiscounts: []
    });
    const [menuCategories, setMenuCategories] = useState([]);

    useEffect(() => {
        fetchClients();
        api.get('/menu').then(res => {
            let items = res.data.data?.menuItems || res.data.data?.items || [];
            const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
            setMenuCategories(cats);
        }).catch(() => { });
    }, []);

    const PENDING_KEY = 'poultry_clients_pending';

    const syncPendingClients = async () => {
        try {
            const raw = localStorage.getItem(PENDING_KEY);
            if (!raw) return;
            const pending = JSON.parse(raw);
            if (!pending.length) return;
            const synced = [];
            for (const c of pending) {
                try {
                    const meta = {
                        isPoultry: true, address: c.address || '',
                        defaultDiscount: parseFloat(c.defaultDiscount) || 0,
                        defaultDiscountType: c.defaultDiscountType || 'percentage',
                        pendingAmount: parseFloat(c.pendingAmount) || 0,
                        categoryDiscounts: c.categoryDiscounts || []
                    };
                    await api.post('/customers', {
                        name: c.name, phone: c.phone || '',
                        email: '||META:' + JSON.stringify(meta)
                    });
                    synced.push(String(c.id));
                } catch { /* still offline */ }
            }
            if (synced.length > 0) {
                const remaining = pending.filter(c => !synced.includes(String(c.id)));
                localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
            }
        } catch (err) { console.warn('Pending sync failed:', err); }
    };

    const fetchClients = async () => {
        setLoading(true);
        await syncPendingClients();
        try {
            const res = await api.get('/customers');
            let data = res.data.data || res.data || [];

            // Filter and unpack poultry metadata
            const parsed = [];
            for (const c of data) {
                if (c.email && c.email.startsWith('||META:')) {
                    try {
                        const meta = JSON.parse(c.email.replace('||META:', ''));
                        if (meta.isPoultry) {
                            parsed.push({
                                ...c,
                                address: meta.address,
                                defaultDiscount: meta.defaultDiscount,
                                defaultDiscountType: meta.defaultDiscountType || 'percentage',
                                pendingAmount: meta.pendingAmount,
                                totalPurchase: meta.totalPurchase || 0,
                                categoryDiscounts: meta.categoryDiscounts || []
                            });
                        }
                    } catch (e) { /* skip */ }
                }
            }

            setClients(parsed);
            localStorage.setItem('poultry_clients', JSON.stringify(parsed));
        } catch {
            const local = localStorage.getItem('poultry_clients');
            setClients(local ? JSON.parse(local) : []);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingClient) return;
        if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
        setSaving(true);
        const id = editingClient._id || editingClient.id;
        try {
            // Standard delete if it exists on server (Real Java IDs are Longs, whereas offline fallback temp IDs are 13-digit Date.now)
            if (String(id).length < 13) {
                await api.delete(`/customers/${id}`);
            }
            // Update local state instantly and commit to offline cache
            const updated = clients.filter(c => (c._id || c.id) !== id);
            setClients(updated);
            localStorage.setItem('poultry_clients', JSON.stringify(updated));

            // Also clear it if it was queued for a pending sync
            const rawPending = localStorage.getItem(PENDING_KEY);
            if (rawPending) {
                const pending = JSON.parse(rawPending).filter(c => c.id !== id);
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            }
            setShowModal(false);
        } catch (e) {
            alert('Failed to delete customer from server. It might be linked to existing orders.');
        } finally {
            setSaving(false);
        }
    };

    const openAdd = () => {
        setEditingClient(null);
        setFormData({ name: '', phone: '', address: '', discount: 0, discountType: 'percentage', pendingAmount: 0, categoryDiscounts: [] });
        setShowModal(true);
    };

    const openEdit = (client) => {
        setEditingClient(client);
        setFormData({
            name: client.name || '',
            phone: client.phone || '',
            address: client.address || '',
            discount: client.defaultDiscount ?? 0,
            discountType: client.defaultDiscountType || 'percentage',
            pendingAmount: client.pendingAmount ?? 0,
            categoryDiscounts: client.categoryDiscounts || []
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        const meta = {
            isPoultry: true,
            address: formData.address,
            defaultDiscount: parseFloat(formData.discount) || 0,
            defaultDiscountType: formData.discountType,
            pendingAmount: parseFloat(formData.pendingAmount) || 0,
            categoryDiscounts: formData.categoryDiscounts
        };
        const payload = {
            name: formData.name,
            phone: formData.phone,
            email: '||META:' + JSON.stringify(meta)
        };
        try {
            if (editingClient) {
                await api.post(`/customers`, payload);
            } else {
                await api.post('/customers', payload);
            }
            await fetchClients();
        } catch {
            // Offline fallback
            const tempId = Date.now();
            const offlinePayload = { name: payload.name, phone: payload.phone, ...meta };
            const updated = editingClient
                ? clients.map(c => (c.id === editingClient.id ? { ...c, ...offlinePayload } : c))
                : [...clients, { id: tempId, ...offlinePayload, totalPurchase: 0, lastPurchase: new Date().toISOString().split('T')[0] }];
            setClients(updated);
            localStorage.setItem('poultry_clients', JSON.stringify(updated));
            // Queue new client for later sync
            if (!editingClient) {
                const rawPending = localStorage.getItem(PENDING_KEY);
                const pending = rawPending ? JSON.parse(rawPending) : [];
                pending.push({ id: tempId, ...offlinePayload, totalPurchase: 0 });
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
            }
        } finally {
            setSaving(false);
            setShowModal(false);
        }
    };


    const filtered = clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    );

    return (
        <div className="pcl-page">
            {/* Topbar */}
            <div className="pcl-topbar">
                <div className="pcl-topbar-left">
                    <h1>Client Management</h1>
                    <div className="pcl-count">{clients.length} client{clients.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="pcl-topbar-right">
                    <input
                        className="pcl-search"
                        placeholder="🔍 Search clients..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {isManagerOrOwner && (
                        <button className="pcl-add-btn" onClick={openAdd}>+ Add Client</button>
                    )}
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="pcl-body">
                <div className="pcl-table-wrapper">
                    {loading ? (
                        <div className="pcl-loading">Loading clients…</div>
                    ) : (
                        <table className="pcl-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Default Discount</th>
                                    <th>Total Purchase</th>
                                    <th>Pending</th>
                                    <th>Last Purchase</th>
                                    {isManagerOrOwner && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(client => (
                                    <tr key={client._id || client.id}>
                                        <td className="pcl-name-cell">
                                            <div className="pcl-avatar">{client.name?.[0]?.toUpperCase()}</div>
                                            {client.name}
                                        </td>
                                        <td>{client.phone || '—'}</td>
                                        <td>
                                            {client.defaultDiscount > 0
                                                ? <span className="pcl-badge pcl-badge-green">{client.defaultDiscountType === 'amount' ? `₹${client.defaultDiscount}` : `${client.defaultDiscount}%`}</span>
                                                : <span className="pcl-badge pcl-badge-grey">0%</span>
                                            }
                                        </td>
                                        <td>₹{(client.totalPurchase || 0).toLocaleString('en-IN')}</td>
                                        <td>
                                            <span className={client.pendingAmount > 0 ? 'pcl-pending-red' : 'pcl-pending-green'}>
                                                ₹{(client.pendingAmount || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td>{client.lastPurchase || '—'}</td>
                                        {isManagerOrOwner && (
                                            <td>
                                                <button className="pcl-edit-btn" onClick={() => openEdit(client)}>Edit</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="pcl-empty">
                                            {search ? 'No clients match your search.' : 'No clients yet. Add your first client!'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="pcl-overlay" onClick={() => setShowModal(false)}>
                    <div className="pcl-modal" onClick={e => e.stopPropagation()}>
                        <div className="pcl-modal-header">
                            <div>
                                <h2 className="pcl-modal-title">
                                    {editingClient ? '✏️ Edit Client' : '➕ Add New Client'}
                                </h2>
                                <p className="pcl-modal-sub">
                                    {editingClient ? 'Update client information and discount settings.' : 'Enter the wholesale client details below.'}
                                </p>
                            </div>
                            <button className="pcl-modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form className="pcl-modal-form" onSubmit={handleSave}>
                            {/* Row 1: Name + Phone */}
                            <div className="pcl-form-grid-2">
                                <div className="pcl-form-group">
                                    <label>Client / Business Name <span className="pcl-required">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Raju Hotel, Star Biryani…"
                                    />
                                </div>
                                <div className="pcl-form-group">
                                    <label>Contact Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 9876543210"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Address */}
                            <div className="pcl-form-group">
                                <label>Address <span className="pcl-optional">(optional)</span></label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street, area, city…"
                                />
                            </div>

                            {/* Row 3: Discount + Pending */}
                            <div className="pcl-form-grid-2">
                                <div className="pcl-form-group">
                                    <label>Default Discount</label>
                                    <div className="pcl-input-suffix" style={{ display: 'flex', gap: '4px' }}>
                                        <input
                                            type="number"
                                            min="0" step="0.5"
                                            value={formData.discount}
                                            onChange={e => setFormData({ ...formData, discount: e.target.value })}
                                            style={{ flex: 1 }}
                                        />
                                        <select
                                            value={formData.discountType}
                                            onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                            style={{ padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="percentage">%</option>
                                            <option value="amount">₹</option>
                                        </select>
                                    </div>
                                    <p className="pcl-field-hint">Auto-applied when this client is selected in POS. Can be overridden by managers.</p>
                                </div>
                                <div className="pcl-form-group">
                                    <label>Opening Pending Amount (₹)</label>
                                    <div className="pcl-input-suffix">
                                        <span className="pcl-prefix">₹</span>
                                        <input
                                            type="number"
                                            min="0" step="0.01"
                                            value={formData.pendingAmount}
                                            onChange={e => setFormData({ ...formData, pendingAmount: e.target.value })}
                                        />
                                    </div>
                                    <p className="pcl-field-hint">Any outstanding balance carried over from before using the system.</p>
                                </div>
                            </div>

                            {/* Row 4: Category-Wise Discounts */}
                            <div className="pcl-form-group" style={{ marginTop: '16px' }}>
                                <label>Category-Wise Discounts</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                                    {formData.categoryDiscounts?.map((cd, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <select
                                                value={cd.category}
                                                onChange={e => {
                                                    const newArr = [...formData.categoryDiscounts];
                                                    newArr[index].category = e.target.value;
                                                    setFormData({ ...formData, categoryDiscounts: newArr });
                                                }}
                                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                {menuCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                            <div className="pcl-input-suffix" style={{ display: 'flex', gap: '4px', width: '130px', alignItems: 'center' }}>
                                                <input
                                                    type="number" min="0" step="0.5" required
                                                    value={cd.discount}
                                                    onChange={e => {
                                                        const newArr = [...formData.categoryDiscounts];
                                                        newArr[index].discount = e.target.value;
                                                        setFormData({ ...formData, categoryDiscounts: newArr });
                                                    }}
                                                    style={{ flex: 1, padding: '8px', minWidth: '40px' }}
                                                />
                                                <select
                                                    value={cd.type}
                                                    onChange={e => {
                                                        const newArr = [...formData.categoryDiscounts];
                                                        newArr[index].type = e.target.value;
                                                        setFormData({ ...formData, categoryDiscounts: newArr });
                                                    }}
                                                    style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                                                >
                                                    <option value="percentage">%</option>
                                                    <option value="amount">₹</option>
                                                </select>
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newArr = formData.categoryDiscounts.filter((_, i) => i !== index);
                                                setFormData({ ...formData, categoryDiscounts: newArr });
                                            }} style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '4px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => {
                                        const curArr = formData.categoryDiscounts || [];
                                        setFormData({ ...formData, categoryDiscounts: [...curArr, { category: '', discount: 0, type: 'percentage' }] });
                                    }} style={{ alignSelf: 'flex-start', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px dashed var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                        + Add Category Discount
                                    </button>
                                </div>
                            </div>

                            {/* Summary preview */}
                            {(formData.discount > 0) && (
                                <div className="pcl-preview-box">
                                    <span>📊 This client will receive <strong>{formData.discountType === 'amount' ? `₹${formData.discount}` : `${formData.discount}%`}</strong> discount automatically on every sale.</span>
                                </div>
                            )}

                            <div className="pcl-modal-actions" style={{ justifyContent: editingClient ? 'space-between' : 'flex-end' }}>
                                {editingClient && (
                                    <button type="button" className="pcl-save-btn" onClick={handleDelete} disabled={saving} style={{ backgroundColor: '#ef4444', border: '1px solid #ef4444' }}>
                                        🗑️ Delete
                                    </button>
                                )}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" className="pcl-cancel-btn" onClick={() => setShowModal(false)} disabled={saving}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="pcl-save-btn" disabled={saving}>
                                        {saving ? '⏳ Saving…' : (editingClient ? '✓ Save Changes' : '+ Save Client')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
