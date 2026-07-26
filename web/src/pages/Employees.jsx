import React, { useEffect, useState, useCallback } from 'react'
import api from '../api/client.js'
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import './Employees.css'

const ROLE_ICONS = {
    waiter: '🍽️',
    biller: '💰',
    manager: '🛡️',
    kot: '👨‍🍳',
    owner: '👑',
    inventory: '📦',
    tailor: '🧵',
}

function formatHours(hours) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
}

function calcLiveHours(checkInTime) {
    return parseFloat(((new Date() - new Date(checkInTime)) / 3600000).toFixed(2))
}

export default function EmployeesPage() {
    const { storeMode } = usePOSMode()
    const { user } = useAuth()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'stakeholder'

    /* ── Tab ── */
    const [tab, setTab] = useState('staff')  // 'staff' | 'live' | 'history'

    /* ── Staff data ── */
    const [employees, setEmployees] = useState([])
    const [loadingStaff, setLoadingStaff] = useState(true)
    const [search, setSearch] = useState('')
    const [totalTables, setTotalTables] = useState(30)

    /* ── Attendance data ── */
    const [activeEmployees, setActiveEmployees] = useState([])
    const [historyRecords, setHistoryRecords] = useState([])
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
    const [loadingAtt, setLoadingAtt] = useState(false)

    /* ── Performance data (ratings) ── */
    const [perfMap, setPerfMap] = useState({})  // keyed by employee _id (as string)

    /* ── Modal ── */
    const [reviewsEmp, setReviewsEmp] = useState(null)  // employee object being viewed
    const [selectedRevOrder, setSelectedRevOrder] = useState(null) // selected order in reviews modal
    const [showModal, setShowModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: [] })
    const [saving, setSaving] = useState(false)

    /* ── Fetch Staff ── */
    const fetchEmployees = useCallback(() => {
        setLoadingStaff(true)
        api.get('/auth/employees')
            .then(r => setEmployees(r.data.data?.employees || []))
            .catch(e => alert(e.response?.data?.message || 'Failed to fetch staff'))
            .finally(() => setLoadingStaff(false))
    }, [])

    /* ── Fetch performance stats (ratings) for all employees ── */
    const fetchPerformance = useCallback(() => {
        if (!isManagerOrOwner) return
        api.get('/orders/employee/performance')
            .then(r => {
                const list = Array.isArray(r.data.data) ? r.data.data : []
                const map = {}
                list.forEach(p => { map[String(p.id)] = p })
                setPerfMap(map)
            })
            .catch(() => { }) // silent fail
    }, [isManagerOrOwner])

    /* ── Fetch Attendance ── */
    const fetchAttendance = useCallback(async (silent = false) => {
        if (!isManagerOrOwner) return
        if (!silent) setLoadingAtt(true)
        try {
            const [activeRes, histRes] = await Promise.all([
                api.get('/attendance/active'),
                api.get(`/attendance?date=${filterDate}`)
            ])
            setActiveEmployees(activeRes.data.data?.active || [])
            setHistoryRecords(histRes.data.data?.records || [])
        } catch (e) {
            console.error(e)
        } finally {
            if (!silent) setLoadingAtt(false)
        }
    }, [filterDate, isManagerOrOwner])

    useEffect(() => {
        fetchEmployees()
        fetchPerformance()
        api.get('/auth/me').then(r => setTotalTables(r.data.data?.totalTables || 30)).catch(() => { })
    }, [fetchEmployees, fetchPerformance])

    useEffect(() => {
        fetchAttendance()
        const id = setInterval(() => fetchAttendance(true), 5000)
        return () => clearInterval(id)
    }, [fetchAttendance])

    /* ── Build live lookup: which employee IDs are active ── */
    const liveIds = new Set(activeEmployees.map(r => r.employeeId?._id))

    /* ── Filtered staff ── */
    const filteredEmployees = employees.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.email?.toLowerCase().includes(search.toLowerCase()) ||
        e.role?.toLowerCase().includes(search.toLowerCase())
    )

    /* ── Modal helpers ── */
    const openAdd = () => {
        setFormData({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: [] })
        setIsEditing(false)
        setShowModal(true)
    }

    const openEdit = (emp) => {
        setFormData({ _id: emp._id, name: emp.name, email: emp.email, password: '', role: emp.role || 'waiter', assignedTables: emp.assignedTables || [] })
        setIsEditing(true)
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this staff member?')) return
        try {
            await api.delete(`/auth/users/${id}`)
            fetchEmployees()
        } catch (e) {
            alert(e.response?.data?.message || 'Failed to delete')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = { name: formData.name, email: formData.email, role: formData.role, assignedTables: formData.assignedTables || [] }
            if (formData.password) payload.password = formData.password
            if (isEditing) {
                await api.put(`/auth/users/${formData._id}`, payload)
            } else {
                if (!payload.password) throw new Error('Password is required for new staff')
                await api.post('/auth/employee/register', payload)
            }
            setShowModal(false)
            fetchEmployees()
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Error saving staff')
        } finally {
            setSaving(false)
        }
    }

    /* ── Role options ── */
    const roleOptions = storeMode === 'clothing'
        ? ['manager', 'biller', 'inventory', 'tailor']
        : (storeMode === 'supermarket' || storeMode === 'market')
            ? ['manager', 'biller', 'inventory']
            : ['waiter', 'kot', 'biller', 'manager', 'inventory']

    /* ── Attendance summary numbers ── */
    const uniqueToday = new Set([...activeEmployees, ...historyRecords].map(r => r.employeeId?._id)).size
    const totalHoursToday = historyRecords.reduce((s, r) => s + (r.totalHours || 0), 0)

    return (
        <div className="staff-page">
            <StakeholderRestaurantTabs />

            {/* ── Hero Header ── */}
            <div className="staff-hero">
                <div className="staff-hero-top">
                    <div>
                        <h1 className="staff-hero-title">👥 Staff Management</h1>
                        <p className="staff-hero-subtitle">{employees.length} staff · {activeEmployees.length} active now</p>
                    </div>
                    <div className="staff-hero-actions">
                        <div className="staff-search-wrap">
                            <span className="staff-search-icon">🔍</span>
                            <input
                                className="staff-search"
                                placeholder="Search staff…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button className="staff-add-btn" onClick={openAdd}>
                            + Add Staff
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="staff-tab-bar">
                    <button className={`staff-tab${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
                        👤 Staff
                        <span className="staff-tab-badge">{employees.length}</span>
                    </button>
                    {isManagerOrOwner && (
                        <>
                            <button className={`staff-tab${tab === 'live' ? ' active' : ''}`} onClick={() => setTab('live')}>
                                🟢 Live Attendance
                                {activeEmployees.length > 0 && <span className="staff-tab-badge">{activeEmployees.length}</span>}
                            </button>
                            <button className={`staff-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
                                📋 History
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="staff-tab-content">

                {/* ══════════ STAFF TAB ══════════ */}
                {tab === 'staff' && (
                    <>
                        {loadingStaff ? (
                            <div className="staff-spinner">
                                <div className="staff-spin" />
                                <span>Loading staff…</span>
                            </div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="staff-empty">
                                <div className="staff-empty-icon">👤</div>
                                <h3>{search ? 'No staff match your search' : 'No staff members yet'}</h3>
                                {!search && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "+ Add Staff" to get started</span>}
                            </div>
                        ) : (
                            <div className="staff-grid">
                                {filteredEmployees.map(emp => {
                                    const isLive = liveIds.has(emp._id)
                                    const perf = perfMap[String(emp._id)] || {}
                                    const canShowReviews = emp.role === 'waiter' || emp.role === 'tailor'
                                    return (
                                        <div
                                            key={emp._id}
                                            className={`staff-card${canShowReviews ? ' staff-card-clickable' : ''}`}
                                            onClick={canShowReviews ? () => setReviewsEmp(emp) : undefined}
                                        >
                                            <div className="staff-card-header">
                                                <div className="staff-avatar-wrap">
                                                    <div className="staff-avatar">
                                                        {emp.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div className={`staff-live-dot ${isLive ? 'live' : 'offline'}`} title={isLive ? 'Currently working' : 'Offline'} />
                                                </div>
                                                <div className="staff-card-info">
                                                    <div className="staff-card-name">{emp.name}</div>
                                                    <div className="staff-card-email">{emp.email}</div>
                                                    <span className={`staff-role-badge ${emp.role}`}>
                                                        {ROLE_ICONS[emp.role] || '👤'} {emp.role?.toUpperCase()}
                                                    </span>
                                                </div>
                                                {canShowReviews && (
                                                    <div className="staff-rating-pill">
                                                        <span className="staff-rating-star">★</span>
                                                        <span className="staff-rating-val">
                                                            {perf.averageRating > 0 ? Number(perf.averageRating).toFixed(1) : '–'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {emp.role === 'waiter' && emp.assignedTables?.length > 0 && (
                                                <div>
                                                    <span className="table-chip-label">Assigned Tables</span>
                                                    <div className="staff-tables">
                                                        {emp.assignedTables.map(t => (
                                                            <span key={t} className="table-chip">T{t}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {canShowReviews && (
                                                <div className="staff-reviews-hint">👆 Tap to see customer reviews</div>
                                            )}

                                            <div className="staff-card-actions" onClick={e => e.stopPropagation()}>
                                                <button className="staff-edit-btn" onClick={() => openEdit(emp)}>✏️ Edit</button>
                                                {emp.role !== 'owner' && (
                                                    <button className="staff-del-btn" onClick={() => handleDelete(emp._id)}>🗑️</button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* ══════════ LIVE ATTENDANCE TAB ══════════ */}
                {tab === 'live' && isManagerOrOwner && (
                    <>
                        {/* Summary */}
                        <div className="staff-summary-bar">
                            <div className="staff-summary-card">
                                <div className="staff-summary-label">👥 Checked In Today</div>
                                <div className="staff-summary-value">{uniqueToday}</div>
                            </div>
                            <div className="staff-summary-card">
                                <div className="staff-summary-label">🟢 Currently Active</div>
                                <div className="staff-summary-value green">{activeEmployees.length}</div>
                            </div>
                            <div className="staff-summary-card">
                                <div className="staff-summary-label">🕒 Total Hours Today</div>
                                <div className="staff-summary-value accent">{formatHours(totalHoursToday)}</div>
                            </div>
                        </div>

                        {/* Live cards */}
                        <div className="live-section-header">
                            <div className="live-pulse-dot" />
                            <span className="live-section-title">Live Status</span>
                        </div>

                        {activeEmployees.length === 0 ? (
                            <div className="staff-no-data">No staff are currently clocked in.</div>
                        ) : (
                            <div className="live-att-grid">
                                {activeEmployees.map(r => (
                                    <div key={r._id} className="live-att-card">
                                        <div className="live-att-top">
                                            <div className="live-att-avatar">
                                                {r.employeeId?.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="live-att-name">{r.employeeId?.name}</div>
                                                <div className="live-att-role">{r.employeeId?.role}</div>
                                            </div>
                                            <span className="live-badge-pill">LIVE</span>
                                        </div>
                                        <div className="live-att-stats">
                                            <div className="live-stat">
                                                <div className="live-stat-label">In Time</div>
                                                <div className="live-stat-value">
                                                    {new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="live-stat">
                                                <div className="live-stat-label">Duration</div>
                                                <div className="live-stat-value highlight">
                                                    {formatHours(calcLiveHours(r.checkInTime))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ══════════ HISTORY TAB ══════════ */}
                {tab === 'history' && isManagerOrOwner && (
                    <>
                        <div className="hist-filter-bar">
                            <span className="hist-filter-label">📋 Attendance History</span>
                            <input
                                type="date"
                                className="hist-date-input"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                            />
                        </div>

                        {loadingAtt ? (
                            <div className="staff-spinner">
                                <div className="staff-spin" />
                                <span>Loading…</span>
                            </div>
                        ) : (
                            <div className="hist-list">
                                {historyRecords.length === 0 ? (
                                    <div className="staff-no-data">No attendance records for this date.</div>
                                ) : historyRecords.map(r => {
                                    const hasActive = r.sessions?.some(s => s.status === 'active')
                                    const firstIn = r.sessions?.reduce((min, s) => (!min || new Date(s.checkInTime) < new Date(min)) ? s.checkInTime : min, null)
                                    const lastOut = r.sessions?.every(s => s.checkOutTime)
                                        ? r.sessions?.reduce((max, s) => (!max || new Date(s.checkOutTime) > new Date(max)) ? s.checkOutTime : max, null)
                                        : null

                                    return (
                                        <div key={r._id?.employeeId + (r.date || Math.random())} className="hist-row">
                                            <div className="hist-row-left">
                                                <div className="hist-avatar">{r.employeeId?.name?.[0]?.toUpperCase()}</div>
                                                <div>
                                                    <div className="hist-name">{r.employeeId?.name}</div>
                                                    <div className="hist-role">{r.employeeId?.role}</div>
                                                </div>
                                            </div>
                                            <div className="hist-row-right">
                                                <div>
                                                    <div className="hist-time-range">
                                                        {firstIn ? new Date(firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        {lastOut
                                                            ? ` → ${new Date(lastOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                            : hasActive ? ' → Now' : ''}
                                                    </div>
                                                    <div className="hist-hours">
                                                        {r.totalHours > 0 ? formatHours(r.totalHours) : hasActive ? 'Active…' : '—'}
                                                    </div>
                                                </div>
                                                <span className={`hist-status-badge ${hasActive ? 'active' : 'offline'}`}>
                                                    {hasActive ? 'Active' : 'Done'}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ══════════ REVIEWS MODAL (Wide 3-pane) ══════════ */}
            {reviewsEmp && (() => {
                const perf = perfMap[String(reviewsEmp._id)] || {}
                const avg = perf.averageRating || 0
                const total = perf.totalCompleted || 0
                const reviews = perf.recentFeedback || []
                const history = perf.history || []
                const fullStars = Math.round(avg)

                return (
                    <div className="staff-modal-overlay" onClick={() => { setReviewsEmp(null); setSelectedRevOrder(null); }}>
                        <div className="staff-modal staff-reviews-modal" style={{ maxWidth: '90vw', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div className="staff-modal-header" style={{ flexShrink: 0 }}>
                                <h2>⭐ Performance & Order History</h2>
                                <button className="staff-modal-close" onClick={() => { setReviewsEmp(null); setSelectedRevOrder(null); }}>✕</button>
                            </div>
                            <div className="staff-modal-body" style={{ flex: 1, padding: 0, display: 'flex', overflow: 'hidden' }}>

                                {/* ── PANE 1: Profile & Reviews (Left) ── */}
                                <div style={{ width: '30%', minWidth: '300px', borderRight: '1px solid var(--border)', padding: '24px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                                    <div className="rev-staff-identity">
                                        <div className="rev-staff-avatar">{reviewsEmp.name?.charAt(0)?.toUpperCase()}</div>
                                        <div>
                                            <div className="rev-staff-name">{reviewsEmp.name}</div>
                                            <span className={`staff-role-badge ${reviewsEmp.role}`} style={{ marginTop: 4 }}>
                                                {ROLE_ICONS[reviewsEmp.role]} {reviewsEmp.role?.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rev-summary-row">
                                        <div className="rev-summary-card">
                                            <div className="rev-big-rating">{avg > 0 ? avg.toFixed(1) : '—'}</div>
                                            <div className="rev-stars">
                                                {[1, 2, 3, 4, 5].map(s => <span key={s} className={`rev-star${s <= fullStars ? ' filled' : ''}`}>★</span>)}
                                            </div>
                                            <div className="rev-label">Avg Rating</div>
                                        </div>
                                        <div className="rev-summary-card">
                                            <div className="rev-big-rating" style={{ color: 'var(--accent)' }}>{total}</div>
                                            <div className="rev-label">Completed</div>
                                        </div>
                                        <div className="rev-summary-card">
                                            <div className="rev-big-rating" style={{ color: '#22c55e' }}>{reviews.length}</div>
                                            <div className="rev-label">Reviews</div>
                                        </div>
                                    </div>
                                    <div className="rev-section-title">💬 Customer Comments</div>
                                    {reviews.length === 0 ? (
                                        <div className="rev-empty" style={{ padding: '20px' }}>
                                            <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                                            <div>No written reviews.</div>
                                        </div>
                                    ) : (
                                        <div className="rev-list">
                                            {reviews.map((fb, idx) => (
                                                <div key={idx} className="rev-card">
                                                    <div className="rev-card-top">
                                                        <div className="rev-card-stars">
                                                            {[1, 2, 3, 4, 5].map(s => <span key={s} className={`rev-star${s <= (fb.rating || 0) ? ' filled' : ''}`}>★</span>)}
                                                        </div>
                                                        <div className="rev-card-date">{new Date(fb.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</div>
                                                    </div>
                                                    <p className="rev-card-text">"{fb.feedback}"</p>
                                                    <div className="rev-card-order">Bill #{fb.orderNumber || fb.orderId}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* ── PANE 2: Order History List (Middle) ── */}
                                <div style={{ width: '32%', minWidth: '320px', borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                                    <div style={{ padding: '16px', position: 'sticky', top: 0, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
                                        <div className="rev-section-title" style={{ margin: 0 }}>📜 Order History (Last 50)</div>
                                    </div>
                                    {history.length === 0 ? (
                                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                                            <p>No orders managed by this staff member yet.</p>
                                        </div>
                                    ) : (
                                        <div>
                                            {history.map((order, i) => (
                                                <div
                                                    key={order.id || i}
                                                    onClick={() => setSelectedRevOrder(order)}
                                                    style={{
                                                        padding: '16px',
                                                        borderBottom: '1px solid var(--border)',
                                                        cursor: 'pointer',
                                                        background: selectedRevOrder?.id === order.id ? 'var(--bg-hover)' : 'transparent',
                                                        borderLeft: selectedRevOrder?.id === order.id ? '4px solid var(--accent)' : '4px solid transparent',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <strong style={{ color: 'var(--text-primary)' }}>#{order.orderNumber || order.id}</strong>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#22c55e' }}>₹{(order.total || 0).toFixed(2)}</span>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold',
                                                            background: order.paymentStatus === 'PAID' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                            color: order.paymentStatus === 'PAID' ? '#22c55e' : '#ef4444'
                                                        }}>
                                                            {order.paymentStatus || 'UNKNOWN'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                                        Table: {order.tableNumber || 'N/A'} • {order.items?.length || 0} items
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* ── PANE 3: Order Details (Right) ── */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg-secondary)' }}>
                                    {selectedRevOrder ? (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                                                <div>
                                                    <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: 'var(--text-primary)' }}>Order #{selectedRevOrder.orderNumber || selectedRevOrder.id}</h2>
                                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Placed on {new Date(selectedRevOrder.createdAt).toLocaleString()}</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#22c55e' }}>₹{(selectedRevOrder.total || 0).toFixed(2)}</h2>
                                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Type: {selectedRevOrder.orderType.replace('_', ' ')}</p>
                                                </div>
                                            </div>

                                            <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Items Processed</h4>
                                            <div className="premium-table-wrapper" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                                <table className="premium-table" style={{ margin: 0 }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Item Name</th>
                                                            <th>Price</th>
                                                            <th>Qty</th>
                                                            <th style={{ textAlign: 'right' }}>Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedRevOrder.items && selectedRevOrder.items.length > 0 ? (
                                                            selectedRevOrder.items.map((item, idx) => (
                                                                <tr key={idx}>
                                                                    <td>
                                                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>{item.name}</span>
                                                                        {item.notes && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note: {item.notes}</span>}
                                                                        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 'bold' }}> {item.status}</span>
                                                                    </td>
                                                                    <td>₹{(item.price || 0).toFixed(2)}</td>
                                                                    <td><span style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>x{item.quantity}</span></td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--text-primary)' }}>₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No items found for this order.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div style={{ marginTop: '20px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                                    <span>Subtotal</span>
                                                    <span>₹{(selectedRevOrder.subtotal || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                                    <span>Tax Amount</span>
                                                    <span>₹{(selectedRevOrder.taxAmount || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                    <span>Grand Total</span>
                                                    <span>₹{(selectedRevOrder.total || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🧾</div>
                                            <h3>Select an Order</h3>
                                            <p style={{ textAlign: 'center', maxWidth: 300 }}>Click on an order from the middle pane to view its detailed receipt and products.</p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* ══════════ EDIT/ADD MODAL ══════════ */}
            {showModal && (
                <div className="staff-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="staff-modal" onClick={e => e.stopPropagation()}>
                        <div className="staff-modal-header">
                            <h2>{isEditing ? '✏️ Edit Staff' : '+ Add New Staff'}</h2>
                            <button className="staff-modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="staff-modal-body">
                            <div className="staff-form-group">
                                <label>Full Name</label>
                                <input type="text" required placeholder="e.g. Ravi Kumar" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="staff-form-group">
                                <label>Email (Login ID)</label>
                                <input type="email" required placeholder="email@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="staff-form-group">
                                <label>Password {isEditing && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(leave blank to keep current)</span>}</label>
                                <input type="text" required={!isEditing} placeholder={isEditing ? '••••••••' : 'Set a password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div className="staff-form-group">
                                <label>Role</label>
                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    {roleOptions.map(r => (
                                        <option key={r} value={r}>{ROLE_ICONS[r]} {r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            {formData.role === 'waiter' && (
                                <div className="staff-form-group">
                                    <label>Assigned Tables</label>
                                    <div className="staff-table-grid">
                                        {(() => {
                                            const otherTaken = employees
                                                .filter(e => e._id !== formData._id)
                                                .flatMap(e => e.assignedTables || [])
                                            return Array.from({ length: totalTables }, (_, i) => String(i + 1)).map(t => {
                                                const sel = formData.assignedTables.includes(t)
                                                const taken = otherTaken.includes(t)
                                                return (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        disabled={taken}
                                                        className={`table-pick-btn${sel ? ' active' : ''}${taken ? ' taken' : ''}`}
                                                        title={taken ? 'Already assigned' : `Table ${t}`}
                                                        onClick={() => {
                                                            const cur = formData.assignedTables
                                                            setFormData({ ...formData, assignedTables: sel ? cur.filter(x => x !== t) : [...cur, t] })
                                                        }}
                                                    >
                                                        {t}
                                                    </button>
                                                )
                                            })
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div className="staff-modal-actions">
                                <button type="button" className="staff-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="staff-save-btn" disabled={saving}>
                                    {saving ? 'Saving…' : isEditing ? '✓ Save Changes' : '+ Add Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
