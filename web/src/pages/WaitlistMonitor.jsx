import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import './WaitlistMonitor.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000; // HTTP polling fallback every 5s

export default function WaitlistMonitor() {
    const { restaurantId } = useParams();

    // ── State ────────────────────────────────────────────────────────────────
    const [queue, setQueue]               = useState([]);
    const [calledTokens, setCalledTokens] = useState([]);
    const [restaurant, setRestaurant]     = useState(null);   // public profile
    const [socketOk, setSocketOk]         = useState(false);  // live vs polling
    const [lastUpdated, setLastUpdated]   = useState(null);
    const [currentTime, setCurrentTime]   = useState(new Date());

    const socketRef   = useRef(null);
    const pollTimerRef = useRef(null);

    // ── Clock ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Fetch restaurant public profile ───────────────────────────────────────
    useEffect(() => {
        if (!restaurantId) return;
        fetch(`/api/auth/public/${restaurantId}`)
            .then(r => r.json())
            .then(d => {
                if (d.success) setRestaurant(d.data);
            })
            .catch(() => { /* silent — just won't show branding */ });
    }, [restaurantId]);

    // ── Fetch queue (HTTP) ────────────────────────────────────────────────────
    const fetchQueue = React.useCallback(async () => {
        try {
            const res  = await fetch(`/api/public/queue/active/${restaurantId}`);
            const data = await res.json();
            if (data.success) {
                const waiting = data.data.filter(q => q.status === 'WAITING');
                const called  = data.data.filter(q => q.status === 'CALLED');
                setQueue(waiting);
                setCalledTokens(called.slice(-8));
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error('TV Monitor: queue fetch failed', err);
        }
    }, [restaurantId]);

    // ── Socket setup (anonymous — no auth token needed) ────────────────────────
    useEffect(() => {
        if (!restaurantId) return;

        // Initial HTTP fetch
        fetchQueue();

        // Create a new anonymous socket connection (not the auth singleton)
        const sock = io('/', {
            path: '/socket.io',
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
        });

        socketRef.current = sock;

        const joinRoom = () => {
            sock.emit('join:restaurant', restaurantId);
            setSocketOk(true);
            // Clear HTTP polling — socket handles updates now
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };

        sock.on('connect', () => {
            console.log('📺 TV Monitor socket connected:', sock.id);
            joinRoom();
        });

        sock.on('queue_update', () => {
            console.log('📺 TV Monitor: queue_update received');
            fetchQueue();
        });

        sock.on('disconnect', () => {
            console.warn('📺 TV Monitor: socket disconnected — falling back to HTTP polling');
            setSocketOk(false);
            startPolling();
        });

        sock.on('connect_error', () => {
            console.warn('📺 TV Monitor: socket connect failed — using HTTP polling');
            setSocketOk(false);
            startPolling();
        });

        // If already connected immediately, join
        if (sock.connected) joinRoom();

        return () => {
            sock.disconnect();
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [restaurantId, fetchQueue]);

    function startPolling() {
        if (pollTimerRef.current) return; // already running
        pollTimerRef.current = setInterval(fetchQueue, POLL_INTERVAL_MS);
    }

    // ── Derived values ────────────────────────────────────────────────────────
    const joinUrl = `${window.location.origin}/join-waitlist/${restaurantId}`;
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl)}`;

    const hotelName  = restaurant?.restaurantName || restaurant?.name || 'Waitlist Queue';
    const hotelLogo  = restaurant?.logo;
    const hotelAddr  = restaurant?.address;

    const timeStr = currentTime.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const dateStr = currentTime.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long',
    });

    return (
        <div className="tv-container">
            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <header className="tv-header">
                {/* Left — restaurant branding */}
                <div className="tv-brand-block">
                    {hotelLogo && (
                        <img
                            src={hotelLogo}
                            alt="logo"
                            className="tv-hotel-logo"
                        />
                    )}
                    <div className="tv-brand-text">
                        <span className="tv-hotel-name">{hotelName}</span>
                        {hotelAddr && (
                            <span className="tv-hotel-addr">{hotelAddr}</span>
                        )}
                    </div>
                </div>

                {/* Center — live clock */}
                <div className="tv-clock-block">
                    <span className="tv-clock-time">{timeStr}</span>
                    <span className="tv-clock-date">{dateStr}</span>
                </div>

                {/* Right — QR + status indicator */}
                <div className="tv-qr-box">
                    <img src={qrUrl} alt="Scan to Join" />
                    <div>
                        <strong>Scan to Join</strong>
                        {window.location.hostname === 'localhost' ? (
                            <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                ⚠️ Open via LAN IP for phone scanning
                            </span>
                        ) : (
                            <span>Skip the line — join from your phone</span>
                        )}
                        <span className={`tv-live-badge ${socketOk ? 'live' : 'polling'}`}>
                            {socketOk ? '● LIVE' : '⟳ POLLING'}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── MAIN CONTENT — split panel ─────────────────────────────── */}
            <div className="tv-content">
                {/* LEFT — waiting */}
                <div className="tv-split-panel tv-waiting-panel">
                    <h2 className="tv-kfc-title">
                        <span className="tv-title-icon">⏳</span> PLEASE WAIT
                    </h2>
                    <div className="tv-token-grid">
                        {queue.length === 0 ? (
                            <div className="tv-empty-text">No one is waiting right now</div>
                        ) : (
                            queue.map(q => (
                                <div key={q._id} className="tv-token-card tv-waiting-card">
                                    <div className="tv-kfc-token">{q.tokenNumber}</div>
                                    <div className="tv-kfc-name">{q.customerName}</div>
                                    {q.partySize > 1 && (
                                        <div className="tv-party-size">👥 Party of {q.partySize}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT — called/ready */}
                <div className="tv-split-panel tv-ready-panel">
                    <h2 className="tv-kfc-title tv-ready-title">
                        <span className="tv-title-icon">✅</span> PLEASE PROCEED
                    </h2>
                    <div className="tv-token-grid">
                        {calledTokens.length === 0 ? (
                            <div className="tv-empty-text">No tokens called yet</div>
                        ) : (
                            calledTokens.map(q => (
                                <div key={q._id} className="tv-token-card tv-ready-card">
                                    <div className="tv-kfc-token">{q.tokenNumber}</div>
                                    <div className="tv-kfc-name">{q.customerName}</div>
                                    {q.partySize > 1 && (
                                        <div className="tv-party-size">👥 Party of {q.partySize}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer className="tv-footer">
                <span className="tv-footer-brand">
                    Powered by <strong>ProBloom</strong>
                </span>
                {lastUpdated && (
                    <span className="tv-footer-updated">
                        Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                )}
                <span className="tv-footer-count">
                    {queue.length} waiting · {calledTokens.length} called
                </span>
            </footer>
        </div>
    );
}
