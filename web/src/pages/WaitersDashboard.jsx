import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import './WaitersDashboard.css';

export default function WaitersDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) return;
        
        api.get('/orders/waiter/dashboard')
            .then(res => {
                setStats(res.data.data || res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load waiter dashboard", err);
                setError(err.response?.data?.message || err.message);
                setLoading(false);
            });
    }, [user]);

    if (loading) {
        return (
            <div className="waiter-dashboard-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#fff', width: '40px', height: '40px', borderWidth: '4px' }}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="waiter-dashboard-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ margin: '0 0 16px 0' }}>Failed to load dashboard</h2>
                <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>{error}</p>
                <button onClick={() => navigate(-1)} className="wd-back-btn" style={{ width: 'auto', padding: '0 20px', borderRadius: '20px' }}>
                    Go Back
                </button>
            </div>
        );
    }

    const { totalCompleted = 0, averageRating = 0, recentFeedback = [], history = [] } = stats || {};
    const firstName = user?.name?.split(' ')[0] || 'Waiter';

    return (
        <div className="waiter-dashboard-page">
            <div className="wd-header">
                <button className="wd-back-btn" onClick={() => navigate(-1)}>
                    ←
                </button>
                <h1 className="wd-greeting">Hello, {firstName}!</h1>
            </div>

            <div className="wd-stats-row">
                <div className="wd-stat-card">
                    <div className="wd-stat-icon">🌟</div>
                    <div className="wd-stat-value">{averageRating > 0 ? averageRating.toFixed(1) : '-'}</div>
                    <div className="wd-stat-label">Avg Rating</div>
                </div>
                <div className="wd-stat-card">
                    <div className="wd-stat-icon">🍽️</div>
                    <div className="wd-stat-value">{totalCompleted}</div>
                    <div className="wd-stat-label">Completed</div>
                </div>
            </div>

            <h2 className="wd-section-title"><span>🎯</span> Waiter Guidelines</h2>
            <div className="wd-guidelines-card">
                <div className="wd-guideline-item">
                    <div className="wd-guideline-icon">😊</div>
                    <p className="wd-guideline-text">
                        <strong>Greet with a Smile</strong>
                        Always welcome customers warmly within 1 minute of seating.
                    </p>
                </div>
                <div className="wd-guideline-item">
                    <div className="wd-guideline-icon">📝</div>
                    <p className="wd-guideline-text">
                        <strong>Repeat the Order</strong>
                        Double-check the order with the customer to avoid mistakes.
                    </p>
                </div>
                <div className="wd-guideline-item">
                    <div className="wd-guideline-icon">⏱️</div>
                    <p className="wd-guideline-text">
                        <strong>Check Back</strong>
                        Visit the table 5 minutes after serving to ensure everything is perfect.
                    </p>
                </div>
                <div className="wd-guideline-item">
                    <div className="wd-guideline-icon">✨</div>
                    <p className="wd-guideline-text">
                        <strong>Maintain Hygiene</strong>
                        Keep uniform clean and clear empty plates promptly.
                    </p>
                </div>
            </div>

            <h2 className="wd-section-title"><span>💬</span> My Recent Reviews</h2>
            {recentFeedback.length === 0 ? (
                <div className="wd-empty">
                    <div className="wd-empty-icon">📝</div>
                    <div>No written reviews yet. Provide great service to earn them!</div>
                </div>
            ) : (
                <div className="wd-reviews-list">
                    {recentFeedback.map((fb, idx) => (
                        <div key={idx} className="wd-review-card">
                            <div className="wd-review-header">
                                <div className="wd-review-stars">
                                    {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                                </div>
                                <div className="wd-review-date">
                                    {new Date(fb.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                            </div>
                            <p className="wd-review-text">"{fb.feedback}"</p>
                            <div className="wd-review-order">Bill #{fb.orderNumber || fb.orderId}</div>
                        </div>
                    ))}
                </div>
            )}

            <h2 className="wd-section-title"><span>📜</span> Recent Orders</h2>
            {history.length === 0 ? (
                <div className="wd-empty">
                    <div>No completed orders found.</div>
                </div>
            ) : (
                <div className="wd-history-list">
                    {history.slice(0, 10).map((order) => (
                        <div key={order._id || order.id} className="wd-history-item">
                            <div className="wd-history-left">
                                <div className="wd-history-title">Bill #{order.orderNumber || String(order._id || order.id).slice(-8).toUpperCase()}</div>
                                <div className="wd-history-time">
                                    {new Date(order.createdAt || order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div className="wd-history-right">
                                <div className="wd-history-amount">₹{(order.total || 0).toFixed(2)}</div>
                                <div className="wd-history-items">{order.items?.length || 0} items</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
