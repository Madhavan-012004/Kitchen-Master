import React from 'react';
import './DeviceLimitModal.css';

export default function DeviceLimitModal({ activeDevices, maxDevices, onSelectLogoutDevice, onCancel }) {
    return (
        <div className="dl-modal-overlay">
            <div className="dl-modal-card">
                <div className="dl-modal-header">
                    <div className="dl-header-icon">📱</div>
                    <div>
                        <h2 className="dl-title">Device Limit Reached</h2>
                        <p className="dl-subtitle">
                            Your subscription plan allows up to <strong>{maxDevices} active {maxDevices === 1 ? 'device' : 'devices'}</strong>.
                        </p>
                    </div>
                </div>

                <div className="dl-alert-banner">
                    ⚠️ You are attempting to log in from a new device. To continue, select one of your currently active devices below to log out.
                </div>

                <div className="dl-device-list">
                    {activeDevices.map((dev, idx) => (
                        <div key={dev.deviceId || idx} className="dl-device-card">
                            <div className="dl-device-left">
                                <div className="dl-device-icon">
                                    {dev.iconType === 'mobile' ? '📱' : '💻'}
                                </div>
                                <div className="dl-device-info">
                                    <div className="dl-device-name">
                                        {dev.deviceName || 'Active Session'}
                                    </div>
                                    <div className="dl-device-meta">
                                        {dev.os} • {dev.browser}
                                    </div>
                                    <div className="dl-device-time">
                                        🕒 Last active: {dev.lastActive ? new Date(dev.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                                    </div>
                                </div>
                            </div>
                            <button
                                className="dl-logout-btn"
                                onClick={() => onSelectLogoutDevice(dev.deviceId)}
                            >
                                Log Out & Replace
                            </button>
                        </div>
                    ))}
                </div>

                <div className="dl-modal-footer">
                    <button className="dl-cancel-btn" onClick={onCancel}>
                        Cancel Login
                    </button>
                </div>
            </div>
        </div>
    );
}
