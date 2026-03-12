import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import './Simple.css';

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [radius, setRadius] = useState(user?.geofenceRadius || 500);

    React.useEffect(() => {
        if (user?.role === 'owner' && navigator.geolocation) {
            // "Warm up" GPS permission on load for owners
            navigator.geolocation.getCurrentPosition(() => { }, () => { }, { enableHighAccuracy: true });
        }
    }, [user?.role]);

    if (!user) return null;

    const handleSaveSettings = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await api.put('/auth/profile', { geofenceRadius: radius });
            if (res.data.success) {
                updateUser(res.data.data.user);
                setMessage({ type: 'success', text: 'Restaurant settings updated!' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Update failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLocation = () => {
        setLoading(true);
        setMessage({ type: '', text: '' });

        if (!navigator.geolocation) {
            setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const res = await api.put('/auth/profile', { latitude, longitude });

                    if (res.data.success) {
                        updateUser(res.data.data.user);
                        setMessage({ type: 'success', text: 'Restaurant location updated successfully!' });
                    }
                } catch (error) {
                    setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update location' });
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                setMessage({ type: 'error', text: 'Please enable location access to set restaurant coordinates.' });
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="simple-page">
            <div className="simple-header">
                <h1 className="page-title">Profile Settings</h1>
            </div>

            <div className="order-row" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '24px', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                    <div className="emp-avatar" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                        {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{user.name}</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
                        <span className="role-badge" style={{ marginTop: '8px', display: 'inline-block' }}>{user.role.toUpperCase()}</span>
                    </div>
                </div>

                <div style={{ width: '100%', height: '1px', background: 'var(--border)' }}></div>

                <div style={{ width: '100%' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                        Restaurant Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Name</p>
                            <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.restaurantName}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone</p>
                            <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.phone || 'Not set'}</p>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Address</p>
                            <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.address || 'Not set'}</p>
                        </div>
                    </div>
                </div>

                {user.role === 'owner' && (
                    <div style={{ width: '100%', marginTop: '10px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                            Geo-Fencing Location
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                            Setting your current location as the restaurant's physical coordinate ensures employees can only clock in when they are on-site (within 200m).
                        </p>

                        {user.location?.latitude ? (
                            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#22c55e' }}>📍</span>
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                    Location Set: {user.location.latitude.toFixed(6)}, {user.location.longitude.toFixed(6)}
                                </span>
                            </div>
                        ) : (
                            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#ef4444' }}>⚠️</span>
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Location not set. Attendance tracking will not work.</span>
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                Geofence Radius (Meters)
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input
                                    type="number"
                                    value={radius}
                                    onChange={(e) => setRadius(parseInt(e.target.value))}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                    placeholder="e.g. 500"
                                />
                                <button
                                    className="add-btn"
                                    style={{ padding: '0 20px' }}
                                    onClick={handleSaveSettings}
                                    disabled={loading}
                                >
                                    Save
                                </button>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Employees must be within this distance to clock in. Default is 500m.
                            </p>
                        </div>

                        <button
                            className="add-btn"
                            style={{ width: '100%', justifyContent: 'center', padding: '12px', background: 'transparent', border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
                            onClick={handleUpdateLocation}
                            disabled={loading}
                        >
                            {loading ? '📍 Capturing Location...' : '📍 Update to My Current Location'}
                        </button>
                    </div>
                )}

                {message.text && (
                    <div style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        textAlign: 'center',
                        background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: message.type === 'success' ? '#22c55e' : '#ef4444',
                        border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`
                    }}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
}
