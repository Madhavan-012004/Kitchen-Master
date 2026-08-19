import React, { useState } from 'react';
import { shareViaWhatsApp, shareViaSMS, downloadInvoicePDF } from '../utils/billSharer.js';
import './BillSuccessModal.css';

export default function BillSuccessModal({ order, shopPhone, onClose }) {
    const [phone, setPhone] = useState(order?.customerPhone || shopPhone || '');

    if (!order) return null;

    const orderNo = order.orderNumber || order.billNumber || order.offlineId || order.id || 'N/A';
    const total = Number(order.total || order.grandTotal || 0) - Number(order.discount || 0);
    const isOffline = order.isOffline || String(order.id || '').startsWith('OFFLINE-');

    return (
        <div className="bsm-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bsm-card animate-pop-in">
                <button className="bsm-close-icon" onClick={onClose}>✕</button>

                <div className="bsm-header">
                    <div className="bsm-icon-ring">🎉</div>
                    <h3>Bill Saved Successfully!</h3>
                    {isOffline && (
                        <span className="bsm-offline-chip">⚡ Saved Offline (Auto-Sync Queued)</span>
                    )}
                </div>

                <div className="bsm-receipt-preview">
                    <div className="bsm-row">
                        <span>Bill Number:</span>
                        <strong>{orderNo}</strong>
                    </div>
                    <div className="bsm-row">
                        <span>Customer:</span>
                        <strong>{order.customerName || 'Walk-in Customer'}</strong>
                    </div>
                    <div className="bsm-row">
                        <span>Payment Method:</span>
                        <strong>{order.paymentMethod || 'CASH'}</strong>
                    </div>
                    <div className="bsm-row grand-total">
                        <span>Net Total:</span>
                        <strong style={{ color: '#22c55e' }}>₹{total.toFixed(2)}</strong>
                    </div>
                </div>

                <div className="bsm-phone-input-wrap">
                    <label>Recipient Phone Number:</label>
                    <input
                        type="tel"
                        className="bsm-phone-input"
                        placeholder="Enter 10-digit mobile number"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                    />
                </div>

                <div className="bsm-actions-grid">
                    <button
                        className="bsm-btn whatsapp-btn"
                        onClick={() => shareViaWhatsApp(phone, order)}
                    >
                        <span className="bsm-btn-icon">📱</span>
                        Share WhatsApp
                    </button>

                    <button
                        className="bsm-btn pdf-btn"
                        style={{ background: '#0284c7', color: '#fff' }}
                        onClick={() => downloadInvoicePDF(order)}
                    >
                        <span className="bsm-btn-icon">📄</span>
                        Download PDF
                    </button>

                    <button
                        className="bsm-btn sms-btn"
                        onClick={() => shareViaSMS(phone, order)}
                    >
                        <span className="bsm-btn-icon">💬</span>
                        Share SMS
                    </button>

                    <button
                        className="bsm-btn print-btn"
                        onClick={() => window.print()}
                    >
                        <span className="bsm-btn-icon">🖨️</span>
                        Print Bill
                    </button>

                    <button
                        className="bsm-btn done-btn"
                        onClick={onClose}
                    >
                        ✓ Done / Next Sale
                    </button>
                </div>
            </div>
        </div>
    );
}
