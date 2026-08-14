import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/client.js'

export default function MaintenancePage() {
    const navigate = useNavigate()
    const { logout } = useAuth()
    const [banner, setBanner] = useState(null)
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        // Fetch active banner immediately to get time limits
        api.get('/master/banners/active').then(res => {
            if (res.data.data) {
                setBanner(res.data.data)
            } else {
                // If there's no active banner, go back to login
                navigate('/login')
            }
        }).catch(err => {
            console.error(err)
        })

        const timer = setInterval(() => {
            if (banner && banner.toTime) {
                const now = new Date()
                const to = new Date(banner.toTime)
                if (now >= to) {
                    navigate('/login') // done with maintenance
                } else {
                    const diff = to - now
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
                    setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
                }
            }
        }, 1000)

        // Make sure user is logged out (so they can't access authenticated pages by going back)
        logout()

        return () => clearInterval(timer)
    }, [banner, navigate, logout])

    if (!banner) return (
        <div style={{ height: '100vh', width: '100vw', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="hq-spinner"></div>
        </div>
    )

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: 'linear-gradient(135deg, #09090b 0%, #1a1a2e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '3rem',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                textAlign: 'center',
                maxWidth: '600px',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '64px', height: '64px' }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>

                <h1 style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
                    {banner.title}
                </h1>

                <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                    {banner.message}
                </p>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <p style={{ color: '#fcd34d', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Estimated Time to Resolution
                    </p>
                    <div style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {timeLeft || 'Calculating...'}
                    </div>
                </div>

                <div style={{ marginTop: '2.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                    Thank you for your patience. <br /> ProBloom Cloud Infrastructure Team
                </div>
            </div>
        </div>
    )
}
