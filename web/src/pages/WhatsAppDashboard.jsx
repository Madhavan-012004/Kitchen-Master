import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import './WhatsAppDashboard.css';

const AUDIENCE_OPTIONS = [
    { value: 'ALL', label: '👥 All Customers', desc: 'Send to every customer in your database' },
    { value: 'FREQUENT', label: '🔁 Frequent Buyers', desc: 'Customers with 5+ orders' },
    { value: 'INACTIVE', label: '😴 Inactive Customers', desc: 'No orders in the last 30 days' },
    { value: 'HIGH_VALUE', label: '💎 High Value', desc: 'Top spenders in your shop' },
    { value: 'BIRTHDAY', label: '🎂 Birthday Customers', desc: 'Customers with birthdays this month' },
];

export default function WhatsAppDashboard() {
    const [activeTab, setActiveTab] = useState('settings');
    const [settings, setSettings] = useState({
        whatsappEnabled: false,
        whatsappAutoSendInvoice: false,
        whatsappAutoSendPromos: false,
        whatsappThankYouMessage: 'Thank you for shopping with us! 🙏',
        whatsappPromoFooter: 'Visit us again soon! 😊',
        restaurantName: '',
        address: '',
        phone: '',
        gstNumber: '',
    });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    const [analytics, setAnalytics] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [logs, setLogs] = useState([]);

    const [campaign, setCampaign] = useState({
        campaignName: '',
        audienceFilter: 'ALL',
        messageTemplate: '',
        offerPercentage: '',
        expiryDate: '',
    });
    const [launching, setLaunching] = useState(false);
    const [launchMsg, setLaunchMsg] = useState('');

    const [toast, setToast] = useState('');
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const fetchAll = useCallback(async () => {
        try {
            const [sRes, aRes, cRes, lRes] = await Promise.all([
                api.get('/whatsapp/settings'),
                api.get('/whatsapp/analytics'),
                api.get('/whatsapp/campaigns'),
                api.get('/whatsapp/logs'),
            ]);
            const s = sRes.data;
            setSettings(prev => ({ ...prev, ...s }));
            setAnalytics(aRes.data);
            setCampaigns(cRes.data || []);
            setLogs(lRes.data || []);
        } catch (err) {
            console.error('Failed to load WhatsApp data', err);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const saveSettings = async () => {
        setSettingsSaving(true);
        try {
            await api.put('/whatsapp/settings', settings);
            setSettingsSaved(true);
            showToast('✅ Settings saved!');
            setTimeout(() => setSettingsSaved(false), 3000);
        } catch {
            showToast('❌ Failed to save settings');
        } finally {
            setSettingsSaving(false);
        }
    };

    const launchCampaign = async () => {
        if (!campaign.campaignName.trim()) return showToast('⚠️ Please give the campaign a name');
        if (!campaign.messageTemplate.trim()) return showToast('⚠️ Please enter a message template');
        setLaunching(true);
        setLaunchMsg('');
        try {
            const payload = {
                ...campaign,
                offerPercentage: campaign.offerPercentage ? parseFloat(campaign.offerPercentage) : null,
            };
            await api.post('/whatsapp/campaigns', payload);
            showToast('🚀 Campaign launched! Sending to audience...');
            setLaunchMsg('Campaign queued for delivery!');
            setCampaign({ campaignName: '', audienceFilter: 'ALL', messageTemplate: '', offerPercentage: '', expiryDate: '' });
            fetchAll();
        } catch {
            showToast('❌ Failed to launch campaign');
        } finally {
            setLaunching(false);
        }
    };

    const Toggle = ({ value, onToggle, label, sub }) => (
        <div className="wa-toggle-row" onClick={onToggle}>
            <div className="wa-toggle-text">
                <span className="wa-toggle-label">{label}</span>
                {sub && <span className="wa-toggle-sub">{sub}</span>}
            </div>
            <div className={`wa-switch ${value ? 'on' : ''}`}>
                <div className="wa-switch-knob" />
            </div>
        </div>
    );

    const StatCard = ({ icon, value, label, color }) => (
        <div className="wa-stat-card">
            <div className="wa-stat-icon" style={{ background: color + '22', color }}>{icon}</div>
            <div className="wa-stat-value">{value ?? '—'}</div>
            <div className="wa-stat-label">{label}</div>
        </div>
    );

    return (
        <div className="wa-page">
            {/* Header */}
            <div className="wa-page-header">
                <div className="wa-header-left">
                    <div className="wa-page-icon">💬</div>
                    <div>
                        <h1 className="wa-page-title">WhatsApp Center</h1>
                        <p className="wa-page-sub">Automated invoices, promotions & customer engagement</p>
                    </div>
                </div>
                <div className={`wa-enabled-badge ${settings.whatsappEnabled ? 'active' : 'inactive'}`}>
                    {settings.whatsappEnabled ? '🟢 WhatsApp Active' : '⚫ WhatsApp Disabled'}
                </div>
            </div>

            {/* Tabs */}
            <div className="wa-tabs">
                {[
                    { key: 'settings', label: '⚙️ Settings' },
                    { key: 'promotions', label: '📢 Promotions' },
                    { key: 'analytics', label: '📊 Analytics' },
                    { key: 'logs', label: '📋 Message Logs' },
                ].map(t => (
                    <button key={t.key} className={`wa-tab ${activeTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.key)}>{t.label}</button>
                ))}
            </div>

            <div className="wa-content">

                {/* ──── SETTINGS TAB ──── */}
                {activeTab === 'settings' && (
                    <div className="wa-settings-grid">
                        {/* Left: Config */}
                        <div className="wa-card">
                            <h3 className="wa-card-title">📱 WhatsApp Configuration</h3>
                            <Toggle
                                value={settings.whatsappEnabled}
                                onToggle={() => setSettings(s => ({ ...s, whatsappEnabled: !s.whatsappEnabled }))}
                                label="Enable WhatsApp Integration"
                                sub="Master switch for all WhatsApp features"
                            />
                            <Toggle
                                value={settings.whatsappAutoSendInvoice}
                                onToggle={() => setSettings(s => ({ ...s, whatsappAutoSendInvoice: !s.whatsappAutoSendInvoice }))}
                                label="Auto-Send Invoice on Bill"
                                sub="Automatically sends invoice to customer when bill is paid"
                            />
                            <Toggle
                                value={settings.whatsappAutoSendPromos}
                                onToggle={() => setSettings(s => ({ ...s, whatsappAutoSendPromos: !s.whatsappAutoSendPromos }))}
                                label="Allow Promotional Messages"
                                sub="Enable bulk promotional campaign sending"
                            />

                            <div className="wa-section-divider" />

                            <label className="wa-field-label">Thank You Message</label>
                            <textarea className="wa-textarea" rows={3}
                                value={settings.whatsappThankYouMessage}
                                onChange={e => setSettings(s => ({ ...s, whatsappThankYouMessage: e.target.value }))}
                                placeholder="Thank you for shopping with us!" />

                            <label className="wa-field-label">Promotional Footer</label>
                            <textarea className="wa-textarea" rows={2}
                                value={settings.whatsappPromoFooter}
                                onChange={e => setSettings(s => ({ ...s, whatsappPromoFooter: e.target.value }))}
                                placeholder="Visit us again soon!" />

                            <button className="wa-save-btn" onClick={saveSettings} disabled={settingsSaving}>
                                {settingsSaving ? '⏳ Saving…' : settingsSaved ? '✅ Saved!' : '💾 Save Settings'}
                            </button>
                        </div>

                        {/* Right: Preview */}
                        <div className="wa-card">
                            <h3 className="wa-card-title">👁️ Invoice Preview</h3>
                            <div className="wa-preview-phone">
                                <div className="wa-preview-bubble">
                                    <div className="wa-preview-shop">🧾 <strong>{settings.restaurantName || 'Your Shop'}</strong></div>
                                    {settings.address && <div className="wa-preview-line">📍 {settings.address}</div>}
                                    {settings.phone && <div className="wa-preview-line">📞 {settings.phone}</div>}
                                    <div className="wa-preview-divider" />
                                    <div className="wa-preview-line"><strong>Invoice No:</strong> ORD-2024-001</div>
                                    <div className="wa-preview-line"><strong>Customer:</strong> John Doe</div>
                                    <div className="wa-preview-divider" />
                                    <div className="wa-preview-line">• Men's Shirt x2 — ₹1,200</div>
                                    <div className="wa-preview-line">• Jeans x1 — ₹1,500</div>
                                    <div className="wa-preview-divider" />
                                    <div className="wa-preview-line">Subtotal: ₹2,700</div>
                                    <div className="wa-preview-line"><strong>Total: ₹2,700</strong></div>
                                    <div className="wa-preview-line">Payment: CASH</div>
                                    <div className="wa-preview-divider" />
                                    <div className="wa-preview-thank">{settings.whatsappThankYouMessage}</div>
                                    {settings.whatsappPromoFooter && (
                                        <div className="wa-preview-footer">{settings.whatsappPromoFooter}</div>
                                    )}
                                    <div className="wa-preview-time">11:30 AM ✓✓</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ──── PROMOTIONS TAB ──── */}
                {activeTab === 'promotions' && (
                    <div className="wa-promotions-grid">
                        <div className="wa-card">
                            <h3 className="wa-card-title">🎯 Create Campaign</h3>
                            <label className="wa-field-label">Campaign Name</label>
                            <input className="wa-input" value={campaign.campaignName}
                                onChange={e => setCampaign(c => ({ ...c, campaignName: e.target.value }))}
                                placeholder="e.g. Weekend Sale 2024" />

                            <label className="wa-field-label">Target Audience</label>
                            <div className="wa-audience-grid">
                                {AUDIENCE_OPTIONS.map(opt => (
                                    <div key={opt.value}
                                        className={`wa-audience-card ${campaign.audienceFilter === opt.value ? 'selected' : ''}`}
                                        onClick={() => setCampaign(c => ({ ...c, audienceFilter: opt.value }))}>
                                        <div className="wa-audience-label">{opt.label}</div>
                                        <div className="wa-audience-desc">{opt.desc}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="wa-field-label">Offer % (optional)</label>
                                    <input className="wa-input" type="number" value={campaign.offerPercentage}
                                        onChange={e => setCampaign(c => ({ ...c, offerPercentage: e.target.value }))}
                                        placeholder="e.g. 20" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="wa-field-label">Offer Expiry Date</label>
                                    <input className="wa-input" type="date" value={campaign.expiryDate}
                                        onChange={e => setCampaign(c => ({ ...c, expiryDate: e.target.value }))} />
                                </div>
                            </div>

                            <label className="wa-field-label">Message Template</label>
                            <textarea className="wa-textarea" rows={5} value={campaign.messageTemplate}
                                onChange={e => setCampaign(c => ({ ...c, messageTemplate: e.target.value }))}
                                placeholder={`🎉 Special Offer from {SHOP_NAME}\n\nGet {OFFER_PERCENTAGE}% OFF on selected items!\n\nOffer valid until: {EXPIRY_DATE}\n\nVisit us today! 🛍️\n{SHOP_ADDRESS}`} />
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                                Available tokens: {'{SHOP_NAME}'} {'{CUSTOMER_NAME}'} {'{OFFER_PERCENTAGE}'} {'{EXPIRY_DATE}'} {'{SHOP_ADDRESS}'}
                            </div>

                            <button className="wa-launch-btn" onClick={launchCampaign} disabled={launching}>
                                {launching ? '⏳ Launching…' : '🚀 Launch Campaign'}
                            </button>
                        </div>

                        <div className="wa-card">
                            <h3 className="wa-card-title">📋 Previous Campaigns</h3>
                            {campaigns.length === 0 ? (
                                <div className="wa-empty">No campaigns yet. Create your first one! 📢</div>
                            ) : campaigns.map(c => (
                                <div key={c._id} className={`wa-campaign-row status-${c.status?.toLowerCase()}`}>
                                    <div className="wa-campaign-name">{c.campaignName}</div>
                                    <div className="wa-campaign-meta">
                                        <span>👥 {c.audienceFilter}</span>
                                        <span>✅ {c.sentCount} sent</span>
                                        {c.failedCount > 0 && <span style={{ color: '#ef4444' }}>❌ {c.failedCount} failed</span>}
                                    </div>
                                    <div className={`wa-campaign-status badge-${c.status?.toLowerCase()}`}>{c.status}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ──── ANALYTICS TAB ──── */}
                {activeTab === 'analytics' && (
                    <div>
                        <div className="wa-stats-row">
                            <StatCard icon="🧾" value={analytics?.invoicesSentToday} label="Invoices Sent Today" color="#3b82f6" />
                            <StatCard icon="📢" value={analytics?.promotionsSentToday} label="Promos Sent Today" color="#7c3aed" />
                            <StatCard icon="✅" value={analytics?.messagesDeliveredToday} label="Delivered Today" color="#10b981" />
                            <StatCard icon="📊" value={analytics ? analytics.engagementRate + '%' : '—'} label="Engagement Rate" color="#f59e0b" />
                            <StatCard icon="📋" value={analytics?.totalCampaigns} label="Total Campaigns" color="#ec4899" />
                        </div>
                        <div className="wa-card" style={{ marginTop: '20px' }}>
                            <h3 className="wa-card-title">ℹ️ How analytics are tracked</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                                Messages are logged every time an invoice or promotion is sent. Delivery status is updated when the WhatsApp provider confirms delivery.
                                In <strong>mock mode</strong>, all messages are marked as DELIVERED immediately. Connect a real provider (Twilio / Meta API) to receive live status callbacks.
                            </p>
                        </div>
                    </div>
                )}

                {/* ──── LOGS TAB ──── */}
                {activeTab === 'logs' && (
                    <div className="wa-card">
                        <h3 className="wa-card-title">📋 Message Delivery Logs</h3>
                        {logs.length === 0 ? (
                            <div className="wa-empty">No messages sent yet. Enable WhatsApp and start billing!</div>
                        ) : (
                            <div className="wa-logs-table-wrap">
                                <table className="wa-logs-table">
                                    <thead>
                                        <tr>
                                            <th>Recipient</th>
                                            <th>Phone</th>
                                            <th>Type</th>
                                            <th>Order</th>
                                            <th>Status</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(l => (
                                            <tr key={l._id}>
                                                <td>{l.recipientName || '—'}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{l.recipientNumber}</td>
                                                <td><span className={`wa-type-badge type-${l.messageType?.toLowerCase()}`}>{l.messageType}</span></td>
                                                <td>{l.orderNumber || '—'}</td>
                                                <td><span className={`wa-status-badge st-${l.status?.toLowerCase()}`}>{l.status}</span></td>
                                                <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {l.createdAt ? new Date(l.createdAt).toLocaleString('en-IN', { hour12: true }) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && <div className="wa-toast">{toast}</div>}
        </div>
    );
}
