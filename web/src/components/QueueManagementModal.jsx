import React, { useState, useEffect } from 'react';
import axios from '../api/client.js';
import './QueueManagementModal.css';

export default function QueueManagementModal({ onClose, restaurantId, socket, onSeatCustomer }) {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = async () => {
        try {
            const res = await axios.get('/queue/active');
            if (res.data.success) {
                setQueue(res.data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        if (socket) {
            const handleRefresh = () => {
                console.log("📫 POS Modal refreshing for waitlist update...");
                fetchQueue();
            };
            socket.on('queue_update', handleRefresh);
            return () => socket.off('queue_update', handleRefresh);
        }
    }, [socket]);

    const handleAction = async (id, status) => {
        try {
            await axios.put(`/queue/${id}/status`, { status });
            fetchQueue();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const handleSeat = async (q) => {
        try {
            await axios.put(`/queue/${q._id}/status`, { status: 'SEATED' });
            fetchQueue();
            // Pass customer details back to POS to pre-fill the cart
            onSeatCustomer(q);
        } catch (err) {
            alert('Failed to seat customer');
        }
    };

    const waiting = queue.filter(q => q.status === 'WAITING' || q.status === 'CALLED');

    return (
        <div className="qm-overlay" onClick={onClose}>
            <div className="qm-modal" onClick={e => e.stopPropagation()}>
                <div className="qm-header">
                    <h2>Queue Management</h2>
                    <button className="qm-close" onClick={onClose}>✕</button>
                </div>
                
                <div className="qm-body">
                    {loading ? (
                        <div className="qm-loading">Loading...</div>
                    ) : waiting.length === 0 ? (
                        <div className="qm-empty">No customers currently waiting.</div>
                    ) : (
                        <table className="qm-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Customer</th>
                                    <th>Party</th>
                                    <th>Status</th>
                                    <th>Wait Time</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {waiting.map(q => {
                                    const waitMins = Math.floor((new Date() - new Date(q.createdAt)) / 60000);
                                    return (
                                        <tr key={q._id} className={q.status === 'CALLED' ? 'qm-row-called' : ''}>
                                            <td className="qm-token">{q.tokenNumber}</td>
                                            <td>
                                                <div className="qm-name">{q.customerName}</div>
                                                <div className="qm-phone">{q.customerPhone}</div>
                                            </td>
                                            <td>{q.partySize}</td>
                                            <td>
                                                <span className={`qm-status qm-status-${q.status.toLowerCase()}`}>
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className={waitMins > 20 ? 'qm-time-critical' : 'qm-time'}>
                                                {waitMins} min
                                            </td>
                                            <td className="qm-actions">
                                                {q.status === 'WAITING' && (
                                                    <button className="qm-btn qm-btn-call" onClick={() => handleAction(q._id, 'CALLED')}>
                                                        CALL
                                                    </button>
                                                )}
                                                <button className="qm-btn qm-btn-seat" onClick={() => handleSeat(q)}>
                                                    SEAT
                                                </button>
                                                <button className="qm-btn qm-btn-cancel" onClick={() => handleAction(q._id, 'CANCELLED')}>
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
