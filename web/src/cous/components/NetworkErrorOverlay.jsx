import React, { useEffect, useRef, useState } from 'react';
import './NetworkErrorOverlay.css';

const ERROR_META = {
    no_internet: {
        label: 'No Internet Connection',
        emoji: '📵',
        tip: 'Please check your Wi-Fi or mobile data. We can\'t reach the Kitchen API.',
    },
    timeout: {
        label: 'Connection Timed Out',
        emoji: '⏱️',
        tip: 'The Kitchen API is taking too long to respond. Retrying…',
    },
    server_down: {
        label: 'Kitchen API Offline',
        emoji: '🔧',
        tip: 'Attempting to reach the PROBLOOM backend. It might be restarting.',
    },
    server_error: {
        label: 'Kitchen API Error',
        emoji: '⚠️',
        tip: 'The server is up but returned an error. We are trying to reconnect…',
    },
};

const COUNTDOWN_START = 8;

export default function NetworkErrorOverlay({ isOffline, errorType, statusCode, retryNow }) {
    const [countdown, setCountdown] = useState(COUNTDOWN_START);
    const [isRetrying, setIsRetrying] = useState(false);
    const [show, setShow] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        if (isOffline) {
            setShow(true);
            setCountdown(COUNTDOWN_START);
        } else {
            const t = setTimeout(() => setShow(false), 600);
            return () => clearTimeout(t);
        }
    }, [isOffline]);

    useEffect(() => {
        if (!isOffline) return;
        setCountdown(COUNTDOWN_START);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleRetry();
                    return COUNTDOWN_START;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [isOffline]);

    const handleRetry = async () => {
        if (isRetrying) return;
        setIsRetrying(true);
        clearInterval(timerRef.current);
        retryNow();
        await new Promise(r => setTimeout(r, 2000));
        setIsRetrying(false);
        setCountdown(COUNTDOWN_START);
    };

    if (!show) return null;

    const meta = ERROR_META[errorType] || ERROR_META.server_down;
    const circumference = 2 * Math.PI * 26;
    const dashOffset = circumference * (1 - countdown / COUNTDOWN_START);

    return (
        <div className={`cw-overlay ${isOffline ? 'cw-overlay--in' : 'cw-overlay--out'}`}>
            {/* Floating food particles */}
            <div className="cw-floaties">
                {['🍕', '🍜', '🍣', '🥗', '🍔', '🌮'].map((f, i) => (
                    <span key={i} className={`cw-floaty cw-floaty--${i + 1}`}>{f}</span>
                ))}
            </div>

            <div className="cw-panel">
                <div className="cw-panel-glow" />

                {/* Icon */}
                <div className="cw-icon-area">
                    <div className="cw-icon-ring">
                        <svg className="cw-wifi-svg" viewBox="0 0 80 80" fill="none">
                            <path d="M10 33 Q40 6 70 33" stroke="#FF4D4D" strokeWidth="4" strokeLinecap="round" fill="none" className="cw-arc cw-arc--1"/>
                            <path d="M20 45 Q40 22 60 45" stroke="#FF4D4D" strokeWidth="4" strokeLinecap="round" fill="none" className="cw-arc cw-arc--2"/>
                            <path d="M30 57 Q40 42 50 57" stroke="#FF4D4D" strokeWidth="4" strokeLinecap="round" fill="none" className="cw-arc cw-arc--3"/>
                            <circle cx="40" cy="67" r="4" fill="#FF4D4D" />
                            <line x1="20" y1="20" x2="60" y2="60" stroke="rgba(255,77,77,0.4)" strokeWidth="5" strokeLinecap="round" className="cw-xline"/>
                        </svg>
                        <div className="cw-ring-pulse" />
                    </div>
                </div>

                {/* Error badge */}
                <div className="cw-badge">
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                    {statusCode && <span className="cw-badge-code">{statusCode}</span>}
                </div>

                {/* Text */}
                <h2 className="cw-title">{meta.label}</h2>
                <p className="cw-tip">{meta.tip}</p>

                {/* Retry */}
                <div className="cw-retry-row">
                    <button
                        className={`cw-retry-btn ${isRetrying ? 'cw-retry-btn--spin' : ''}`}
                        onClick={handleRetry}
                        disabled={isRetrying}
                    >
                        {isRetrying ? (
                            <><span className="cw-btn-spinner" /> Fetching API…</>
                        ) : (
                            <><span className="cw-retry-arrow">↺</span> Retry Connection</>
                        )}
                    </button>

                    {!isRetrying && (
                        <div className="cw-cd-wrap">
                            <svg viewBox="0 0 60 60">
                                <circle cx="30" cy="30" r="26" className="cw-cd-track"/>
                                <circle
                                    cx="30" cy="30" r="26"
                                    className="cw-cd-ring"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                            <span className="cw-cd-num">{countdown}</span>
                        </div>
                    )}
                </div>

                <p className="cw-auto-note">Fetching backend API every {COUNTDOWN_START}s…</p>

                <div className="cw-brand">
                    <span>🍽️</span> PROBLOOM
                </div>
            </div>
        </div>
    );
}
