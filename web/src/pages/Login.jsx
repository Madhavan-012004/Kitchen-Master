import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import './Login.css'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [coords, setCoords] = useState(null)
    const { login } = useAuth()
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
                (err) => console.log('Location access denied or unavailable'),
                { enableHighAccuracy: true }
            )
        }
    }, [])

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await api.post('/auth/login', {
                email,
                password,
                latitude: coords?.latitude,
                longitude: coords?.longitude
            })
            const { token, user } = res.data.data
            login(user, token)
            navigate('/pos')
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
                    <span className="login-logo-icon">🍳</span>
                    <div>
                        <h1 className="login-title">Kitchen Master</h1>
                        <p className="login-subtitle">Desktop POS Terminal</p>
                    </div>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="login-field">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="you@restaurant.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="login-error">⚠ {error}</div>}

                    <button className="login-btn" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>

                <p className="login-hint">Restaurant Management System v1.0</p>
            </div>
        </div>
    )
}
