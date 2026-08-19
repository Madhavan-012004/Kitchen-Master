import React, { useEffect, useRef, useState } from 'react'
import { useNetwork } from '../context/NetworkContext.jsx'
import './NetworkErrorOverlay.css'

const ERROR_META = {
    no_internet: {
        label: 'Backend Server Unreachable',
        icon: '🔌',
        tip: 'Cannot reach the ProBloom backend. Make sure the server is running on this machine.',
    },
    timeout: {
        label: 'Backend Not Responding',
        icon: '⏱️',
        tip: 'The backend server is taking too long to respond. It may be starting up or overloaded.',
    },
    server_down: {
        label: 'Backend Server Offline',
        icon: '🔧',
        tip: 'The ProBloom backend is not running. Please start the backend server and retry.',
    },
    server_error: {
        label: 'Backend API Error',
        icon: '⚠️',
        tip: 'The backend server responded with an error. Check the server logs for details.',
    },
}

const COUNTDOWN_START = 8

export default function NetworkErrorOverlay() {
    const { isOffline, errorType, statusCode, retryNow } = useNetwork()
    const [countdown, setCountdown] = useState(COUNTDOWN_START)
    const [isRetrying, setIsRetrying] = useState(false)
    const [visible, setVisible] = useState(false)
    const timerRef = useRef(null)

    // Animate in/out — ONLY show overlay on login page / when unauthenticated!
    // Once logged in, offline billing operates smoothly via OfflineSyncBadge without blocking UI.
    useEffect(() => {
        const path = window.location.hash?.replace('#', '') || window.location.pathname;
        const isLoginPage = path.includes('/login') || !localStorage.getItem('km_token');

        if (isOffline && isLoginPage) {
            setVisible(true);
            setCountdown(COUNTDOWN_START);
        } else {
            const t = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(t);
        }
    }, [isOffline]);

    // Auto-retry countdown
    useEffect(() => {
        if (!isOffline) return
        setCountdown(COUNTDOWN_START)
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleRetry()
                    return COUNTDOWN_START
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timerRef.current)
    }, [isOffline])

    const handleRetry = async () => {
        if (isRetrying) return
        setIsRetrying(true)
        clearInterval(timerRef.current)
        retryNow()
        await new Promise(r => setTimeout(r, 2000))
        setIsRetrying(false)
        setCountdown(COUNTDOWN_START)
    }

    if (!visible) return null

    const meta = ERROR_META[errorType] || ERROR_META.server_down
    const circumference = 2 * Math.PI * 28
    const dashOffset = circumference * (1 - countdown / COUNTDOWN_START)

    return (
        <div className={`neo-overlay ${isOffline ? 'neo-overlay--visible' : 'neo-overlay--hidden'}`}>
            {/* Animated bg particles */}
            <div className="neo-particles">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className={`neo-particle neo-particle--${i + 1}`} />
                ))}
            </div>

            <div className="neo-panel">
                {/* Top glow strip */}
                <div className="neo-glow-strip" />

                {/* Animated WiFi icon */}
                <div className="neo-icon-wrapper">
                    <div className="neo-icon-bg">
                        <svg className="neo-wifi-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* WiFi arcs */}
                            <path className="neo-arc neo-arc--1" d="M10 35 Q40 8 70 35" stroke="#C6F53D" strokeWidth="4" strokeLinecap="round" fill="none" />
                            <path className="neo-arc neo-arc--2" d="M20 46 Q40 25 60 46" stroke="#C6F53D" strokeWidth="4" strokeLinecap="round" fill="none" />
                            <path className="neo-arc neo-arc--3" d="M29 57 Q40 43 51 57" stroke="#C6F53D" strokeWidth="4" strokeLinecap="round" fill="none" />
                            {/* X mark */}
                            <circle cx="40" cy="68" r="4" fill="#C6F53D" />
                            {/* Slash */}
                            <line className="neo-slash" x1="18" y1="18" x2="62" y2="62" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="neo-pulse-ring" />
                    <div className="neo-pulse-ring neo-pulse-ring--2" />
                </div>

                {/* Status chip */}
                <div className="neo-status-chip">
                    <span className="neo-status-dot" />
                    <span>{meta.icon} {meta.label}</span>
                    {statusCode && <span className="neo-status-code">{statusCode}</span>}
                </div>

                {/* Headlines */}
                <h2 className="neo-title">Backend API Unreachable</h2>
                <p className="neo-subtitle">{meta.tip}</p>

                {/* Retry section */}
                <div className="neo-retry-wrapper">
                    <button
                        className={`neo-retry-btn ${isRetrying ? 'neo-retry-btn--loading' : ''}`}
                        onClick={handleRetry}
                        disabled={isRetrying}
                    >
                        {isRetrying ? (
                            <>
                                <span className="neo-spinner" />
                                Connecting…
                            </>
                        ) : (
                            <>
                                <svg className="neo-retry-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M4 12a8 8 0 0 1 14.93-4H16v2h6V4h-2v2.1A10 10 0 1 0 22 12h-2a8 8 0 0 1-16 0z" fill="currentColor" />
                                </svg>
                                Retry Now
                            </>
                        )}
                    </button>

                    {/* Countdown ring */}
                    {!isRetrying && (
                        <div className="neo-countdown" title={`Auto-retrying in ${countdown}s`}>
                            <svg viewBox="0 0 64 64" className="neo-countdown-svg">
                                <circle cx="32" cy="32" r="28" className="neo-countdown-track" />
                                <circle
                                    cx="32" cy="32" r="28"
                                    className="neo-countdown-progress"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                            <span className="neo-countdown-num">{countdown}</span>
                        </div>
                    )}
                </div>

                <p className="neo-auto-text">
                    Auto-retrying every {COUNTDOWN_START}s • Backend health check running…
                </p>

                {/* Bottom brand */}
                <div className="neo-brand">
                    <span className="neo-brand-dot" />
                    PROBLOOM
                    <span className="neo-brand-dot" />
                </div>
            </div>
        </div>
    )
}
