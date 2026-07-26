import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import './MasterBackoffice.css'

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const Icons = {
    HQ: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    Cloud: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>,
    Key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    ArrowLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    AlertTriangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}

export default function ProBloomProvisionClient() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    
    // Validate type
    const initialType = searchParams.get('type') === 'prime' ? 'prime' : 'digital'
    const [type, setType] = useState(initialType)
    
    const [form, setForm] = useState({ name: '', email: '', password: '', restaurantName: '', phone: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const endpoint = type === 'prime' ? '/master/clients/prime' : '/master/clients/digital'
            const res = await api.post(endpoint, form)
            const data = res.data.data
            
            // Navigate back to HQ and pass the new data natively via router state
            // so we can show the "download license" modal instantly
            navigate('/probloom-hq', { 
                state: { 
                    newClientSuccess: true,
                    licenseData: data?.licenseKey ? { client: data.user, key: data.licenseKey } : null
                } 
            })
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to deploy client.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="hq-layout" style={{ pointerEvents: 'auto', userSelect: 'auto' }}>
            <div className="hq-ambient-glow hq-ambient-1"></div>
            <div className="hq-ambient-glow hq-ambient-2"></div>
            
            {/* ── Top Navbar ── */}
            <nav className="hq-navbar">
                <div className="hq-brand">
                    <div className="hq-logo-icon">{Icons.HQ}</div>
                    <div className="hq-brand-text">
                        <span className="hq-brand-title">ProBloom<span style={{color: 'rgba(255,255,255,0.4)', fontWeight: '300'}}>HQ</span></span>
                        <span className="hq-brand-subtitle">License Control Cluster</span>
                    </div>
                </div>
                <div className="hq-nav-actions">
                    <button className="hq-btn hq-btn-outline" onClick={() => navigate('/probloom-hq')}>
                        {Icons.ArrowLeft} Return to Dashboard
                    </button>
                </div>
            </nav>

            <main className="hq-main" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                
                <div style={{ width: '100%', maxWidth: '650px', background: 'var(--hq-card-bg)', backdropFilter: 'blur(24px)', border: '1px solid var(--hq-border)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
                    
                    {/* Header */}
                    <div style={{ padding: '2.5rem', borderBottom: '1px solid var(--hq-border)' }}>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '2rem' }}>
                            <button 
                                type="button" 
                                onClick={() => setType('digital')}
                                style={{
                                    flex: 1, padding: '15px', borderRadius: '14px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDir: 'column', alignItems: 'center', gap: '8px',
                                    background: type === 'digital' ? 'rgba(148, 163, 184, 0.15)' : 'var(--hq-input-bg)',
                                    borderColor: type === 'digital' ? 'var(--hq-primary)' : 'var(--hq-border)',
                                    color: type === 'digital' ? 'var(--hq-text-100)' : 'var(--hq-text-400)'
                                }}>
                                <div style={{ transform: 'scale(1.2)' }}>{Icons.Cloud}</div>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Cloud Build</span>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setType('prime')}
                                style={{
                                    flex: 1, padding: '15px', borderRadius: '14px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDir: 'column', alignItems: 'center', gap: '8px',
                                    background: type === 'prime' ? 'rgba(148, 163, 184, 0.15)' : 'var(--hq-input-bg)',
                                    borderColor: type === 'prime' ? 'var(--hq-primary)' : 'var(--hq-border)',
                                    color: type === 'prime' ? 'var(--hq-text-100)' : 'var(--hq-text-400)'
                                }}>
                                <div style={{ transform: 'scale(1.2)' }}>{Icons.Key}</div>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Onprime (Offline)</span>
                            </button>
                        </div>
                        
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Provision New Tenant
                        </h2>
                        <p style={{ color: 'var(--hq-text-400)', fontSize: '0.9rem', marginTop: '8px' }}>
                            Initialize a new {type === 'prime' ? 'locally-hosted Onprime' : 'cloud-hosted Cloud'} node on the cluster via an independent isolated network profile.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={submit} style={{ padding: '2.5rem', pointerEvents: 'auto', zIndex: 50, position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="hq-input-group">
                                <label>Restaurant Name</label>
                                <input name="restaurantName" required placeholder="e.g. Spice Garden" value={form.restaurantName} onChange={handle} autoFocus style={{ pointerEvents: 'auto', userSelect: 'auto' }} />
                            </div>
                            <div className="hq-input-group">
                                <label>Owner Contact Name</label>
                                <input name="name" required placeholder="e.g. Rahul Kumar" value={form.name} onChange={handle} style={{ pointerEvents: 'auto', userSelect: 'auto' }} />
                            </div>
                            <div className="hq-input-group">
                                <label>Master Email Address</label>
                                <input name="email" type="email" required placeholder="owner@restaurant.com" value={form.email} onChange={handle} style={{ pointerEvents: 'auto', userSelect: 'auto' }} />
                            </div>
                            <div className="hq-input-group">
                                <label>Vault Password</label>
                                <input name="password" type="password" required placeholder="••••••••" value={form.password} onChange={handle} style={{ pointerEvents: 'auto', userSelect: 'auto' }} />
                            </div>
                            <div className="hq-input-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Secure Comm Line (Phone)</label>
                                <input name="phone" placeholder="+91..." value={form.phone} onChange={handle} style={{ pointerEvents: 'auto', userSelect: 'auto' }} />
                            </div>
                        </div>

                        {error && (
                            <div className="hq-error-banner" style={{ marginTop: '2rem' }}>
                                {Icons.AlertTriangle} {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '15px', marginTop: '3rem' }}>
                            <button type="button" className="hq-btn hq-btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/probloom-hq')}>
                                Abort Deployment
                            </button>
                            <button type="submit" className={`hq-btn hq-btn-glow ${type === 'prime' ? 'hq-btn-prime' : 'hq-btn-digital'}`} style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
                                {loading ? 'Provisioning Sector...' : 'Launch Deployment'}
                            </button>
                        </div>
                    </form>

                </div>

                <div className="hq-footer-bar" style={{ marginTop: 'auto' }}>
                    <span className="hq-pulse-dot"></span> End-to-end encryption enforced
                </div>
            </main>
        </div>
    )
}
