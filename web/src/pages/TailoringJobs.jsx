import React, { useState, useEffect, useCallback } from 'react'
import {
    getTailoringJobs, createTailoringJob, updateTailoringStatus,
    deliverTailoringJob, getTailoringStats
} from '../api/clothing.js'
import { useAuth } from '../context/AuthContext.jsx'
import './TailoringJobs.css'

const STATUS_LIST = ['received', 'in_progress', 'ready', 'delivered', 'cancelled']
const STATUS_LABEL = {
    received:    { label: 'Received',    color: '#3b82f6', bg: '#1e3a5f33' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#78350f22' },
    ready:       { label: 'Ready',       color: '#22c55e', bg: '#14532d22' },
    delivered:   { label: 'Delivered',   color: '#6b7280', bg: '#37415133' },
    cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: '#7f1d1d22' },
}

const WORK_TYPES = ['Stitching', 'Alteration', 'Embroidery', 'Printing', 'Dry Cleaning', 'Ironing', 'Other']

export default function TailoringJobs() {
    const [jobs, setJobs] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [activeStatus, setActiveStatus] = useState('in_progress')
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState(null)
    const { user } = useAuth()
    const isPrintingRef = React.useRef(false)

    // Modals
    const [showAdd, setShowAdd] = useState(false)
    const [showDetail, setShowDetail] = useState(null)
    const [showDeliver, setShowDeliver] = useState(null)

    // Forms
    const [addForm, setAddForm] = useState({
        customerName: '', customerPhone: '',
        description: '', advancePaid: 0, totalAmount: 0,
        dueDate: '', notes: '', items: [{ dressType: '', pieces: 1, measurements: '', workType: 'Stitching' }]
    })
    const [deliverForm, setDeliverForm] = useState({ amountCollected: 0 })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const printTailoringBill = (job) => {
        if (isPrintingRef.current) return;
        isPrintingRef.current = true;

        const printIframe = document.getElementById('tj-print-iframe');
        if (!printIframe) {
            console.error('Print iframe not found');
            isPrintingRef.current = false;
            return;
        }

        const printWindow = printIframe.contentWindow;
        const balance = (job.totalAmount || 0) - (job.advancePaid || 0);

        const billHTML = `
            <html>
            <head>
                <style>
                    @page { margin: 0; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 80mm;
                        margin: 0;
                        padding: 10px;
                        font-size: 12px;
                        color: #000;
                        background: #fff;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .title { font-size: 16px; margin-bottom: 5px; }
                    .subtitle { font-size: 14px; margin-bottom: 10px; }
                    .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .label { font-weight: bold; }
                    .measurements { white-space: pre-wrap; margin-top: 5px; margin-bottom: 5px; font-size: 11px; }
                </style>
            </head>
            <body>
                <div class="center bold title">${user?.restaurantName || 'TAILORING SHOP'}</div>
                <div class="center">${user?.address || ''}</div>
                ${user?.phone ? `<div class="center">Ph: ${user.phone}</div>` : ''}
                <div class="line"></div>
                <div class="center bold subtitle">TAILORING RECEIPT</div>
                
                <div class="row">
                    <span>Date: ${new Date(job.createdAt || Date.now()).toLocaleDateString('en-IN')}</span>
                    <span>Time: ${new Date(job.createdAt || Date.now()).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="row">
                    <span class="bold">Token No:</span>
                    <span class="bold" style="font-size: 14px;">${job.tokenNumber || 'NEW'}</span>
                </div>
                <div class="line"></div>
                
                <div class="row">
                    <span class="label">Customer:</span>
                    <span>${job.customerName}</span>
                </div>
                <div class="row">
                    <span class="label">Phone:</span>
                    <span>${job.customerPhone}</span>
                </div>
                
                ${(() => {
                    let itemsHtml = '';
                    try {
                        const parsedItems = job.items ? JSON.parse(job.items) : [];
                        if (parsedItems.length > 0) {
                            itemsHtml = parsedItems.map((it, idx) => `
                                <div class="line"></div>
                                <div class="bold">Item ${idx + 1}: ${it.dressType || 'Cloth'} (${it.workType || 'Stitching'}) - ${it.pieces} pcs</div>
                                ${it.measurements ? `<div class="measurements">${it.measurements}</div>` : ''}
                            `).join('');
                        } else {
                            // Legacy fallback
                            itemsHtml = `
                                <div class="line"></div>
                                <div class="row">
                                    <span class="label">Work Type:</span>
                                    <span>${job.workType || ''}</span>
                                </div>
                                <div class="row">
                                    <span class="label">Pieces:</span>
                                    <span>${job.pieces || 1}</span>
                                </div>
                                ${job.measurements ? `
                                <div class="line"></div>
                                <div class="bold">Measurements:</div>
                                <div class="measurements">${job.measurements}</div>
                                ` : ''}
                            `;
                        }
                    } catch (e) {
                        itemsHtml = '';
                    }
                    return itemsHtml;
                })()}
                
                ${job.description ? `
                <div class="line"></div>
                <div class="bold">Description:</div>
                <div style="font-size: 11px; margin-bottom: 5px;">${job.description}</div>
                ` : ''}
                
                <div class="line"></div>
                <div class="row">
                    <span class="label">Collection Date:</span>
                    <span class="bold">${job.dueDate ? new Date(job.dueDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                </div>
                
                <div class="line"></div>
                <div class="row">
                    <span>Total Amount:</span>
                    <span>Rs. ${job.totalAmount || 0}</span>
                </div>
                <div class="row">
                    <span>Advance Paid:</span>
                    <span>Rs. ${job.advancePaid || 0}</span>
                </div>
                <div class="line"></div>
                <div class="row bold" style="font-size: 14px;">
                    <span>Balance Due:</span>
                    <span>Rs. ${Math.max(0, balance)}</span>
                </div>
                
                <div class="line"></div>
                <div class="center" style="margin-top: 10px;">Thank you for your business!</div>
                <div class="center" style="font-size: 10px; margin-top: 5px;">Please bring this receipt for collection.</div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(billHTML);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
            isPrintingRef.current = false;
        }, 500);
    }

    const loadAll = useCallback(async () => {
        try {
            const [jRes, sRes] = await Promise.all([
                getTailoringJobs(activeStatus || undefined),
                getTailoringStats()
            ])
            setJobs(jRes.data?.data?.map(j => ({ ...j, status: j.status?.toLowerCase() })) || [])
            setStats(sRes.data?.data || {})
        } catch (e) {
            showToast('Failed to load jobs', 'error')
        } finally {
            setLoading(false)
        }
    }, [activeStatus])

    useEffect(() => { loadAll() }, [loadAll])

    // ── Create Job ────────────────────────────────────────────────────────────
    const handleAddJob = async (e) => {
        e.preventDefault()
        try {
            await createTailoringJob(addForm)
            setShowAdd(false)
            setAddForm({ customerName: '', customerPhone: '', description: '', advancePaid: 0, totalAmount: 0, dueDate: '', notes: '', items: [{ dressType: '', pieces: 1, measurements: '', workType: 'Stitching' }] })
            loadAll()
            showToast('Job created successfully!')
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create job', 'error')
        }
    }

    // ── Status Change ─────────────────────────────────────────────────────────
    const handleStatusChange = async (jobId, newStatus) => {
        if (newStatus === 'delivered') {
            const job = jobs.find(j => j._id === jobId)
            setShowDeliver(job)
            return
        }
        try {
            await updateTailoringStatus(jobId, newStatus)
            loadAll()
            showToast(`Status updated to ${STATUS_LABEL[newStatus]?.label}`)
        } catch (err) {
            showToast('Status update failed', 'error')
        }
    }

    // ── Deliver Job ───────────────────────────────────────────────────────────
    const handleDeliver = async (e) => {
        e.preventDefault()
        try {
            await deliverTailoringJob(showDeliver._id, deliverForm)
            setShowDeliver(null)
            loadAll()
            showToast('Job marked as delivered!')
        } catch (err) {
            showToast('Delivery update failed', 'error')
        }
    }

    const filteredJobs = jobs.filter(j =>
        j.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        j.customerPhone?.includes(search) ||
        j.tokenNumber?.toLowerCase().includes(search.toLowerCase())
    )

    const pendingAmount = (j) => (j.totalAmount || 0) - (j.advancePaid || 0)

    if (loading) return (
        <div className="tj-loading">
            <div className="tj-spinner" />
            <span>Loading Tailoring Jobs...</span>
        </div>
    )

    return (
        <div className="tj-root">
            {/* TOAST */}
            {toast && <div className={`tj-toast tj-toast--${toast.type}`}>{toast.msg}</div>}

            {/* HEADER */}
            <div className="tj-header">
                <div className="tj-header-left">
                    <h1 className="tj-title">🧵 Tailoring Jobs</h1>
                    <p className="tj-subtitle">Track customer orders, stitching work and deliveries</p>
                </div>
                <div className="tj-stats-bar">
                    <div className="tj-stat">
                        <span className="tj-stat-val">{stats.total || 0}</span>
                        <span className="tj-stat-label">Total</span>
                    </div>
                    <div className="tj-stat tj-stat--blue">
                        <span className="tj-stat-val">{stats.received || 0}</span>
                        <span className="tj-stat-label">Received</span>
                    </div>
                    <div className="tj-stat tj-stat--warn">
                        <span className="tj-stat-val">{stats.in_progress || 0}</span>
                        <span className="tj-stat-label">In Progress</span>
                    </div>
                    <div className="tj-stat tj-stat--green">
                        <span className="tj-stat-val">{stats.ready || 0}</span>
                        <span className="tj-stat-label">Ready</span>
                    </div>
                </div>
                <button className="tj-btn tj-btn--primary" onClick={() => setShowAdd(true)}>+ New Job</button>
            </div>

            {/* FILTERS */}
            <div className="tj-filters">
                <input
                    className="tj-search"
                    type="text"
                    placeholder="🔍 Search by name, phone or token..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="tj-status-tabs">
                    {['in_progress', '', 'received', 'ready', 'delivered', 'cancelled'].map(s => (
                        <button
                            key={s}
                            className={`tj-tab ${activeStatus === s ? 'tj-tab--active' : ''}`}
                            style={activeStatus === s && s !== '' ? { borderColor: STATUS_LABEL[s].color, color: STATUS_LABEL[s].color } : {}}
                            onClick={() => setActiveStatus(s)}
                        >
                            {s === '' ? 'All' : STATUS_LABEL[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* JOBS TABLE/LIST */}
            <div className="tj-body">
                {filteredJobs.length === 0 ? (
                    <div className="tj-empty">
                        <span className="tj-empty-icon">🧵</span>
                        <p>{activeStatus ? `No ${STATUS_LABEL[activeStatus]?.label} jobs` : 'No tailoring jobs yet'}</p>
                        <button className="tj-btn tj-btn--primary" onClick={() => setShowAdd(true)}>Create First Job</button>
                    </div>
                ) : (
                    <div className="tj-list">
                        {filteredJobs.map(j => {
                            const st = STATUS_LABEL[j.status] || STATUS_LABEL.received
                            const balance = pendingAmount(j)
                            const isOverdue = j.dueDate && new Date(j.dueDate) < new Date() && j.status !== 'delivered'
                            return (
                                <div key={j._id} className={`tj-card ${isOverdue ? 'tj-card--overdue' : ''}`}>
                                    <div className="tj-card-left">
                                        <div className="tj-token">{j.tokenNumber || '#—'}</div>
                                        <div
                                            className="tj-status-badge"
                                            style={{ color: st.color, background: st.bg }}
                                        >
                                            {st.label}
                                        </div>
                                    </div>
                                    <div className="tj-card-center">
                                        <div className="tj-customer-name">{j.customerName}</div>
                                        <div className="tj-customer-phone">{j.customerPhone}</div>
                                        <div className="tj-work-meta">
                                            <span className="tj-work-type">{j.workType}</span>
                                            {j.pieces > 1 && <span className="tj-pieces">{j.pieces} pcs</span>}
                                            {j.description && <span className="tj-desc">{j.description}</span>}
                                        </div>
                                    </div>
                                    <div className="tj-card-right">
                                        {j.dueDate && (
                                            <div className={`tj-due ${isOverdue ? 'tj-due--overdue' : ''}`}>
                                                📅 {new Date(j.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                {isOverdue && ' ⚠️'}
                                            </div>
                                        )}
                                        <div className="tj-amounts">
                                            <span className="tj-amount-total">₹{j.totalAmount?.toLocaleString('en-IN') || 0}</span>
                                            {balance > 0 && (
                                                <span className="tj-amount-balance">₹{balance.toLocaleString('en-IN')} due</span>
                                            )}
                                        </div>
                                        <div className="tj-card-actions">
                                            {j.status !== 'delivered' && j.status !== 'cancelled' && (
                                                <select
                                                    className="tj-status-select"
                                                    value={j.status}
                                                    onChange={e => handleStatusChange(j._id, e.target.value)}
                                                >
                                                    {STATUS_LIST.filter(s => s !== 'cancelled' || j.status === 'cancelled').map(s => (
                                                        <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <button
                                                className="tj-detail-btn"
                                                onClick={() => setShowDetail(j)}
                                                title="View details"
                                            >
                                                👁
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ADD JOB MODAL */}
            {showAdd && (
                <div className="tj-modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="tj-modal tj-modal--wide" onClick={e => e.stopPropagation()}>

                        {/* ── STICKY HEADER ── */}
                        <div className="tj-modal-header">
                            <div>
                                <h2 className="tj-modal-title">🧵 New Tailoring Job</h2>
                                <p className="tj-modal-sub">Fill in customer details and job specifications</p>
                            </div>
                            <button className="tj-close-btn" type="button" onClick={() => setShowAdd(false)}>✕</button>
                        </div>

                        <form onSubmit={handleAddJob} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

                            {/* ── 2-PANEL BODY ── */}
                            <div className="tj-form-panels">

                                {/* ═══════════════════════ LEFT PANEL ═══════════════════════ */}
                                <div className="tj-panel tj-panel--left">

                                    <div className="tj-panel-title">👤 Customer Details</div>

                                    <div className="tj-form-row">
                                        <label className="tj-label">Customer Name *</label>
                                        <input
                                            className="tj-input"
                                            required
                                            value={addForm.customerName}
                                            onChange={e => setAddForm(f => ({ ...f, customerName: e.target.value }))}
                                            placeholder="Full name"
                                        />
                                    </div>

                                    <div className="tj-form-row">
                                        <label className="tj-label">Phone Number *</label>
                                        <input
                                            className="tj-input"
                                            required
                                            value={addForm.customerPhone}
                                            onChange={e => setAddForm(f => ({ ...f, customerPhone: e.target.value }))}
                                            placeholder="+91 XXXXXXXXXX"
                                        />
                                    </div>

                                    <div className="tj-panel-title" style={{ marginTop: '0.5rem' }}>🧵 Job Details</div>

                                    <div className="tj-form-row">
                                        <label className="tj-label">Due Date</label>
                                        <input
                                            type="date"
                                            className="tj-input"
                                            value={addForm.dueDate}
                                            onChange={e => setAddForm(f => ({ ...f, dueDate: e.target.value }))}
                                        />
                                    </div>

                                    <div className="tj-form-row">
                                        <label className="tj-label">Staff Notes (Internal)</label>
                                        <input
                                            className="tj-input"
                                            value={addForm.notes}
                                            onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="Internal notes for staff..."
                                        />
                                    </div>
                                    
                                    <div className="tj-form-row">
                                        <label className="tj-label">Description / Special Instructions</label>
                                        <textarea
                                            className="tj-input tj-textarea"
                                            rows={3}
                                            value={addForm.description}
                                            onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Fabric type, color, design references, special instructions..."
                                        />
                                    </div>
                                </div>

                                {/* ═══════════════════════ RIGHT PANEL ═══════════════════════ */}
                                <div className="tj-panel tj-panel--right" style={{ display: 'flex', flexDirection: 'column' }}>

                                    <div className="tj-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>📐 Cloth Items & Measurements</span>
                                        <button 
                                            type="button" 
                                            className="tj-btn tj-btn--ghost" 
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                            onClick={() => setAddForm(f => ({ ...f, items: [...f.items, { dressType: '', pieces: 1, measurements: '', workType: 'Stitching' }] }))}
                                        >
                                            + Add Item
                                        </button>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '10px' }}>
                                        {addForm.items.map((item, index) => (
                                            <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '10px', background: '#f9fafb' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <strong>Item {index + 1}</strong>
                                                    {addForm.items.length > 1 && (
                                                        <button 
                                                            type="button" 
                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            onClick={() => setAddForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}
                                                        >
                                                            ✕ Remove
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="tj-form-grid-2" style={{ marginBottom: '8px' }}>
                                                    <div className="tj-form-row">
                                                        <label className="tj-label">Dress Type (e.g. Shirt, Pant)</label>
                                                        <input 
                                                            className="tj-input" 
                                                            required 
                                                            placeholder="Shirt, Pant..."
                                                            value={item.dressType}
                                                            onChange={e => {
                                                                const newItems = [...addForm.items];
                                                                newItems[index].dressType = e.target.value;
                                                                setAddForm({ ...addForm, items: newItems });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="tj-form-row">
                                                        <label className="tj-label">Work Type</label>
                                                        <select 
                                                            className="tj-input" 
                                                            value={item.workType}
                                                            onChange={e => {
                                                                const newItems = [...addForm.items];
                                                                newItems[index].workType = e.target.value;
                                                                setAddForm({ ...addForm, items: newItems });
                                                            }}
                                                        >
                                                            {WORK_TYPES.map(w => <option key={w}>{w}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="tj-form-grid-2" style={{ marginBottom: '8px' }}>
                                                    <div className="tj-form-row" style={{ gridColumn: 'span 2' }}>
                                                        <label className="tj-label">Pieces</label>
                                                        <input 
                                                            type="number" 
                                                            className="tj-input" 
                                                            min={1} 
                                                            value={item.pieces}
                                                            onChange={e => {
                                                                const newItems = [...addForm.items];
                                                                newItems[index].pieces = parseInt(e.target.value) || 1;
                                                                setAddForm({ ...addForm, items: newItems });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="tj-form-row" style={{ marginBottom: 0 }}>
                                                    <label className="tj-label">Measurements</label>
                                                    <textarea 
                                                        className="tj-input tj-textarea" 
                                                        rows={3} 
                                                        placeholder={`e.g.\nChest: 40"\nWaist: 34"\nLength: 42"`}
                                                        value={item.measurements}
                                                        onChange={e => {
                                                            const newItems = [...addForm.items];
                                                            newItems[index].measurements = e.target.value;
                                                            setAddForm({ ...addForm, items: newItems });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="tj-form-row">
                                        <label className="tj-label">Description / Special Instructions</label>
                                        <textarea
                                            className="tj-input tj-textarea"
                                            rows={3}
                                            value={addForm.description}
                                            onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Fabric type, color, design references, special instructions..."
                                        />
                                    </div>

                                    <div className="tj-panel-title" style={{ marginTop: '0.5rem' }}>💰 Payment</div>

                                    <div className="tj-form-grid-2" style={{ marginBottom: '0.5rem' }}>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Total Amount (₹)</label>
                                            <input
                                                type="number"
                                                className="tj-input"
                                                min={0}
                                                value={addForm.totalAmount}
                                                onChange={e => setAddForm(f => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Advance Paid (₹)</label>
                                            <input
                                                type="number"
                                                className="tj-input"
                                                min={0}
                                                value={addForm.advancePaid}
                                                onChange={e => setAddForm(f => ({ ...f, advancePaid: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Balance Summary Card */}
                                    <div className="tj-balance-card">
                                        <div className="tj-balance-card-row">
                                            <span>Total Amount</span>
                                            <strong>₹{(addForm.totalAmount || 0).toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div className="tj-balance-card-row">
                                            <span>Advance Paid</span>
                                            <strong>₹{(addForm.advancePaid || 0).toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div className="tj-balance-card-row total">
                                            <span>Balance Due</span>
                                            <strong>₹{Math.max(0, (addForm.totalAmount || 0) - (addForm.advancePaid || 0)).toLocaleString('en-IN')}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── STICKY FOOTER ── */}
                            <div className="tj-modal-footer">
                                <button type="button" className="tj-btn tj-btn--ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="tj-btn tj-btn--primary">✅ Create Job</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}



            {/* JOB DETAIL MODAL */}

            {showDetail && (
                <div className="tj-modal-overlay" onClick={() => setShowDetail(null)}>
                    <div className="tj-modal tj-modal--wide" onClick={e => e.stopPropagation()}>
                        <div className="tj-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <h2 className="tj-modal-title" style={{ margin: 0 }}>Job {showDetail.tokenNumber}</h2>
                                <div
                                    className="tj-status-badge"
                                    style={{ color: STATUS_LABEL[showDetail.status]?.color, background: STATUS_LABEL[showDetail.status]?.bg }}
                                >
                                    {STATUS_LABEL[showDetail.status]?.label}
                                </div>
                            </div>
                            <button className="tj-close-btn" onClick={() => setShowDetail(null)}>✕</button>
                        </div>

                        {/* ── 2-PANEL BODY ── */}
                        <div className="tj-form-panels">

                            {/* ═══════════════════════ LEFT PANEL ═══════════════════════ */}
                            <div className="tj-panel tj-panel--left">
                                <div className="tj-panel-title">📋 Job Details</div>
                                <div className="tj-detail-grid">
                                    <div className="tj-detail-item">
                                        <span className="tj-detail-label">Customer</span>
                                        <span className="tj-detail-val">{showDetail.customerName}</span>
                                    </div>
                                    <div className="tj-detail-item">
                                        <span className="tj-detail-label">Phone</span>
                                        <span className="tj-detail-val">{showDetail.customerPhone}</span>
                                    </div>
                                    <div className="tj-detail-item">
                                        <span className="tj-detail-label">Work Type</span>
                                        <span className="tj-detail-val">{showDetail.workType}</span>
                                    </div>
                                    <div className="tj-detail-item">
                                        <span className="tj-detail-label">Pieces</span>
                                        <span className="tj-detail-val">{showDetail.pieces}</span>
                                    </div>
                                    {showDetail.dueDate && (
                                        <div className="tj-detail-item">
                                            <span className="tj-detail-label">Due Date</span>
                                            <span className="tj-detail-val">
                                                {new Date(showDetail.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="tj-detail-item">
                                        <span className="tj-detail-label">Created On</span>
                                        <span className="tj-detail-val">
                                            {new Date(showDetail.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ═══════════════════════ RIGHT PANEL ═══════════════════════ */}
                            <div className="tj-panel tj-panel--right">
                                {(() => {
                                    let parsedItems = [];
                                    try {
                                        if (showDetail.items) parsedItems = JSON.parse(showDetail.items);
                                    } catch (e) { parsedItems = []; }
                                    
                                    const hasLegacy = showDetail.measurements || showDetail.description || showDetail.notes;
                                    const hasItems = parsedItems && parsedItems.length > 0;
                                    
                                    if (!hasLegacy && !hasItems) return null;
                                    
                                    return (
                                        <>
                                            <div className="tj-panel-title">📐 Specifications & Items</div>
                                            
                                            {hasItems && (
                                                <div className="tj-detail-items-list" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                    {parsedItems.map((it, idx) => (
                                                        <div key={idx} className="tj-item-card">
                                                            <div className="tj-item-card-header">
                                                                <div className="tj-item-card-title">
                                                                    <span className="tj-item-idx">#{idx + 1}</span>
                                                                    <strong>{it.dressType || 'Item'}</strong>
                                                                </div>
                                                                <div className="tj-item-card-meta">
                                                                    <span className="tj-badge-work">{it.workType}</span>
                                                                    <span className="tj-badge-pcs">{it.pieces} pcs</span>
                                                                </div>
                                                            </div>
                                                            {it.measurements && (
                                                                <div className="tj-item-card-measurements">
                                                                    {it.measurements}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!hasItems && showDetail.measurements && (
                                                <div className="tj-detail-item" style={{ marginBottom: '1rem' }}>
                                                    <span className="tj-detail-label" style={{ marginBottom: '0.2rem' }}>Measurements (Legacy)</span>
                                                    <div className="tj-detail-measurements">{showDetail.measurements}</div>
                                                </div>
                                            )}
                                            {showDetail.description && (
                                                <div className="tj-detail-item" style={{ marginBottom: '1rem' }}>
                                                    <span className="tj-detail-label">Instructions / Description</span>
                                                    <span className="tj-detail-val" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{showDetail.description}</span>
                                                </div>
                                            )}
                                            {showDetail.notes && (
                                                <div className="tj-detail-item" style={{ marginBottom: '1rem' }}>
                                                    <span className="tj-detail-label">Staff Notes</span>
                                                    <span className="tj-detail-val tj-detail-val--muted">{showDetail.notes}</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                <div className="tj-panel-title" style={{ marginTop: '0.5rem' }}>💰 Payment</div>
                                <div className="tj-detail-receipt">
                                    <div className="tj-detail-receipt-row">
                                        <span>Total Amount</span>
                                        <strong>₹{showDetail.totalAmount?.toLocaleString('en-IN') || 0}</strong>
                                    </div>
                                    <div className="tj-detail-receipt-row">
                                        <span>Advance Paid</span>
                                        <strong>₹{showDetail.advancePaid?.toLocaleString('en-IN') || 0}</strong>
                                    </div>
                                    <div className="tj-detail-receipt-row total">
                                        <span>Balance Due</span>
                                        <strong style={{ color: pendingAmount(showDetail) > 0 ? '#ef4444' : '#22c55e' }}>
                                            ₹{pendingAmount(showDetail).toLocaleString('en-IN')}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── STICKY FOOTER ── */}
                        <div className="tj-modal-footer">
                            <button className="tj-btn tj-btn--ghost" onClick={() => setShowDetail(null)}>Close</button>
                            <button className="tj-btn tj-btn--ghost" style={{ marginLeft: 'auto', marginRight: '8px' }} onClick={() => printTailoringBill(showDetail)}>
                                🖨️ Print Bill
                            </button>
                            {showDetail.status !== 'delivered' && showDetail.status !== 'cancelled' && (
                                <button
                                    className="tj-btn tj-btn--primary"
                                    onClick={() => { setShowDeliver(showDetail); setShowDetail(null) }}
                                >
                                    ✅ Mark Delivered
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELIVER MODAL */}
            {showDeliver && (
                <div className="tj-modal-overlay" onClick={() => setShowDeliver(null)}>
                    <div className="tj-modal tj-modal--sm" onClick={e => e.stopPropagation()}>
                        <h2 className="tj-modal-title">📦 Mark as Delivered</h2>
                        <p className="tj-modal-sub">
                            {showDeliver.customerName} — {showDeliver.tokenNumber}<br />
                            Balance: ₹{pendingAmount(showDeliver).toLocaleString('en-IN')}
                        </p>
                        <form onSubmit={handleDeliver} className="tj-form">
                            <div className="tj-form-row">
                                <label className="tj-label">Amount Collected Now (₹)</label>
                                <input
                                    type="number"
                                    className="tj-input"
                                    min={0}
                                    value={deliverForm.amountCollected}
                                    onChange={e => setDeliverForm({ amountCollected: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="tj-modal-actions">
                                <button type="button" className="tj-btn tj-btn--ghost" onClick={() => setShowDeliver(null)}>Cancel</button>
                                <button type="submit" className="tj-btn tj-btn--primary">Confirm Delivery</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <iframe id="tj-print-iframe" title="tj-print" style={{ display: 'none' }}></iframe>
        </div>
    )
}
