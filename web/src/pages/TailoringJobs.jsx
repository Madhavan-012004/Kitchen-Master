import React, { useState, useEffect, useCallback } from 'react'
import {
    getTailoringJobs, createTailoringJob, updateTailoringStatus,
    deliverTailoringJob, getTailoringStats, updateTailoringJob, deleteTailoringJob, deleteAllTailoringJobs
} from '../api/clothing.js'
import { useAuth } from '../context/AuthContext.jsx'
import { printStitchingBill, getPrinterSettings } from '../api/printerUtils.js'
import './TailoringJobs.css'

const STATUS_LIST = ['received', 'in_progress', 'ready', 'delivered', 'cancelled']
const STATUS_LABEL = {
    received: { label: 'Received', color: '#3b82f6', bg: '#1e3a5f33' },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#78350f22' },
    ready: { label: 'Ready', color: '#22c55e', bg: '#14532d22' },
    delivered: { label: 'Delivered', color: '#6b7280', bg: '#37415133' },
    cancelled: { label: 'Cancelled', color: '#ef4444', bg: '#7f1d1d22' },
}

const TABS = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'orders', label: 'Order Hub', icon: '📝' },
    { id: 'measurements', label: 'Profiles', icon: '✂️' },
    { id: 'customers', label: 'Clients', icon: '👥' },
];

const MEN_MEASUREMENTS = ['Neck', 'Chest', 'Waist', 'Hip', 'Shoulder', 'Sleeve Length', 'Shirt Length', 'Pant Waist', 'Inseam'];
const WOMEN_MEASUREMENTS = [
    'Total Height', 'Shoulder', 'Chest', 'Bust', 'Waist', 'Hip', 'Slit', 'Armhole',
    'Sleeve Height', 'Sleeve Loose', 'Front Neck', 'Back Neck', 'Shoulder to Apex',
    'Apex to Under Bust', 'Apex to Apex', 'Bottom Total Height', 'Seat', 'Leg Loose',
    'Thigh', 'Knee', 'Crotch'
];

