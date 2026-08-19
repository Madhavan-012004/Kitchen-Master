import React, { useEffect, useState, useCallback } from 'react'
import { useMaintenance, parseServerDate } from '../context/MaintenanceContext.jsx'
import api from '../api/client.js'

export default function MaintenancePage() {
    const { maintenanceEndsAt, activeBanner: contextBanner, checkMaintenance } = useMaintenance()
    const [banner, setBanner] = useState(contextBanner)
    const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' })
    const [checking, setChecking] = useState(false)
    const [progress, setProgress] = useState(50)

    useEffect(() => {
        if (contextBanner) {
            setBanner(contextBanner)
        }
    }, [contextBanner])

    const checkActiveStatus = useCallback(async () => {
        setChecking(true)
        try {
            const res = await api.get('/master/banners/active')
            if (res.data?.data) {
                setBanner(res.data.data)
                setChecking(false)
                checkMaintenance()
                return
            }
        } catch (err) {
            console.warn('[MaintenancePage] API banner check failed:', err)
        }
        setChecking(false)
        checkMaintenance()
    }, [checkMaintenance])

    useEffect(() => {
        checkActiveStatus()
    }, [])

    // Countdown calculation with parseServerDate support for Jackson dates
    useEffect(() => {
        const rawEndsAt = maintenanceEndsAt || (banner?.toTime ? parseServerDate(banner.toTime) : null)
        const rawStartsAt = banner?.fromTime ? parseServerDate(banner.fromTime) : null

        // If no endsAt available yet, provide a fallback 1 hour window from now so timer never breaks
        const endsAt = rawEndsAt || new Date(Date.now() + 60 * 60 * 1000)
        const startsAt = rawStartsAt || new Date(endsAt.getTime() - 60 * 60 * 1000)

        let hasFiredCheck = false

        const updateTimer = () => {
            const now = new Date()
            const diff = endsAt.getTime() - now.getTime()

            if (diff <= 0) {
                setTimeLeft({ hours: '00', minutes: '00', seconds: '00' })
                setProgress(100)
                if (!hasFiredCheck) {
                    hasFiredCheck = true
                    checkMaintenance()
                }
            } else {
                const totalDuration = Math.max(1000, endsAt.getTime() - startsAt.getTime())
                const elapsed = totalDuration - diff
                setProgress(Math.min(99, Math.max(5, Math.round((elapsed / totalDuration) * 100))))

                const hours = Math.floor(diff / (1000 * 60 * 60))
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                const seconds = Math.floor((diff % (1000 * 60)) / 1000)
                setTimeLeft({
                    hours: String(hours).padStart(2, '0'),
                    minutes: String(minutes).padStart(2, '0'),
                    seconds: String(seconds).padStart(2, '0')
                })
            }
        }

        updateTimer()
        const timer = setInterval(updateTimer, 1000)
        return () => clearInterval(timer)
    }, [maintenanceEndsAt, banner, checkMaintenance])

    const activeBannerData = banner || contextBanner || {
        title: 'System Under Maintenance',
        message: 'We are upgrading the ProBloom infrastructure. All terminals will automatically resume shortly.'
    }

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            background: 'linear-gradient(145deg, #f8faff 0%, #eef2ff 40%, #f0f9ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            padding: '24px',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Subtle decorative background circles */}
            <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Card */}
            <div style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '48px 44px 40px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 60px -10px rgba(99,102,241,0.12), 0 0 0 1px rgba(99,102,241,0.08)',
                textAlign: 'center',
                maxWidth: '600px',
                width: '100%',
                position: 'relative',
                zIndex: 1
            }}>

                {/* Top bar accent */}
                <div style={{
                    position: 'absolute', top: 0, left: '10%', right: '10%', height: '3px',
                    background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                    borderRadius: '0 0 6px 6px'
                }} />

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    background: '#fef9ec', border: '1px solid #fcd34d',
                    padding: '5px 14px', borderRadius: '30px',
                    color: '#92400e', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '28px'
                }}>
                    <span style={{
                        width: 7, height: 7, borderRadius: '50%', background: '#f59e0b',
                        animation: 'pulse-amber 1.8s ease-in-out infinite'
                    }} />
                    Scheduled Maintenance
                </div>

                {/* Icon */}
                <div style={{
                    width: '72px', height: '72px', borderRadius: '18px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.28)'
                }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                {/* ProBloom wordmark */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                    ProBloom
                </div>

                {/* Title */}
                <h1 style={{
                    color: '#0f172a', fontSize: '26px', fontWeight: 800,
                    margin: '0 0 12px', letterSpacing: '-0.5px', lineHeight: 1.3
                }}>
                    {activeBannerData.title}
                </h1>

                {/* Message */}
                <p style={{
                    color: '#64748b', fontSize: '14.5px', lineHeight: '1.75',
                    margin: '0 0 32px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto'
                }}>
                    {activeBannerData.message}
                </p>

                {/* Divider */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)', marginBottom: '28px' }} />

                {/* Countdown label */}
                <div style={{
                    fontSize: '10.5px', fontWeight: 700, color: '#94a3b8',
                    letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '16px'
                }}>
                    Estimated Time Remaining
                </div>

                {/* Countdown digits */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '12px', marginBottom: '28px' }}>
                    {[
                        { label: 'HOURS', value: timeLeft.hours },
                        { label: 'MIN', value: timeLeft.minutes },
                        { label: 'SEC', value: timeLeft.seconds }
                    ].map((unit, idx) => (
                        <React.Fragment key={unit.label}>
                            {idx > 0 && (
                                <div style={{ fontSize: '28px', fontWeight: 300, color: '#cbd5e1', lineHeight: 1, paddingTop: '14px' }}>:</div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    minWidth: '68px',
                                    fontSize: '30px',
                                    fontWeight: 800,
                                    color: '#1e293b',
                                    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
                                    letterSpacing: '-1px',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                                }}>
                                    {unit.value}
                                </div>
                                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>
                                    {unit.label}
                                </span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Progress bar */}
                <div style={{
                    width: '100%', height: '5px',
                    background: '#f1f5f9',
                    borderRadius: '10px', overflow: 'hidden', marginBottom: '32px'
                }}>
                    <div style={{
                        width: `${progress}%`, height: '100%',
                        background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                        borderRadius: '10px',
                        transition: 'width 1s linear'
                    }} />
                </div>

                {/* Info cards row */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
                    {[
                        { icon: '🔒', label: 'Your data is safe', sub: 'All records secured' },
                        { icon: '⚡', label: 'Auto-resume', sub: 'No action needed' },
                        { icon: '📡', label: 'Checking every 30s', sub: 'Live status updates' }
                    ].map(card => (
                        <div key={card.label} style={{
                            flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                            borderRadius: '12px', padding: '14px 10px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{card.icon}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>{card.label}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{card.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={checkActiveStatus}
                        disabled={checking}
                        style={{
                            background: checking ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                            color: checking ? '#94a3b8' : '#fff',
                            border: 'none',
                            padding: '10px 22px',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: checking ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '7px',
                            transition: 'all 0.2s',
                            boxShadow: checking ? 'none' : '0 4px 14px rgba(99,102,241,0.3)'
                        }}
                    >
                        <span style={{ display: 'inline-block', animation: checking ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
                        {checking ? 'Checking...' : 'Check System Status'}
                    </button>
                    <button
                        onClick={() => { window.location.hash = '#/login?hq=override' }}
                        style={{
                            background: 'transparent', color: '#94a3b8',
                            border: '1px solid #e2e8f0',
                            padding: '10px 18px', borderRadius: '10px',
                            fontWeight: 500, fontSize: '12px', cursor: 'pointer'
                        }}
                    >
                        HQ Admin Access
                    </button>
                </div>

                {/* Footer */}
                <div style={{ marginTop: '24px', fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
                    ProBloom Cloud Operations · Infrastructure Core
                </div>
            </div>

            <style>{`
                @keyframes pulse-amber {
                    0%, 100% { opacity: 0.5; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
