import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import './Simple.css'

export default function AttendancePage() {
    const { user } = useAuth()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager'

    const [activeEmployees, setActiveEmployees] = useState([])
    const [history, setHistory] = useState([])
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        setLoading(true)
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

    useEffect(() => { fetchData() }, [filterDate])

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

    const statusColor = (status) => ({
        active: '#22c55e',
        completed: '#3b82f6',
        disconnected: '#ef4444'
    }[status] || '#94a3b8')

    return (
        <div className="simple-page">
            {/* Header */}
            <div className="simple-header">
                <div>
                    <h1 className="page-title">Attendance</h1>
                    <span className="page-count">{activeEmployees.length} currently working</span>
                </div>
                <button className="add-btn" onClick={fetchData}>↻ Refresh</button>
            </div>

            {loading ? <div className="loading">Loading...</div> : (
                <>
                    {/* Currently Working */}
                    <div style={{ marginBottom: 8 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🟢 Currently Working</h2>
                        {activeEmployees.length === 0
                            ? <div className="order-row"><span className="order-items">No employees are currently clocked in.</span></div>
                            : activeEmployees.map(r => (
                                <div key={r._id} className="order-row">
                                    <div className="order-row-left">
                                        <div className="emp-avatar">{r.employeeId?.name?.[0]?.toUpperCase()}</div>
                                        <div>
                                            <div className="order-table">{r.employeeId?.name}</div>
                                            <div className="order-items">{r.employeeId?.role} — checked in {new Date(r.checkInTime).toLocaleTimeString()}</div>
                                        </div>
                                    </div>
                                    <span className="role-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>Active</span>
                                </div>
                            ))
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
