import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs'
import './Simple.css'

export default function AttendancePage() {
    const { user } = useAuth()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager'

    const [activeEmployees, setActiveEmployees] = useState([])
    const [history, setHistory] = useState([])
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true)
        try {
            const [activeRes, historyRes] = await Promise.all([
                api.get('/attendance/active'),
                api.get(`/attendance?date=${filterDate}`)
            ])
            setActiveEmployees(activeRes.data.data?.active || [])
            setHistory(historyRes.data.data?.records || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { 
        fetchData() 
        const interval = setInterval(() => fetchData(true), 5000) // Auto-refresh every 5 seconds (silent)
        return () => clearInterval(interval)
    }, [filterDate])

    if (!isManagerOrOwner) return (
        <div className="simple-page">
            <div className="loading">Access restricted to managers and owners.</div>
        </div>
    )

    const formatHours = (hours) => {
        const h = Math.floor(hours)
        const m = Math.round((hours - h) * 60)
        return `${h}h ${m}m`
    }

    const calculateLiveHours = (checkInTime) => {
        const diffMs = new Date() - new Date(checkInTime)
        return parseFloat((diffMs / 3600000).toFixed(2))
    }

    const statusColor = (status) => ({
        active: '#22c55e',
        completed: '#3b82f6',
        disconnected: '#ef4444'
    }[status] || '#94a3b8')

    return (
        <div className="simple-page">
            <StakeholderRestaurantTabs />
            {/* Header */}
            <div className="simple-header">
                <div>
                    <h1 className="page-title">Attendance</h1>
                    <span className="page-count">{activeEmployees.length} currently working</span>
                </div>
                <button className="add-btn" onClick={fetchData}>↻ Refresh</button>
            </div>

            <div className="attendance-summary-bar">
                <div className="summary-card">
                    <div className="summary-label">👥 Checked In Today</div>
                    <div className="summary-value">{[...new Set([...activeEmployees, ...history].map(r => r.employeeId?._id))].length}</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">🕒 Total Hours (Today)</div>
                    <div className="summary-value">{formatHours(history.reduce((sum, r) => sum + r.totalHours, 0))}</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">🟢 Currently Active</div>
                    <div className="summary-value accent">{activeEmployees.length}</div>
                </div>
            </div>

            {loading ? <div className="loading">Loading...</div> : (
                <>
                    {/* Currently Working */}
                    <div style={{ marginBottom: 24 }}>
                        <div className="section-header">
                            <h2 className="section-title">🟢 Live Status</h2>
                            <div className="live-pulse"></div>
                        </div>
                        {activeEmployees.length === 0
                            ? <div className="no-data-card">No employees are currently clocked in.</div>
                            : <div className="active-grid">
                                {activeEmployees.map(r => (
                                    <div key={r._id} className="active-card">
                                        <div className="active-card-top">
                                            <div className="emp-avatar large">{r.employeeId?.name?.[0]?.toUpperCase()}</div>
                                            <div className="active-info">
                                                <div className="active-name">{r.employeeId?.name}</div>
                                                <div className="active-role">{r.employeeId?.role}</div>
                                            </div>
                                            <div className="live-badge">Live</div>
                                        </div>
                                        <div className="active-stats">
                                            <div className="stat-item">
                                                <div className="stat-label">In Time</div>
                                                <div className="stat-value">{new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            <div className="stat-item">
                                                <div className="stat-label">Duration</div>
                                                <div className="stat-value highlight">{formatHours(calculateLiveHours(r.checkInTime))}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        }
                    </div>

                    {/* Date Picker */}
                    <div className="simple-header" style={{ flexShrink: 0 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 Attendance History</h2>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
                        />
                    </div>

                    {/* History Records */}
                    <div className="orders-list">
                        {history.length === 0
                            ? <div className="order-row"><span className="order-items">No records for this date.</span></div>
                            : history.map(r => {
                                const hasActive = r.sessions?.some(s => s.status === 'active');
                                const sessionCount = r.sessions?.length || 0;
                                const firstIn = r.sessions?.reduce((min, s) => (!min || new Date(s.checkInTime) < new Date(min)) ? s.checkInTime : min, null);
                                const lastOut = r.sessions?.every(s => s.checkOutTime)
                                    ? r.sessions?.reduce((max, s) => (!max || new Date(s.checkOutTime) > new Date(max)) ? s.checkOutTime : max, null)
                                    : null;

                                return (
                                    <div key={r._id?.employeeId + (r.date || Math.random())} className="order-row">
                                        <div className="order-row-left">
                                            <div className="emp-avatar">{r.employeeId?.name?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <div className="order-table">{r.employeeId?.name}</div>
                                                <div className="order-items">
                                                    {r.employeeId?.role}
                                                    {sessionCount > 1 && <span style={{ marginLeft: 8, fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{sessionCount} sessions</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="order-row-right" style={{ gap: 16 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {firstIn ? new Date(firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    {lastOut ? ` — ${new Date(lastOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : (hasActive ? ' — Now' : '')}
                                                </div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                                                    {r.totalHours > 0 ? formatHours(r.totalHours) : (hasActive ? 'Calculating...' : '—')}
                                                </div>
                                            </div>
                                            <span className="role-badge" style={{
                                                background: `${statusColor(hasActive ? 'active' : 'completed')}22`,
                                                color: statusColor(hasActive ? 'active' : 'completed'),
                                                borderColor: `${statusColor(hasActive ? 'active' : 'completed')}66`,
                                                textTransform: 'capitalize'
                                            }}>
                                                {hasActive ? 'Active' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </>
            )}
        </div>
    )
}