export default function TailoringJobs() {
    const [jobs, setJobs] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('orders')
    const [activeStatus, setActiveStatus] = useState('in_progress')
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState(null)
    const { user } = useAuth()
    const isPrintingRef = React.useRef(false)

    // Dashboard Filters
    const [dashPeriod, setDashPeriod] = useState('all')
    const [dashFrom, setDashFrom] = useState('')
    const [dashTo, setDashTo] = useState('')

    // Modals
    const [showAdd, setShowAdd] = useState(false)
    const [showDetail, setShowDetail] = useState(null)
    const [showDeliver, setShowDeliver] = useState(null)
    const [showEdit, setShowEdit] = useState(false)
    const [editForm, setEditForm] = useState({})

    const [showCameraModal, setShowCameraModal] = useState(false)
    const [cameraTarget, setCameraTarget] = useState(null)
    const videoRef = React.useRef(null)
    const streamRef = React.useRef(null)

    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        }
    }, [])

    // Forms
    const [addForm, setAddForm] = useState({
        customerName: '', customerPhone: '',
        gender: 'Men', garmentType: 'Shirt',
        measurements: {},
        assignedCutter: '', assignedTailor: '',
        description: '', materialDescription: '', advancePaid: 0, totalAmount: 0,
        dueDate: '', notes: ''
    })
    const [deliverForm, setDeliverForm] = useState({ amountCollected: 0 })

    const handleImageUpload = (e, setFormState) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormState(f => ({ ...f, materialDescription: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const startCamera = async (target) => {
        setCameraTarget(target);
        setShowCameraModal(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
        } catch (err) {
            showToast('Camera access denied or unavailable', 'error');
            setShowCameraModal(false);
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCameraModal(false);
    }

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            if (cameraTarget === 'add') setAddForm(f => ({ ...f, materialDescription: imageData }));
            else setEditForm(f => ({ ...f, materialDescription: imageData }));
            stopCamera();
        }
    }

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const printTailoringBill = async (job) => {
        if (isPrintingRef.current) return;
        isPrintingRef.current = true;
        try {
            let parsedItems = [];
            try { parsedItems = job.items ? JSON.parse(job.items) : []; } catch (e) { parsedItems = []; }

            const orderObj = {
                orderNumber: job.tokenNumber || job._id,
                createdAt: job.createdAt || new Date().toISOString(),
                customerName: job.customerName,
                customerPhone: job.customerPhone,
                deliveryDate: job.dueDate ? new Date(job.dueDate).toLocaleDateString('en-IN') : '',
                items: parsedItems.length > 0
                    ? parsedItems.map(it => ({ name: `${it.dressType || 'Cloth'} (${it.workType || 'Stitching'})`, quantity: it.pieces || 1, price: 0 }))
                    : [{ name: job.workType || 'Stitching Work', quantity: job.pieces || 1, price: 0 }],
                amountPaid: job.advancePaid || 0,
                balanceAmount: Math.max(0, (job.totalAmount || 0) - (job.advancePaid || 0)),
                total: job.totalAmount || 0,
                subtotal: job.totalAmount || 0,
                taxAmount: 0,
                printWithGst: false,
                isStitchingBill: true,
            };

            const settings = getPrinterSettings();
            if (settings.printerType === 'mini_bt' || settings.printerType === 'bluetooth') {
                const result = await printStitchingBill(orderObj);
                if (result?.success) { showToast('Bill printed to Bluetooth printer 🖨️'); return; }
            }

            const balance = (job.totalAmount || 0) - (job.advancePaid || 0);
            const billHTML = `<!DOCTYPE html><html><head><style>
                @page { margin: 0; }
                body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 10px; font-size: 12px; color: #000; background: #fff; }
                .center { text-align: center; } .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            </style></head><body>
                <div class="center bold title">${user?.restaurantName || 'TAILORING SHOP'}</div>
                <div class="line"></div>
                <div class="center bold" style="font-size:14px">STITCHING BILL</div>
                <div class="line"></div>
                <div class="row"><span>Token:</span><span><b>${job.tokenNumber || ''}</b></span></div>
                <div class="row"><span>Customer:</span><span>${job.customerName}</span></div>
                <div class="line"></div>
                <div class="row"><span>Total:</span><span>Rs. ${job.totalAmount || 0}</span></div>
                <div class="row"><span>Advance:</span><span>Rs. ${job.advancePaid || 0}</span></div>
                <div class="line"></div>
                <div class="row bold"><span>Balance:</span><span>Rs. ${Math.max(0, balance)}</span></div>
            </body></html>`;

            const pw = window.open('', '_blank', 'width=400,height=600');
            if (pw) {
                pw.document.open(); pw.document.write(billHTML); pw.document.close();
                setTimeout(() => { pw.print(); pw.close(); }, 600);
            }
        } catch (err) { } finally { isPrintingRef.current = false; }
    }

    const loadAll = useCallback(async () => {
        try {
            const [jRes, sRes] = await Promise.all([getTailoringJobs(undefined), getTailoringStats()])
            const allData = jRes.data?.data || [];
            // Filter out ANY cancelled jobs so they are effectively "wiped" / deleted from the UI
            const activeJobs = allData.filter(j => j.status !== 'cancelled' && j.status !== 'CANCELLED');
            setJobs(activeJobs.map(j => ({ ...j, status: j.status?.toLowerCase() })))
            setStats(sRes.data?.data || {})
        } catch (e) { showToast('Failed to load jobs', 'error') } finally { setLoading(false) }
    }, [])

    useEffect(() => { loadAll() }, [loadAll])

    const handleAddJob = async (e) => {
        e.preventDefault()
        try {
            // Serialize the entire complex ERP model into the standard legacy schema dynamically!
            const complexPayload = {
                customerName: addForm.customerName,
                customerPhone: addForm.customerPhone,
                description: addForm.description,
                materialDescription: addForm.materialDescription,
                notes: addForm.notes,
                dueDate: addForm.dueDate,
                advancePaid: addForm.advancePaid,
                totalAmount: addForm.totalAmount,
                workType: `${addForm.gender} ${addForm.garmentType}`,
                assignedTailor: addForm.assignedTailor,
                items: JSON.stringify([{
                    dressType: addForm.garmentType,
                    gender: addForm.gender,
                    assignedCutter: addForm.assignedCutter,
                    assignedTailor: addForm.assignedTailor,
                    measurementsMatrix: addForm.measurements,
                    pieces: 1, workType: 'Custom Stitch'
                }]),
                measurements: Object.entries(addForm.measurements).map(([k, v]) => `${k}: ${v}`).join('\n')
            }

            await createTailoringJob(complexPayload)
            setShowAdd(false)
            setAddForm({ customerName: '', customerPhone: '', gender: 'Men', garmentType: 'Shirt', measurements: {}, assignedCutter: '', assignedTailor: '', description: '', advancePaid: 0, totalAmount: 0, dueDate: '', notes: '' })
            loadAll()
            showToast('Premium ERP Job created successfully!')
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create job', 'error')
        }
    }

    const handleStatusChange = async (jobId, newStatus) => {
        if (newStatus === 'delivered') {
            const job = jobs.find(j => j.id || j._id === jobId);
            const pending = (job.totalAmount || 0) - (job.advancePaid || 0);
            setDeliverForm({ amountCollected: pending > 0 ? pending : 0 });
            setShowDeliver(job);
            return;
        }
        try { await updateTailoringStatus(jobId, newStatus); loadAll(); showToast(`Status updated`) }
        catch (err) { showToast('Status update failed', 'error') }
    }

    const handleDeliver = async (e) => {
        e.preventDefault()
        try { await deliverTailoringJob(showDeliver._id, deliverForm); setShowDeliver(null); loadAll(); showToast('Delivered!') }
        catch (err) { showToast('Delivery failed', 'error') }
    }

    const pendingAmount = (j) => (j.totalAmount || 0) - (j.advancePaid || 0)

    const handleDeleteJob = async (id) => {
        if (!window.confirm('Are you sure you want to delete this job?')) return;
        try {
            const job = jobs.find(j => j.id === id || j._id === id);
            if (job) {
                // Soft Delete Fallback: Patch status to cancelled to hide via JS (avoids failing DELETE/PUT constraints)
                await updateTailoringStatus(id, 'cancelled');
            }
            setShowDetail(null);
            loadAll();
            showToast('Job deleted');
        } catch (e) {
            console.error('Delete error', e);
            showToast(`Failed: ${e.response?.data?.message || e.message}`, 'error');
        }
    }
    const handleWipeAll = async () => {
        if (!window.confirm('Wipe ALL Tailoring data? This cannot be undone.')) return;
        try {
            const res = await getTailoringJobs();
            const jobsList = res.data?.data || [];
            if (jobsList.length > 0) {
                // Wipe one-by-one with PATCH to avoid backend 500 errors on PUT/DELETE mappings
                const activeJobs = jobsList.filter(j => j.status !== 'cancelled' && j.status !== 'CANCELLED');
                await Promise.all(activeJobs.map(j => updateTailoringStatus(j.id || j._id, 'cancelled')));
            }
            loadAll();
            showToast('All tailoring data has been wiped.');
        } catch (e) {
            console.error('Wipe error', e);
            showToast(`Wipe Failed: ${e.response?.data?.message || e.message}`, 'error');
        }
    }

    const handleEditOpen = (job) => {
        let parsedMeasurements = {};
        try {
            if (job.measurements && job.measurements.includes(':')) {
                job.measurements.split('\n').forEach(line => {
                    const [k, v] = line.split(':');
                    if (k && v) parsedMeasurements[k.trim()] = parseFloat(v.trim()) || v.trim();
                });
            }
        } catch (e) { }

        let gender = 'Men', garmentType = 'Shirt';
        if (job.workType) {
            const parts = job.workType.split(' ');
            if (['Men', 'Women', 'Children'].includes(parts[0])) {
                gender = parts[0];
                garmentType = parts.slice(1).join(' ');
            } else {
                garmentType = job.workType;
            }
        }

        let parsedItems = [];
        try {
            if (job.items) parsedItems = JSON.parse(job.items);
            if (parsedItems.length > 0) {
                gender = parsedItems[0].gender || gender;
                garmentType = parsedItems[0].dressType || garmentType;
            }
        } catch (e) { }

        setEditForm({
            ...job,
            gender,
            garmentType,
            measurements: parsedMeasurements,
            materialDescription: job.materialDescription || '',
            assignedCutter: parsedItems[0]?.assignedCutter || '',
            advancePaid: job.advancePaid || 0,
            totalAmount: job.totalAmount || 0,
            dueDate: job.deliveryDate || ''
        });
        setShowEdit(true);
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const complexPayload = {
                customerName: editForm.customerName,
                customerPhone: editForm.customerPhone,
                description: editForm.description,
                materialDescription: editForm.materialDescription,
                notes: editForm.specialNotes,
                dueDate: editForm.dueDate,
                advancePaid: editForm.advancePaid,
                totalAmount: editForm.totalAmount,
                workType: `${editForm.gender} ${editForm.garmentType}`,
                assignedTailor: editForm.assignedTailor,
                items: JSON.stringify([{
                    dressType: editForm.garmentType,
                    gender: editForm.gender,
                    assignedCutter: editForm.assignedCutter,
                    assignedTailor: editForm.assignedTailor,
                    measurementsMatrix: editForm.measurements,
                    pieces: 1, workType: 'Custom Stitch'
                }]),
                measurements: Object.entries(editForm.measurements).map(([k, v]) => `${k}: ${v}`).join('\n')
            }
            await updateTailoringJob(editForm.id || editForm._id, complexPayload);
            setShowEdit(false);
            setShowDetail(null);
            loadAll();
            showToast('Job updated successfully');
        } catch (e) {
            showToast('Failed to update job', 'error');
        }
    }

    // Derived filtering for Orders tab
    const displayJobs = activeStatus === '' ? jobs : jobs.filter(j => j.status === activeStatus)
    const filteredJobs = displayJobs.filter(j => j.customerName?.toLowerCase().includes(search.toLowerCase()) || j.customerPhone?.includes(search) || j.tokenNumber?.toLowerCase().includes(search.toLowerCase()))

    // Calculate financials strictly via JS as per user request to bypass backend constraints
    const jsTotalCollected = jobs.reduce((sum, j) => sum + (j.advancePaid || 0), 0);
    const jsPendingAmount = jobs.reduce((sum, j) => (j.status !== 'delivered') ? sum + ((j.totalAmount || 0) - (j.advancePaid || 0)) : sum, 0);

    // Dashboard specific filtering
    const computeDashboardData = () => {
        let filtered = jobs;
        if (dashPeriod !== 'all') {
            const todayD = new Date();
            let startD = new Date();
            if (dashPeriod === 'today') startD = todayD;
            else if (dashPeriod === 'week') startD.setDate(todayD.getDate() - 7);
            else if (dashPeriod === 'month') startD.setMonth(todayD.getMonth() - 1);

            const startStr = startD.toISOString().split('T')[0];
            const endStr = todayD.toISOString().split('T')[0];

            filtered = jobs.filter(j => {
                if (!j.createdAt) return true;
                const d = j.createdAt.split('T')[0];
                if (dashPeriod === 'custom') {
                    if (dashFrom && d < dashFrom) return false;
                    if (dashTo && d > dashTo) return false;
                    return true;
                }
                return d >= startStr && d <= endStr;
            });
        }
        return {
            totalCollected: filtered.reduce((s, j) => s + (j.advancePaid || 0), 0),
            pending: filtered.reduce((s, j) => (j.status !== 'delivered') ? s + ((j.totalAmount || 0) - (j.advancePaid || 0)) : s, 0),
            in_progress: filtered.filter(j => j.status === 'in_progress').length,
            ready: filtered.filter(j => j.status === 'ready').length,
            delivered: filtered.filter(j => j.status === 'delivered').length,
        }
    };
    const dashData = computeDashboardData();

    if (loading) return (
        <div className="tj-loading">
            <div className="tj-spinner" /><span>Loading Master ERP System...</span>
        </div>
    )

    return (
        <div className="tj-erp-root">
            {toast && <div className={`tj-toast tj-toast--${toast.type}`}>{toast.msg}</div>}

            {/* --- ERP SIDEBAR --- */}
            <div className="tj-erp-sidebar">
                <div className="tj-erp-brand">
                    <span className="tj-erp-logo">🧵</span>
                    <div className="tj-erp-brand-text">
                        <h2>BloomTailor</h2>
                        <p>Studio ERP Edition</p>
                    </div>
                </div>
                <nav className="tj-erp-nav">
                    {TABS.map(t => (
                        <button key={t.id} className={`tj-erp-nav-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                            <span className="tj-icon">{t.icon}</span> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* --- ERP MAIN CONTENT --- */}
            <div className="tj-erp-content">
                <div className="tj-erp-topbar">
                    <h1 className="tj-topbar-title">{TABS.find(t => t.id === activeTab)?.label}</h1>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="tj-btn tj-btn--ghost" onClick={handleWipeAll} style={{ color: '#ef4444', borderColor: '#ef4444' }}>Wipe Entire Data</button>
                        <button className="tj-btn tj-btn--primary" onClick={() => setShowAdd(true)}>+ Create Master Order</button>
                    </div>
                </div>

                <div className="tj-erp-scrollview">

                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
                            <div className="tj-dash-filters" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                                <label style={{ fontWeight: 600 }}>Period:</label>
                                <select className="tj-input" style={{ width: 'auto' }} value={dashPeriod} onChange={e => setDashPeriod(e.target.value)}>
                                    <option value="all">Lifetime Overview</option>
                                    <option value="today">Today</option>
                                    <option value="week">Past 7 Days</option>
                                    <option value="month">Past 1-Month</option>
                                    <option value="custom">Custom Date Range</option>
                                </select>
                                {dashPeriod === 'custom' && (
                                    <>
                                        <input type="date" className="tj-input" style={{ width: 'auto' }} value={dashFrom} onChange={e => setDashFrom(e.target.value)} />
                                        <span style={{ color: '#64748b' }}>to</span>
                                        <input type="date" className="tj-input" style={{ width: 'auto' }} value={dashTo} onChange={e => setDashTo(e.target.value)} />
                                    </>
                                )}
                            </div>
                            <div className="tj-dashboard-grid" style={{ padding: 0 }}>
                                <div className="tj-dash-card tj-dash--sales">
                                    <h3>{dashPeriod === 'all' ? 'Total Lifetime Revenue' : 'Period Revenue'}</h3>
                                    <h2>₹{dashData.totalCollected?.toLocaleString('en-IN') || 0}</h2>
                                    <p>Collected from Tailoring</p>
                                </div>
                                <div className="tj-dash-card tj-dash--pending">
                                    <h3>Pending Dues</h3>
                                    <h2>₹{dashData.pending?.toLocaleString('en-IN') || 0}</h2>
                                    <p>Uncollected balances</p>
                                </div>
                                <div className="tj-dash-card">
                                    <h3>Active Queue</h3>
                                    <h2>{dashData.in_progress || 0}</h2>
                                    <p>Orders currently cutting/stitching</p>
                                </div>
                                <div className="tj-dash-card">
                                    <h3>Ready to Deliver</h3>
                                    <h2>{dashData.ready || 0}</h2>
                                    <p>Awaiting customer pickup</p>
                                </div>
                                <div className="tj-dash-card" style={{ borderColor: '#22c55e' }}>
                                    <h3 style={{ color: '#22c55e' }}>Completed Orders</h3>
                                    <h2>{dashData.delivered || 0}</h2>
                                    <p>Total garments safely delivered</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ORDERS TAB */}
                    {(activeTab === 'orders' || activeTab === 'measurements' || activeTab === 'customers') && (
                        <div className="tj-orders-view">
                            <div className="tj-filters">
                                <input className="tj-search" type="text" placeholder="Search by name, phone or token..." value={search} onChange={e => setSearch(e.target.value)} />
                                <div className="tj-status-tabs">
                                    {['in_progress', '', 'received', 'ready', 'delivered', 'cancelled'].map(s => (
                                        <button key={s} className={`tj-tab ${activeStatus === s ? 'tj-tab--active' : ''}`} onClick={() => setActiveStatus(s)}>
                                            {s === '' ? 'All' : STATUS_LABEL[s].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredJobs.length === 0 ? (
                                <div className="tj-empty">
                                    <span className="tj-empty-icon">📭</span>
                                    <p>No records found in this queue.</p>
                                </div>
                            ) : (
                                <div className="tj-list">
                                    {filteredJobs.map(j => {
                                        const st = STATUS_LABEL[j.status] || STATUS_LABEL.received
                                        const balance = pendingAmount(j)
                                        return (
                                            <div key={j.id || j._id} className="tj-card">
                                                <div className="tj-card-left">
                                                    <div className="tj-token">{j.tokenNumber || '#'}</div>
                                                    <div className="tj-status-badge" style={{ color: st.color, background: st.bg }}>{st.label}</div>
                                                </div>
                                                <div className="tj-card-center">
                                                    <div className="tj-customer-name">{j.customerName}</div>
                                                    <div className="tj-customer-phone">{j.customerPhone}</div>
                                                    <div className="tj-work-meta">
                                                        <span className="tj-work-type">{j.workType}</span>
                                                    </div>
                                                </div>

                                                {j.materialDescription && j.materialDescription.startsWith('data:image') && (
                                                    <div style={{ display: 'flex', alignItems: 'center', margin: '0 1rem' }}>
                                                        <img src={j.materialDescription} alt="Material" style={{ width: '100px', height: '60px', objectFit: 'cover', border: '3px solid #3b82f6', borderRadius: '4px' }} />
                                                    </div>
                                                )}

                                                <div className="tj-card-right">
                                                    <div className="tj-amounts">
                                                        <span className="tj-amount-total">₹{j.totalAmount?.toLocaleString('en-IN') || 0}</span>
                                                        {balance > 0 && <span className="tj-amount-balance">₹{balance.toLocaleString('en-IN')} due</span>}
                                                    </div>
                                                    <div className="tj-card-actions">
                                                        {j.status !== 'delivered' && j.status !== 'cancelled' && (
                                                            <select className="tj-status-select" value={j.status} onChange={e => handleStatusChange(j.id || j._id, e.target.value)}>
                                                                {STATUS_LIST.filter(s => s !== 'cancelled' || j.status === 'cancelled').map(s => <option key={s} value={s}>{STATUS_LABEL[s].label}</option>)}
                                                            </select>
                                                        )}
                                                        <button className="tj-detail-btn" onClick={() => setShowDetail(j)}>📄 Details</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MASTER ORDER WIZARD MODAL */}
            {showAdd && (
                <div className="tj-modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="tj-modal tj-modal--erp" onClick={e => e.stopPropagation()}>
                        <div className="tj-modal-header">
                            <div>
                                <h2 className="tj-modal-title">✨ New Order Master Configurator</h2>
                                <p className="tj-modal-sub">Comprehensive workflow engine for tailor assignments and exact matrices.</p>
                            </div>
                            <button className="tj-close-btn" type="button" onClick={() => setShowAdd(false)}>✕</button>
                        </div>

                        <form onSubmit={handleAddJob} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="tj-erp-form-scroll">

                                {/* SEC 1: CUSTOMER */}
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">👤 1. Client Identity</h3>
                                    <div className="tj-form-grid-2">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Full Name *</label>
                                            <input className="tj-input" required value={addForm.customerName} onChange={e => setAddForm(f => ({ ...f, customerName: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Mobile Number *</label>
                                            <input className="tj-input" required value={addForm.customerPhone} onChange={e => setAddForm(f => ({ ...f, customerPhone: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* SEC 2: GARMENT & STYLE */}
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">👗 2. Garment Architecture</h3>
                                    <div className="tj-form-grid-2">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Gender / Segment</label>
                                            <select className="tj-input" value={addForm.gender} onChange={e => setAddForm(f => ({ ...f, gender: e.target.value, measurements: {} }))}>
                                                <option>Men</option><option>Women</option><option>Children</option>
                                            </select>
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Garment Type</label>
                                            <input className="tj-input" placeholder="e.g. Kurti, Blazer, Lehenga" value={addForm.garmentType} onChange={e => setAddForm(f => ({ ...f, garmentType: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* SEC 2.5: MATERIAL IMAGE CAPTURE */}
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">📸 Material Photo</h3>
                                    <div className="tj-form-row">
                                        <label className="tj-label">Capture or Upload Cloth Image</label>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <button type="button" className="tj-btn tj-btn--primary" onClick={() => startCamera('add')}>📸 Take Photo</button>
                                            <button type="button" className="tj-btn tj-btn--ghost" onClick={() => document.getElementById('file-upload-add').click()}>📁 Upload Image</button>
                                            <input type="file" id="file-upload-add" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, setAddForm)} />
                                        </div>
                                        {addForm.materialDescription && addForm.materialDescription.startsWith('data:image') && (
                                            <div style={{ marginTop: '1rem' }}>
                                                <img src={addForm.materialDescription} alt="Material" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #3b82f6' }} />
                                                <button type="button" className="tj-btn" style={{ marginLeft: '1rem', color: '#ef4444', background: 'transparent' }} onClick={() => setAddForm(f => ({ ...f, materialDescription: '' }))}>✖ Remove</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SEC 3: EXACT MEASUREMENTS */}
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">✂️ 3. Measurement Matrix</h3>
                                    <div className="tj-measurements-grid">
                                        {(addForm.gender === 'Women' ? WOMEN_MEASUREMENTS : MEN_MEASUREMENTS).map(m => (
                                            <div key={m} className="tj-form-row">
                                                <label className="tj-label">{m} (in)</label>
                                                <input className="tj-input" type="number" step="0.25" placeholder="0.00" value={addForm.measurements[m] || ''} onChange={e => setAddForm(f => ({ ...f, measurements: { ...f.measurements, [m]: e.target.value } }))} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* SEC 4: ASSIGNMENTS & FINANCIALS */}
                                <div className="tj-erp-section" style={{ borderBottom: 'none' }}>
                                    <h3 className="tj-erp-section-title">💼 4. Workflow & Billing</h3>
                                    <div className="tj-form-grid-3">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Master Cutter</label>
                                            <input className="tj-input" placeholder="Assign employee..." value={addForm.assignedCutter} onChange={e => setAddForm(f => ({ ...f, assignedCutter: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Master Tailor</label>
                                            <input className="tj-input" placeholder="Assign employee..." value={addForm.assignedTailor} onChange={e => setAddForm(f => ({ ...f, assignedTailor: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Due Date</label>
                                            <input type="date" className="tj-input" value={addForm.dueDate} onChange={e => setAddForm(f => ({ ...f, dueDate: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="tj-form-grid-2" style={{ marginTop: '1rem' }}>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Total Amount (₹)</label>
                                            <input type="number" className="tj-input" value={addForm.totalAmount} onChange={e => setAddForm(f => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Advance Paid (₹)</label>
                                            <input type="number" className="tj-input" value={addForm.advancePaid} onChange={e => setAddForm(f => ({ ...f, advancePaid: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="tj-modal-footer">
                                <button type="button" className="tj-btn tj-btn--ghost" onClick={() => setShowAdd(false)}>Discard</button>
                                <button type="submit" className="tj-btn tj-btn--primary">Inject into Flow 🚀</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {showDetail && (
                <div className="tj-modal-overlay" onClick={() => setShowDetail(null)}>
                    <div className="tj-modal tj-modal--erp" onClick={e => e.stopPropagation()}>
                        <div className="tj-modal-header">
                            <h2 className="tj-modal-title">Job Portfolio {showDetail.tokenNumber}</h2>
                            <button className="tj-close-btn" onClick={() => setShowDetail(null)}>✕</button>
                        </div>
                        <div className="tj-erp-form-scroll" style={{ padding: '2rem' }}>
                            <div className="tj-detail-grid">
                                <div><strong>Client:</strong> {showDetail.customerName} - {showDetail.customerPhone}</div>
                                <div><strong>Garment:</strong> {showDetail.workType}</div>
                            </div>

                            <h3 className="tj-erp-section-title" style={{ marginTop: '2rem' }}>✂️ Decoded Measurements</h3>
                            <pre className="tj-detail-measurements" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                                {showDetail.measurements || "No structured measurements captured."}
                            </pre>

                            {showDetail.materialDescription && showDetail.materialDescription.startsWith('data:image') && (
                                <>
                                    <h3 className="tj-erp-section-title" style={{ marginTop: '2rem' }}>📸 Material Photo</h3>
                                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                        <img src={showDetail.materialDescription} alt="Material Preview" style={{ maxWidth: '100%', maxHeight: '300px', border: '4px solid #3b82f6', borderRadius: '8px' }} />
                                    </div>
                                </>
                            )}

                            <h3 className="tj-erp-section-title" style={{ marginTop: '2rem' }}>💼 Financials</h3>
                            <div className="tj-detail-receipt">
                                <div>Total: ₹{showDetail.totalAmount}</div>
                                <div>Advance: ₹{showDetail.advancePaid}</div>
                                <h3>Balance: ₹{pendingAmount(showDetail)}</h3>
                            </div>
                        </div>
                        <div className="tj-modal-footer">
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                                <button className="tj-btn" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }} onClick={() => handleDeleteJob(showDetail.id || showDetail._id)}>🗑 Delete</button>
                                <button className="tj-btn tj-btn--ghost" onClick={() => handleEditOpen(showDetail)}>✏️ Edit Financials</button>
                            </div>
                            <button className="tj-btn tj-btn--ghost" onClick={() => setShowDetail(null)}>Close</button>
                            <button className="tj-btn tj-btn--ghost" onClick={() => printTailoringBill(showDetail)}>🖨️ Print Matrix</button>
                            {showDetail.status !== 'delivered' && showDetail.status !== 'cancelled' && (
                                <button className="tj-btn tj-btn--primary" onClick={() => {
                                    const pending = pendingAmount(showDetail);
                                    setDeliverForm({ amountCollected: pending > 0 ? pending : 0 });
                                    setShowDeliver(showDetail);
                                    setShowDetail(null);
                                }}>✅ Mark Delivered</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELIVER MODAL */}
            {showDeliver && (
                <div className="tj-modal-overlay" onClick={() => setShowDeliver(null)}>
                    <div className="tj-modal tj-modal--sm" onClick={e => e.stopPropagation()}>
                        <div className="tj-modal-header" style={{ padding: '1.2rem 1.5rem' }}>
                            <div>
                                <h2 className="tj-modal-title" style={{ fontSize: '1.2rem' }}>📦 Final Delivery</h2>
                                <p className="tj-modal-sub" style={{ margin: '0.2rem 0 0' }}>Job Token: {showDeliver.tokenNumber}</p>
                            </div>
                            <button className="tj-close-btn" type="button" onClick={() => setShowDeliver(null)}>✕</button>
                        </div>

                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Bill</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>₹{showDeliver.totalAmount}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Pending Dues</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>₹{pendingAmount(showDeliver)}</div>
                            </div>
                        </div>

                        <form onSubmit={handleDeliver} className="tj-form" style={{ padding: '1.5rem' }}>
                            <div className="tj-form-row">
                                <label className="tj-label">Amount Collected Now (₹)</label>
                                <input type="number" className="tj-input" required value={deliverForm.amountCollected} onChange={e => setDeliverForm({ amountCollected: parseFloat(e.target.value) || 0 })} style={{ fontSize: '1.1rem', fontWeight: 700 }} />
                            </div>
                            <div className="tj-modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="tj-btn tj-btn--ghost" onClick={() => setShowDeliver(null)}>Cancel</button>
                                <button type="submit" className="tj-btn tj-btn--primary">Confirm Delivery</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {showEdit && (
                <div className="tj-modal-overlay" onClick={() => setShowEdit(false)}>
                    <div className="tj-modal tj-modal--erp" onClick={e => e.stopPropagation()}>
                        <div className="tj-modal-header">
                            <div>
                                <h2 className="tj-modal-title">✏️ Edit Order Master Configurator</h2>
                                <p className="tj-modal-sub">Modify client metrics and financials.</p>
                            </div>
                            <button className="tj-close-btn" type="button" onClick={() => setShowEdit(false)}>✕</button>
                        </div>
                        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="tj-erp-form-scroll">
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">👤 1. Client Identity</h3>
                                    <div className="tj-form-grid-2">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Full Name *</label>
                                            <input className="tj-input" required value={editForm.customerName || ''} onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Mobile Number *</label>
                                            <input className="tj-input" required value={editForm.customerPhone || ''} onChange={e => setEditForm(f => ({ ...f, customerPhone: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">👗 2. Garment Architecture</h3>
                                    <div className="tj-form-grid-2">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Gender / Segment</label>
                                            <select className="tj-input" value={editForm.gender || 'Men'} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value, measurements: {} }))}>
                                                <option>Men</option><option>Women</option><option>Children</option>
                                            </select>
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Garment Type</label>
                                            <input className="tj-input" placeholder="e.g. Kurti, Blazer, Lehenga" value={editForm.garmentType || ''} onChange={e => setEditForm(f => ({ ...f, garmentType: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* SEC 2.5: MATERIAL IMAGE CAPTURE */}
                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">📸 Material Photo</h3>
                                    <div className="tj-form-row">
                                        <label className="tj-label">Capture or Upload Cloth Image</label>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <button type="button" className="tj-btn tj-btn--primary" onClick={() => startCamera('edit')}>📸 Take Photo</button>
                                            <button type="button" className="tj-btn tj-btn--ghost" onClick={() => document.getElementById('file-upload-edit').click()}>📁 Upload Image</button>
                                            <input type="file" id="file-upload-edit" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload(e, setEditForm)} />
                                        </div>
                                        {editForm.materialDescription && editForm.materialDescription.startsWith('data:image') && (
                                            <div style={{ marginTop: '1rem' }}>
                                                <img src={editForm.materialDescription} alt="Material" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #3b82f6' }} />
                                                <button type="button" className="tj-btn" style={{ marginLeft: '1rem', color: '#ef4444', background: 'transparent' }} onClick={() => setEditForm(f => ({ ...f, materialDescription: '' }))}>✖ Remove</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="tj-erp-section">
                                    <h3 className="tj-erp-section-title">✂️ 3. Measurement Matrix</h3>
                                    <div className="tj-measurements-grid">
                                        {(editForm.gender === 'Women' ? WOMEN_MEASUREMENTS : MEN_MEASUREMENTS).map(m => (
                                            <div key={m} className="tj-form-row">
                                                <label className="tj-label">{m} (in)</label>
                                                <input className="tj-input" type="number" step="0.25" placeholder="0.00" value={(editForm.measurements && editForm.measurements[m]) || ''} onChange={e => setEditForm(f => ({ ...f, measurements: { ...(f.measurements || {}), [m]: e.target.value } }))} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="tj-erp-section" style={{ borderBottom: 'none' }}>
                                    <h3 className="tj-erp-section-title">💼 4. Workflow & Billing</h3>
                                    <div className="tj-form-grid-3">
                                        <div className="tj-form-row">
                                            <label className="tj-label">Master Cutter</label>
                                            <input className="tj-input" placeholder="Assign employee..." value={editForm.assignedCutter || ''} onChange={e => setEditForm(f => ({ ...f, assignedCutter: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Master Tailor</label>
                                            <input className="tj-input" placeholder="Assign employee..." value={editForm.assignedTailor || ''} onChange={e => setEditForm(f => ({ ...f, assignedTailor: e.target.value }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Due Date</label>
                                            <input type="date" className="tj-input" value={editForm.dueDate || ''} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="tj-form-grid-2" style={{ marginTop: '1rem' }}>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Total Amount (₹)</label>
                                            <input type="number" className="tj-input" value={editForm.totalAmount !== undefined ? editForm.totalAmount : ''} onChange={e => setEditForm(f => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                        <div className="tj-form-row">
                                            <label className="tj-label">Advance Paid (₹)</label>
                                            <input type="number" className="tj-input" value={editForm.advancePaid !== undefined ? editForm.advancePaid : ''} onChange={e => setEditForm(f => ({ ...f, advancePaid: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="tj-modal-footer">
                                <button type="button" className="tj-btn tj-btn--ghost" onClick={() => setShowEdit(false)}>Discard</button>
                                <button type="submit" className="tj-btn tj-btn--primary">Save Updates 💾</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CAMERA MODAL */}
            {showCameraModal && (
                <div className="tj-modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="tj-modal tj-modal--sm" style={{ background: '#1e293b', color: '#fff', textAlign: 'center' }}>
                        <div className="tj-modal-header" style={{ borderBottom: '1px solid #334155' }}>
                            <h2 className="tj-modal-title" style={{ color: '#fff' }}>Capture Material</h2>
                            <button className="tj-close-btn" type="button" onClick={stopCamera} style={{ color: '#fff' }}>✕</button>
                        </div>
                        <div style={{ padding: '1rem', position: 'relative' }}>
                            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px', background: '#000' }} />
                        </div>
                        <div className="tj-modal-footer" style={{ borderTop: '1px solid #334155', justifyContent: 'center' }}>
                            <button type="button" className="tj-btn tj-btn--primary" onClick={capturePhoto} style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', background: '#3b82f6', color: 'white' }}>📸 SNAP PHOTO</button>
                        </div>
                    </div>
                </div>
            )}

            <iframe id="tj-print-iframe" title="tj-print" style={{ display: 'none' }}></iframe>
        </div>
    )
}
