import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import socket from '../api/socket.js';
import './WaitlistMonitor.css';

export default function WaitlistMonitor() {
    const { restaurantId } = useParams();
    const [queue, setQueue] = useState([]);
    const [calledTokens, setCalledTokens] = useState([]);

    const fetchQueue = async () => {
        try {
            const res = await axios.get(`/api/public/queue/active/${restaurantId}`);
            if (res.data.success) {
                const data = res.data.data;
                const waiting = data.filter(q => q.status === 'WAITING');
                const called = data.filter(q => q.status === 'CALLED');
                
                setQueue(waiting);
                // Keep the most recent 8 called tokens so people see them
                setCalledTokens(called.slice(-8));
            }
        } catch (err) {
            console.error("Failed to fetch queue", err);
        }
    };

    useEffect(() => {
        fetchQueue();
        
        // Socket.IO connecting to backend2 using global socket
        socket.on('connect', () => {
            socket.emit('join:restaurant', restaurantId);
        });
        
        // If already connected when mounted, join immediately
        if (socket.connected) {
            socket.emit('join:restaurant', restaurantId);
        }

        socket.on('queue_update', (msg) => {
            console.log("📺 Monitor received queue update event via socket", msg);
            fetchQueue();
        });

        return () => {
            socket.off('connect');
            socket.off('queue_update');
        };
    }, [restaurantId]);

    // QR Code generation URL
    const joinUrl = `${window.location.origin}/join-waitlist/${restaurantId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`;

    return (
        <div className="tv-container">
            <div className="tv-header">
                <div className="tv-brand">
                    Waitlist <span>Queue</span>
                </div>
                <div className="tv-qr-box">
                    <img src={qrUrl} alt="Scan to Join" />
                    <div>
                        <strong>Scan to Join</strong>
                        {window.location.hostname === 'localhost' ? (
                            <span style={{color: 'var(--accent)', fontWeight: 'bold'}}>
                                ⚠️ Open this page using your PC's IP address (e.g. 192.168.x.x) so phones can scan.
                            </span>
                        ) : (
                            <span>Skip the line, join from your phone.</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="tv-content">
                <div className="tv-split-panel tv-waiting-panel">
                    <h2 className="tv-kfc-title">PLEASE WAIT</h2>
                    <div className="tv-token-grid">
                        {queue.length === 0 ? (
                            <div className="tv-empty-text">No one is waiting</div>
                        ) : (
                            queue.map(q => (
                                <div key={q._id} className="tv-token-card tv-waiting-card">
                                    <div className="tv-kfc-token">{q.tokenNumber}</div>
                                    <div className="tv-kfc-name">{q.customerName}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="tv-split-panel tv-ready-panel">
                    <h2 className="tv-kfc-title tv-ready-title">PLEASE PROCEED</h2>
                    <div className="tv-token-grid">
                        {calledTokens.length === 0 ? (
                            <div className="tv-empty-text">No called tokens</div>
                        ) : (
                            calledTokens.map(q => (
                                <div key={q._id} className="tv-token-card tv-ready-card">
                                    <div className="tv-kfc-token">{q.tokenNumber}</div>
                                    <div className="tv-kfc-name">{q.customerName}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
