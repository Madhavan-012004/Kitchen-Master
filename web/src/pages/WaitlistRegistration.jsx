import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import socket from '../api/socket.js';
import './WaitlistRegistration.css';

export default function WaitlistRegistration() {
    const { restaurantId } = useParams();
    const [form, setForm] = useState({ customerName: '', customerPhone: '', partySize: 1 });
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [tokenStatus, setTokenStatus] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await axios.post(`/api/public/queue/join/${restaurantId}`, form);
            if (res.data.success) {
                setSuccessData(res.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join waitlist. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStatus = async (tokenNumber) => {
        try {
            const res = await axios.get(`/api/public/queue/status/${restaurantId}/${tokenNumber}`);
            if (res.data.success) {
                setTokenStatus(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch token status.");
        }
    };

    useEffect(() => {
        if (!successData?.tokenNumber) return;

        fetchStatus(successData.tokenNumber);

        socket.on('connect', () => {
            socket.emit('join:restaurant', restaurantId);
        });
        
        if (socket.connected) {
            socket.emit('join:restaurant', restaurantId);
        }

        socket.on('queue_update', () => {
            fetchStatus(successData.tokenNumber);
        });

        return () => {
            socket.off('connect');
            socket.off('queue_update');
        };
    }, [successData, restaurantId]);

    if (successData) {
        return (
            <div className="wl-container">
                <div className={`wl-success-card ${tokenStatus?.status === 'CALLED' ? 'wl-card-called' : ''}`}>
                    {tokenStatus?.status === 'CALLED' ? (
                        <>
                            <div className="wl-icon-check" style={{background: '#22c55e', animation: 'pulse-sm 1.5s infinite'}}>🔔</div>
                            <h2 style={{color: '#22c55e'}}>IT'S YOUR TURN!</h2>
                            <p>Please proceed to the host stand right away.</p>
                            <div className="wl-token-display" style={{borderColor: '#22c55e', color: '#22c55e'}}>
                                {successData.tokenNumber}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="wl-icon-check">✓</div>
                            <h2>You're on the list!</h2>
                            <p>Your Token Number is</p>
                            <div className="wl-token-display">{successData.tokenNumber}</div>
                            {tokenStatus && (
                                <div style={{marginTop: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                    <strong>Status:</strong> <span style={{color: '#d97706', fontWeight: 'bold'}}>{tokenStatus.status}</span>
                                </div>
                            )}
                            <p className="wl-info">Please keep this page open. It will update automatically when your table is ready!</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="wl-container">
            <div className="wl-form-card">
                <div className="wl-header">
                    <h2>Join the Waitlist</h2>
                    <p>Enter your details below to grab a spot in line.</p>
                </div>

                {error && <div className="wl-error">{error}</div>}

                <form onSubmit={handleSubmit} className="wl-form">
                    <div className="wl-input-group">
                        <label>Your Name</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="John Doe" 
                            value={form.customerName}
                            onChange={e => setForm({...form, customerName: e.target.value})}
                        />
                    </div>
                    <div className="wl-input-group">
                        <label>Phone Number (for SMS updates)</label>
                        <input 
                            type="tel" 
                            required 
                            placeholder="+1 234 567 8900" 
                            value={form.customerPhone}
                            onChange={e => setForm({...form, customerPhone: e.target.value})}
                        />
                    </div>
                    <div className="wl-input-group">
                        <label>Party Size</label>
                        <div className="wl-party-selector">
                            <button type="button" onClick={() => setForm({...form, partySize: Math.max(1, form.partySize - 1)})}>-</button>
                            <span>{form.partySize}</span>
                            <button type="button" onClick={() => setForm({...form, partySize: form.partySize + 1})}>+</button>
                        </div>
                    </div>
                    
                    <button type="submit" className="wl-submit-btn" disabled={loading}>
                        {loading ? 'Joining...' : 'Join Waitlist'}
                    </button>
                </form>
            </div>
        </div>
    );
}
