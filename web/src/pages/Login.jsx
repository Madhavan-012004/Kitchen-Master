import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useNavigate } from 'react-router-dom'
import './Login.css'

import logo from '../assets/LOGO.jpeg'

export default function LoginPage() {
    // Form states
    const [loginId, setLoginId] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [coords, setCoords] = useState(null)
    
    const { login } = useAuth()
    const { setSupermarketMode } = usePOSMode()
    const navigate = useNavigate()

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    })
                },
                (err) => {
                    console.log('Location access denied or unavailable', err);
                    if (err.code === 1) { // PERMISSION_DENIED
                        setError('Location permission is blocked. Please enable it in browser settings to continue.');
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            )
        }
    }, [])

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        
        try {
            const isEmail = loginId.includes('@')
            
            if (isEmail) {
                const res = await api.post('/auth/login', {
                    email: loginId.trim(),
                    password,
                    latitude: coords?.latitude,
                    longitude: coords?.longitude
                })
                const { token, user } = res.data.data
                login(user, token)
                
                // Set POS mode preference
                setSupermarketMode(user.preferredPosMode === 'supermarket')

                if (user.isProBloomAdmin) {
                    navigate('/probloom-hq')
                } else {
                    navigate('/pos')
                }
            } else {
                // Stakeholder Login with Phone
                const res = await api.post('/stakeholder/login', {
                    phone: loginId.trim(),
                    password
                })
                const { token, user } = res.data.data
                login(user, token)
                navigate('/analytics') // Stakeholders always go to analytics first
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Check credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg" />
            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <img src={logo} alt="ProBloom Logo" className="login-logo-img" />
                    </div>
                    <div>
                        <h1 className="login-title"><span style={{color: 'var(--accent)'}}>P</span>ro<span style={{color: 'var(--accent)'}}>B</span>loom</h1>
                        <p className="login-subtitle">Desktop POS Terminal</p>
                    </div>
                </div>

                <form className="login-form" onSubmit={handleLogin} style={{ marginTop: '20px' }}>
                    <div className="login-field">
                        <label>Email Address or Phone Number</label>
                        <input
                            type="text"
                            placeholder="you@restaurant.com or +1234567890"
                            value={loginId}
                            onChange={e => setLoginId(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label>Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button 
                                type="button" 
                                className="password-toggle" 
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88L3 3M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M9.91 9.91L14.09 14.09M14.59 14.59L12 12"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && <div className="login-error">⚠ {error}</div>}

                    <button className="login-btn" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>

                <p className="login-hint">Billing Management System v1.0</p>
            </div>
        </div>
    )
}
