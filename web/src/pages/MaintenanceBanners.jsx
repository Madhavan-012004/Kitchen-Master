import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useTheme } from '../context/ThemeContext.jsx'
import './MasterBackoffice.css'

export default function MaintenanceBanners() {
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()
    const [banners, setBanners] = useState([])
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({
        title: 'System Under Maintenance',
        message: 'We are currently upgrading the ProBloom cluster for better performance.',
        fromTime: '',
        toTime: '',
        isActive: true
    })

    const fetchBanners = async () => {
        setLoading(true)
        try {
            const res = await api.get('/master/banners')
            if (res.data?.data && Array.isArray(res.data.data)) {
                setBanners(res.data.data)
                localStorage.setItem('master_maintenance_banners', JSON.stringify(res.data.data))
            } else {
                const local = JSON.parse(localStorage.getItem('master_maintenance_banners') || '[]')
                setBanners(local)
            }
        } catch (err) {
            console.warn('Failed to load banners from server, using local cache', err)
            const local = JSON.parse(localStorage.getItem('master_maintenance_banners') || '[]')
            setBanners(local)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBanners()
    }, [])

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setFormData(prev => ({ ...prev, [e.target.name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const newBanner = {
            id: Date.now(),
            title: formData.title,
            message: formData.message,
            fromTime: formData.fromTime,
            toTime: formData.toTime,
            isActive: formData.isActive,
            createdAt: new Date().toISOString()
        }

        // Always save locally first so it immediately works in JS
        const currentLocal = JSON.parse(localStorage.getItem('master_maintenance_banners') || '[]')
        const updatedLocal = [newBanner, ...currentLocal]
        localStorage.setItem('master_maintenance_banners', JSON.stringify(updatedLocal))
        window.dispatchEvent(new Event('maintenance-updated'))

        try {
            await api.post('/master/banners', formData)
        } catch (err) {
            console.warn('Backend banner sync failed, saved locally in JS:', err)
        }

        setFormData({ ...formData, fromTime: '', toTime: '' })
        alert('✓ Incident banner published successfully!')
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this banner schedule?')) return
        const currentLocal = JSON.parse(localStorage.getItem('master_maintenance_banners') || '[]')
        const updatedLocal = currentLocal.filter(b => b.id !== id)
        localStorage.setItem('master_maintenance_banners', JSON.stringify(updatedLocal))
        setBanners(updatedLocal)

        window.dispatchEvent(new Event('maintenance-updated'))

        try {
            await api.delete(`/master/banners/${id}`)
        } catch (err) {
            console.warn('Backend banner delete failed, updated locally in JS:', err)
        }
    }

    return (
        <div className="hq-layout">
            <div className="hq-ambient-glow hq-ambient-1"></div>
            <div className="hq-ambient-glow hq-ambient-2"></div>

            <nav className="hq-navbar">
                <div className="hq-brand" onClick={() => navigate('/probloom-hq')} style={{ cursor: 'pointer' }}>
                    <div className="hq-logo-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                    </div>
                    <div className="hq-brand-text">
                        <span className="hq-brand-title">ProBloom<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '300' }}>HQ</span></span>
                        <span className="hq-brand-subtitle">Maintenance Control Center</span>
                    </div>
                </div>
                <div className="hq-nav-actions">
                    <button className="hq-btn hq-btn-outline" onClick={() => navigate('/probloom-hq')}>
                        ← Back to HQ Cluster
                    </button>
                    <button className="hq-logout-icon-btn" onClick={toggleTheme}>
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
            </nav>

            <main className="hq-main">
                <div className="hq-metrics-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                    <form onSubmit={handleSubmit} style={{ background: 'rgba(24, 24, 27, 0.7)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'white' }}>Schedule Network Downtime</h3>
                        <div className="hq-details-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Display Title</label>
                                <input type="text" name="title" required value={formData.title} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Message Subtitle</label>
                                <input type="text" name="message" required value={formData.message} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Downtime Start Window</label>
                                <input type="datetime-local" name="fromTime" required value={formData.fromTime} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'block' }}>Tenants will be blocked from logging in during this time.</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Expected Resume Window</label>
                                <input type="datetime-local" name="toTime" required value={formData.toTime} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} style={{ width: '1.25rem', height: '1.25rem' }} />
                            <label style={{ color: 'white', fontSize: '0.9rem' }}>Banner Enabled (Unchecking will bypass this timeframe)</label>
                        </div>
                        <button type="submit" className="hq-btn hq-btn-glow hq-btn-digital" style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', fontSize: '1rem' }}>
                            Publish Incident
                        </button>
                    </form>
                </div>

                <h3 style={{ color: 'white', marginBottom: '1rem' }}>Scheduled Exclusions</h3>
                <div className="hq-table-container">
                    {loading ? (
                        <div className="hq-empty-state"><div className="hq-spinner"></div><p>Fetching scheduled windows...</p></div>
                    ) : banners.length === 0 ? (
                        <div className="hq-empty-state"><p>No maintenance windows have been scheduled.</p></div>
                    ) : (
                        <table className="hq-data-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Title</th>
                                    <th>Offline Commences</th>
                                    <th>Online ETA</th>
                                    <th className="text-right">Overrides</th>
                                </tr>
                            </thead>
                            <tbody>
                                {banners.map(b => (
                                    <tr key={b.id} className={!b.isActive ? 'hq-row-suspended' : ''}>
                                        <td>{b.isActive ? <span className="hq-badge hq-badge-active">Armed</span> : <span className="hq-badge hq-badge-inactive">Disarmed</span>}</td>
                                        <td>
                                            <div className="hq-tenant-cell">
                                                <div className="hq-tenant-name">{b.title}</div>
                                                <div className="hq-tenant-sub">{b.message}</div>
                                            </div>
                                        </td>
                                        <td>{new Date(b.fromTime).toLocaleString()}</td>
                                        <td>{new Date(b.toTime).toLocaleString()}</td>
                                        <td className="text-right">
                                            <button className="hq-act-btn hq-btn-delete" onClick={() => handleDelete(b.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    )
}
