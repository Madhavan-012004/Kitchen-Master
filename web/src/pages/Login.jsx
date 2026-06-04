import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
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

    const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotOtp, setForgotOtp] = useState('')
    const [forgotNewPassword, setForgotNewPassword] = useState('')
    const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: OTP & Password
    const [licenseError, setLicenseError] = useState('')

    const { login } = useAuth()
    const { setSupermarketMode } = usePOSMode()
    const { theme, toggleTheme } = useTheme()
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
                    console.log('Location access denied or unavailable', err)
                    if (err.code === 1) { // PERMISSION_DENIED
                        setError('Location permission is blocked. Please enable it in browser settings to continue.')
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            )
        }

        // Fetch license status to see if it's missing/invalid
        api.get('/license/status')
            .then(res => {
                if (res.data && res.data.valid === false) {
                    setLicenseError(res.data.message || 'No valid license found.')
                }
            })
            .catch(err => {
                console.log('Failed to check license status', err)
            })
    }, [])

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (forgotStep === 1) {
                const res = await api.post('/auth/forgot-password', { email: forgotEmail })
                setForgotStep(2)
                alert(res.data.message)
            } else {
                const res = await api.post('/auth/reset-password-otp', {
                    email: forgotEmail,
                    otp: forgotOtp,
                    newPassword: forgotNewPassword
                })
                alert(res.data.message)
                setForgotPasswordMode(false)
                setForgotStep(1)
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed')
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await api.setConnectionMode('online')
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
            setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg" />

            <div className={`login-card ${!forgotPasswordMode ? 'offline-wide' : ''}`}>
                <div className="login-header-controls">
                    <div className="login-logo-mini">
                        <img src={logo} alt="ProBloom Logo" className="login-logo-img" />
                        <h1 className="login-title-mini">ProBloom</h1>
                    </div>

                    <button className="theme-toggle-compact" onClick={toggleTheme} title="Toggle Theme">
                        {theme === 'dark' ? (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        )}
                    </button>
                </div>

                {forgotPasswordMode ? (
                    <div className="forgot-password-container">
                        <form className="login-form" onSubmit={handleForgotPasswordSubmit}>
                            <h3 style={{marginBottom: '1rem'}}>Reset Password</h3>

                            <div className="login-field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="your-email@example.com"
                                    value={forgotEmail}
                                    onChange={e => setForgotEmail(e.target.value)}
                                    disabled={forgotStep === 2}
                                    required
                                />
                            </div>

                            {forgotStep === 2 && (
                                <>
                                    <div className="login-field">
                                        <label>Enter 6-Digit OTP</label>
                                        <input
                                            type="text"
                                            placeholder="123456"
                                            value={forgotOtp}
                                            onChange={e => setForgotOtp(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="login-field">
                                        <label>New Password</label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            {error && <div className="login-error">⚠ {error}</div>}

                            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                                <button type="button" className="login-btn" style={{background: 'var(--border)'}} onClick={() => {
                                    setForgotPasswordMode(false)
                                    setForgotStep(1)
                                    setError('')
                                }}>Cancel</button>
                                <button type="submit" className="login-btn" disabled={loading}>
                                    {loading ? 'Processing...' : forgotStep === 1 ? 'Send OTP' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="offline-split-view online-mode-view">
                        <div className="offline-request-view">
                            <div className="step-badge">Cloud Terminal</div>
                            <h3 className="login-view-title">Welcome Back</h3>
                            <p className="offline-prompt">Access your global restaurant cluster and synchronized billing data.</p>

                            {licenseError && (
                                <div 
                                    className="login-error" 
                                    style={{ 
                                        background: 'rgba(245, 158, 11, 0.1)', 
                                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                                        color: '#fb923c', 
                                        cursor: 'pointer',
                                        padding: '10px 14px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        marginBottom: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }} 
                                    onClick={() => navigate('/license')}
                                >
                                    <span>🔒 {licenseError} Click to upload license.</span>
                                </div>
                            )}

                            <form className="login-form" onSubmit={handleLogin}>
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
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <label>Password</label>
                                        <button
                                            type="button"
                                            onClick={() => setForgotPasswordMode(true)}
                                            className="text-btn"
                                            style={{fontSize: '0.8rem'}}
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
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
                                    {loading ? 'Signing in...' : 'Sign In to Cloud →'}
                                </button>
                            </form>
                        </div>

                        <div className="offline-connector">
                            <div className="connector-status-dot online"></div>
                        </div>

                        <div className="offline-upload-view online-info-panel">
                            <div className="cloud-status-badge">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
                                <span>Cloud Active</span>
                            </div>
                            <h3>ProBloom Cluster</h3>
                            <p className="offline-prompt">Your system is connected to the ProBloom Global Infrastructure. All transactions are backed up in real-time.</p>

                            <div className="online-features-list">
                                <div className="feature-item">
                                    <div className="feature-icon">✨</div>
                                    <div className="feature-text">AI Analytics Enabled</div>
                                </div>
                                <div className="feature-item">
                                    <div className="feature-icon">🛡️</div>
                                    <div className="feature-text">Enterprise Encryption</div>
                                </div>
                                <div className="feature-item">
                                    <div className="feature-icon">📡</div>
                                    <div className="feature-text">Multi-Device Sync</div>
                                </div>
                            </div>

                            <div className="offline-help-footer">
                                <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    <span>Version 2.4.0 (Enterprise)</span>
                                    <span style={{ opacity: 0.3 }}>•</span>
                                    <button 
                                        type="button" 
                                        className="text-btn" 
                                        onClick={() => navigate('/license')}
                                        style={{ 
                                            background: 'none', 
                                            border: 'none', 
                                            color: '#C6F53D', 
                                            cursor: 'pointer', 
                                            fontWeight: '600',
                                            padding: 0,
                                            textDecoration: 'underline',
                                            fontSize: '11px'
                                        }}
                                    >
                                        Upload License (.lic)
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <p className="login-hint">Billing Management System v1.0 • Secure Terminal</p>
            </div>
        </div>
    )
}
