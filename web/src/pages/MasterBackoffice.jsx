import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../api/client.js'
import emailjs from '@emailjs/browser'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { getTenantDeviceLimit, setTenantDeviceLimit } from '../utils/deviceHelper.js'
import './MasterBackoffice.css'
import jsPDF from 'jspdf';

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const Icons = {
    HQ: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
    Users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    CheckCircle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    AlertTriangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    Lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
    Cloud: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" /></svg>,
    Key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
    Search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    Refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
    Trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    Ban: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
    Download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    Copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
    LogOut: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    Sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
    Moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
    Eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const daysLeft = (d) => {
    if (!d) return null
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ client }) {
    const s = client.licenseStatus
    if (!client.isActive) return <div className="hq-badge hq-badge-inactive"><div className="hq-dot" />Suspended</div>
    if (s === 'expired') return <div className="hq-badge hq-badge-expired"><div className="hq-dot" />Expired</div>
    if (s === 'expiring_soon') return <div className="hq-badge hq-badge-warning"><div className="hq-dot hq-dot-pulse" />Expiring</div>
    return <div className="hq-badge hq-badge-active"><div className="hq-dot" />Active</div>
}

function LicenseTypeBadge({ type }) {
    if (type === 'prime') return <div className="hq-type-badge hq-type-prime">{Icons.Key} Onprime</div>
    return <div className="hq-type-badge hq-type-digital">{Icons.Cloud} Cloud</div>
}

// AddClientModal removed entirely from this file. It is now its own page.

// ─── Offline License Generator ────────────────────────────────────────────────
function OfflineLicenseGenerator({ clientOverride = null, onComplete = null, refreshList = null }) {
    const [reqFile, setReqFile] = useState(null)
    const [reqData, setReqData] = useState(null)
    const [expiryDate, setExpiryDate] = useState(() => {
        const d = new Date(); d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    })
    const [generating, setGenerating] = useState(false)
    const [result, setResult] = useState(null) // { success, message }
    const [open, setOpen] = useState(false)

    const handleReqFile = (e) => {
        const file = e.target.files[0]
        if (!file) return
        setReqFile(file)
        setResult(null)
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result)
                setReqData(data)
            } catch {
                setResult({ success: false, message: 'Invalid machine.req — could not parse JSON.' })
            }
        }
        reader.readAsText(file)
    }

    const pemToArrayBuffer = (pem) => {
        const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes.buffer
    }

    const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        return btoa(binary)
    }

    const handleGenerate = async () => {
        if (!reqFile) return setResult({ success: false, message: 'Please upload a machine.req file first.' })

        setGenerating(true)
        setResult(null)
        try {
            const formData = new FormData()
            formData.append('file', reqFile)
            formData.append('expiryDate', expiryDate)

            const res = await api.post('/master/clients/generate-and-email-license', formData)

            const { licenseB64, email, generatedPassword, customerName } = res.data.data;

            // ─── Dispatch via EmailJS ─────────────────────────────────────────
            const SERVICE_ID = 'service_oblwsjg';
            const TEMPLATE_ID = 'template_aalh1yb';
            const PUBLIC_KEY = 'Vjm57tVlA_OAiZ1H8';

            console.log('Attempting EmailJS dispatch to:', email);
            try {
                await emailjs.send(
                    SERVICE_ID,
                    TEMPLATE_ID,
                    {
                        to_email: email,
                        customer_name: customerName,
                        generated_password: generatedPassword,
                        license_file: licenseB64,
                        expiry_date: expiryDate
                    },
                    PUBLIC_KEY
                );
                console.log('EmailJS dispatch successful.');
            } catch (mailErr) {
                console.error('EmailJS dispatch failed:', mailErr);
            }

            // ─── Local Download ───────────────────────────────────────────────
            // Save base64 string directly as the app expects encoded content
            const blob = new Blob([licenseB64], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `license_${customerName.replace(/\s+/g, '_')}.lic`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setResult({ success: true, message: `✓ License generated, downloaded, and emailed to ${email}!` })
            if (refreshList) refreshList()
            if (onComplete) setTimeout(onComplete, 2000)
        } catch (err) {
            console.error('License generation failed:', err);
            let errMsg = err.response?.data?.message || err.message || 'Unknown error. Check console for details.';
            if (typeof err === 'string') errMsg = err;
            setResult({ success: false, message: 'Process Failed: ' + errMsg })
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className={`hq-offline-generator ${clientOverride ? 'in-modal' : ''}`}>
            {!clientOverride && (
                <div className="hq-offline-header" onClick={() => setOpen(o => !o)} style={{ marginBottom: open ? '1.5rem' : 0 }}>
                    <div className="hq-offline-header-left">
                        <div className="hq-offline-icon">{Icons.Key}</div>
                        <div>
                            <div className="hq-offline-title">Offline License Generator</div>
                            <div className="hq-offline-subtitle">Generate a signed .lic file from a customer machine.req</div>
                        </div>
                    </div>
                    <span className="hq-offline-chevron">{open ? '▲' : '▼'}</span>
                </div>
            )}

            {(open || clientOverride) && (
                <div className="hq-offline-body">
                    {clientOverride && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                This license will be provisioned for <strong>{clientOverride.restaurantName}</strong> and emailed to <strong>{clientOverride.email}</strong>.
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="hq-offline-label">Step 1 — Upload machine.req</label>
                        <input id="offline-req-input" type="file" accept=".req,.json" onChange={handleReqFile} className="hq-offline-input" />
                        {reqData && (
                            <div className="hq-offline-success">
                                ✓ Hardware ID: <strong>{reqData.hardwareId}</strong>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="hq-offline-label">Step 2 — License Expiry Date</label>
                        <input id="offline-expiry-input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="hq-offline-input" />
                    </div>

                    <div className="hq-offline-action-row">
                        {result && (
                            <div className={`hq-offline-result ${result.success ? 'success' : 'error'}`}>
                                {result.message}
                            </div>
                        )}
                        {!result && <div></div>}
                        <button
                            id="btn-generate-offline-license"
                            onClick={handleGenerate}
                            disabled={generating || !reqData}
                            className="hq-offline-btn"
                        >
                            {generating ? 'Signing & Generating...' : <>{Icons.Download} Generate & Dispatch license.lic</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── License Key Modal ────────────────────────────────────────────────────────
function LicenseModal({ client, licenseKey, onClose }) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(licenseKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const download = () => {
        const content = [
            '════════════════════════════════════════════════════════',
            '       PROBLOOM — ProBloom LICENSE SECRETS        ',
            '════════════════════════════════════════════════════════',
            `Restaurant : ${client.restaurantName}`,
            `Owner      : ${client.name}`,
            `Email      : ${client.email}`,
            `Type       : ONPRIME (Offline Secure Node)`,
            `Issued     : ${new Date().toDateString()}`,
            `Expires    : ${formatDate(client.subscription?.expiresAt)}`,
            '────────────────────────────────────────────────────────',
            'CRYPTOGRAPHIC LICENSE KEY:',
            licenseKey,
            '────────────────────────────────────────────────────────',
            'Keep this file safe. Do not modify or share it.',
            'Terminal Software by ProBloom | support@probloom.com',
            '════════════════════════════════════════════════════════',
        ].join('\n')

        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `probloom_${client.restaurantName.replace(/\s+/g, '_')}_license.lic`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="hq-modal-overlay" onClick={onClose}>
            <div className="hq-modal hq-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="hq-modal-header border-bottom">
                    <h3 className="hq-modal-title"><span className="text-prime">{Icons.Key} Cryptographic License generated</span></h3>
                </div>
                <div className="hq-modal-body">
                    <p className="hq-text-muted mb-4">
                        A secure offline license key has been provisioned for <strong>{client.restaurantName}</strong>.
                        Download the `.lic` payload and install it onto the client's local server environment.
                    </p>
                    <div className="hq-code-block">{licenseKey}</div>
                    <div className="hq-action-row mt-4">
                        <button className="hq-btn hq-btn-outline w-full justify-center" onClick={copy}>
                            {copied ? <><span className="text-green">{Icons.CheckCircle}</span> Copied to Clipboard</> : <> {Icons.Copy} Copy to Clipboard</>}
                        </button>
                        <button className="hq-btn hq-btn-glow hq-btn-green w-full justify-center" onClick={download}>
                            {Icons.Download} Download .lic Payload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function getTenantStaffLimits() {
    try {
        return JSON.parse(localStorage.getItem('probloom_tenant_staff_limits') || '{}')
    } catch {
        return {}
    }
}

function setTenantStaffLimit(identifier, limit) {
    const limits = getTenantStaffLimits()
    limits[identifier] = Number(limit) || 3
    localStorage.setItem('probloom_tenant_staff_limits', JSON.stringify(limits))
}

function ClientDetailsModal({ client, onClose, onRefresh }) {
    const storedLimits = getTenantStaffLimits()
    const initialStaffLimit = storedLimits[client.email] || storedLimits[client._id] || client.maxEmployees || 3
    const initialDeviceLimit = getTenantDeviceLimit(client)

    const [formData, setFormData] = useState({
        advanceAmount: client.advanceAmount || 0,
        amountPaid: client.amountPaid || 0,
        totalAmount: client.totalAmount || 0,
        appLayout: client.appLayout || 'restaurant', // default
        maxEmployees: initialStaffLimit,
        maxDevices: initialDeviceLimit
    })
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')

    if (!client) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'appLayout' ? value : Number(value)
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setMsg('')
        try {
            // Save local staff limit persistently
            const limits = getTenantStaffLimits()
            if (client.email) limits[client.email] = Number(formData.maxEmployees) || 3
            if (client._id) limits[client._id] = Number(formData.maxEmployees) || 3
            if (client.id) limits[client.id] = Number(formData.maxEmployees) || 3
            localStorage.setItem('probloom_tenant_staff_limits', JSON.stringify(limits))

            // Save local device limit persistently
            if (client.email) setTenantDeviceLimit(client.email, formData.maxDevices)
            if (client._id) setTenantDeviceLimit(client._id, formData.maxDevices)
            if (client.id) setTenantDeviceLimit(client.id, formData.maxDevices)

            const clientId = client._id || client.id
            if (clientId) {
                try {
                    await api.put(`/master/clients/${clientId}`, formData);
                } catch (apiErr) {
                    console.warn('Backend API update returned error, saved locally:', apiErr)
                }
            }
            setMsg('✓ Details, Staff & Device Limits updated successfully.')
            if (onRefresh) onRefresh()
        } catch (err) {
            setMsg('Error saving details: ' + (err.response?.data?.message || err.message))
        } finally {
            setLoading(false)
            setTimeout(() => setMsg(''), 3000)
        }
    }

    const handleGenerateInvoice = () => {
        try {
            const doc = new jsPDF()
            doc.setFontSize(22)
            doc.text("INVOICE", 105, 20, { align: "center" })

            doc.setFontSize(12)
            doc.text(`Tenant: ${client.restaurantName || client.name}`, 20, 40)
            doc.text(`Email: ${client.email}`, 20, 50)
            doc.text(`Phone: ${client.phone || '-'}`, 20, 60)
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70)

            doc.setLineWidth(0.5)
            doc.line(20, 80, 190, 80)

            let y = 90
            doc.text("Description", 20, y)
            doc.text("Amount", 160, y)
            y += 10
            doc.line(20, y, 190, y)
            y += 10

            doc.text("ProBloom Software License (1 Year)", 20, y)
            doc.text(`$${formData.totalAmount.toFixed(2)}`, 160, y)

            y += 20
            doc.line(20, y, 190, y)
            y += 10

            doc.text("Total Amount:", 120, y)
            doc.text(`$${formData.totalAmount.toFixed(2)}`, 160, y)
            y += 10
            doc.text("Advance Paid:", 120, y)
            doc.text(`$${formData.advanceAmount.toFixed(2)}`, 160, y)
            y += 10
            doc.text("Amount Paid:", 120, y)
            doc.text(`$${formData.amountPaid.toFixed(2)}`, 160, y)
            y += 10

            const due = formData.totalAmount - formData.advanceAmount - formData.amountPaid
            doc.setFont(undefined, 'bold')
            doc.text("Balance Due:", 120, y)
            doc.text(`$${due.toFixed(2)}`, 160, y)

            // Save PDF
            doc.save(`Invoice_${client.restaurantName?.replace(/\s+/g, '_') || 'Tenant'}.pdf`)
        } catch (err) {
            console.error("PDF generation err:", err)
            setMsg("PDF Generation failed.")
        }
    }

    return (
        <div className="hq-modal-overlay" onClick={onClose}>
            <div className="hq-modal hq-modal-xl" onClick={e => e.stopPropagation()}>
                <div className="hq-modal-header border-bottom">
                    <h3 className="hq-modal-title"><span>{Icons.Eye} Tenant Details & Billing</span></h3>
                </div>
                <div className="hq-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="hq-details-grid">
                        <div className="hq-detail-item">
                            <label>Restaurant Name</label>
                            <p>{client.restaurantName || '—'}</p>
                        </div>
                        <div className="hq-detail-item">
                            <label>Owner Name</label>
                            <p>{client.name || '—'}</p>
                        </div>
                        <div className="hq-detail-item">
                            <label>Email Address</label>
                            <p>{client.email || '—'}</p>
                        </div>
                        <div className="hq-detail-item">
                            <label>Phone Number</label>
                            <p>{client.phone || '—'}</p>
                        </div>
                        <div className="hq-detail-item">
                            <label>License Type</label>
                            <p style={{ textTransform: 'capitalize' }}>{client.licenseType || '—'}</p>
                        </div>
                        <div className="hq-detail-item">
                            <label>Status</label>
                            <p>{client.isActive ? 'Active' : 'Suspended'}</p>
                        </div>
                    </div>

                    <h4 style={{ marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>License Configuration & Billing</h4>

                    <div className="hq-details-grid" style={{ marginTop: '15px' }}>
                        <div className="hq-detail-item">
                            <label>App Layout (Theme)</label>
                            <select name="appLayout" value={formData.appLayout} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}>
                                <option value="restaurant" style={{ background: '#09090b', color: 'white' }}>Restaurant / QSR</option>
                                <option value="supermarket" style={{ background: '#09090b', color: 'white' }}>Supermarket POS</option>
                                <option value="tailor" style={{ background: '#09090b', color: 'white' }}>Tailor / Clothing</option>
                                <option value="poultry" style={{ background: '#09090b', color: 'white' }}>Poultry POS</option>
                            </select>
                        </div>
                        <div className="hq-detail-item">
                            <label>Max Staff / Biller Limit</label>
                            <input type="number" min="1" max="100" name="maxEmployees" value={formData.maxEmployees} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />
                        </div>
                        <div className="hq-detail-item">
                            <label>Max Connected Devices Limit</label>
                            <input type="number" min="1" max="100" name="maxDevices" value={formData.maxDevices} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />
                        </div>
                        <div className="hq-detail-item">
                            <label>Total Amount</label>
                            <input type="number" name="totalAmount" value={formData.totalAmount} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />
                        </div>
                        <div className="hq-detail-item">
                            <label>Advance Amount</label>
                            <input type="number" name="advanceAmount" value={formData.advanceAmount} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />
                        </div>
                        <div className="hq-detail-item">
                            <label>Amount Paid</label>
                            <input type="number" name="amountPaid" value={formData.amountPaid} onChange={handleChange} className="hq-input" style={{ width: '100%', padding: '8px', background: 'var(--hq-surface)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }} />
                        </div>
                    </div>
                    {msg && <p style={{ color: msg.includes('Error') ? '#ff4d4d' : '#00e676', marginTop: '10px' }}>{msg}</p>}

                    <div className="hq-modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <button className="hq-btn hq-btn-glow hq-btn-digital" onClick={handleGenerateInvoice}>
                                {Icons.Download} Generate Invoice
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="hq-btn hq-btn-outline" onClick={onClose}>Close</button>
                            <button className="hq-btn hq-btn-prime" onClick={handleSave} disabled={loading}>
                                {loading ? 'Saving...' : 'Update Details'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default function MasterBackoffice() {
    const { user, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()
    const location = useLocation()

    const [clients, setClients] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [modal, setModal] = useState(null)
    const [detailsModal, setDetailsModal] = useState(null)
    const [toast, setToast] = useState('')
    const [actionLoading, setActionLoading] = useState(null)

    useEffect(() => {
        if (location.state?.newClientSuccess) {
            setToast('✓ Tenant successfully deployed onto cluster!')
            if (location.state.licenseData) {
                setModal({ type: 'license', client: location.state.licenseData.client, key: location.state.licenseData.key })
            }
            // Clear router state to prevent loop on refresh
            window.history.replaceState({}, '')
        }
    }, [location])

    const notify = (msg) => {
        setToast(msg)
        setTimeout(() => setToast(''), 3000)
    }

    const fetchClients = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ search, status: statusFilter, licenseType: typeFilter, limit: 100 })
            const res = await api.get(`/master/clients?${params}`)
            setClients(res.data.data?.clients || [])
            setStats(res.data.data?.stats || {})
        } catch (err) {
            notify('Failed to locate nodes in the cluster.')
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, typeFilter])

    useEffect(() => {
        const t = setTimeout(fetchClients, 300)
        return () => clearTimeout(t)
    }, [fetchClients])

    const handleRenew = async (client) => {
        setActionLoading(client._id + '_renew')
        try {
            const res = await api.put(`/master/clients/${client._id}/renew`)
            notify(`✓ Pipeline extended until ${formatDate(res.data.data?.newExpiry)}`)
            fetchClients()
            if (res.data.data?.licenseKey && client.licenseType === 'prime') {
                setModal({ type: 'license', client, key: res.data.data.licenseKey })
            }
        } catch (err) {
            notify(err.response?.data?.message || 'Renew failed.')
        } finally {
            setActionLoading(null)
        }
    }

    const handleGenerateLicense = async (client) => {
        setActionLoading(client._id + '_lic')
        try {
            const res = await api.post(`/master/clients/${client._id}/generate-license`)
            setModal({ type: 'license', client, key: res.data.data?.licenseKey })
        } catch (err) {
            notify(err.response?.data?.message || 'Failed to compile license.')
        } finally {
            setActionLoading(null)
        }
    }

    const handleToggleStatus = async (client) => {
        if (!window.confirm(`${client.isActive ? 'Suspend' : 'Reactivate'} network access for ${client.restaurantName}?`)) return
        setActionLoading(client._id + '_status')
        try {
            const res = await api.put(`/master/clients/${client._id}/toggle-status`)
            notify(res.data.message)
            fetchClients()
        } catch (err) {
            notify('Toggle failed.')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (client) => {
        if (!window.confirm(`⚠ DESTROY ${client.restaurantName}? All tenant data will be permanently wiped from the ProBloom cluster. Continue?`)) return
        try {
            await api.delete(`/master/clients/${client._id}`)
            notify('Tenant annihilated permanently.')
            fetchClients()
        } catch (err) {
            notify('Eradication failed.')
        }
    }

    // handleAddSuccess removed (moved to route transition)

    return (
        <div className="hq-layout">
            <div className="hq-ambient-glow hq-ambient-1"></div>
            <div className="hq-ambient-glow hq-ambient-2"></div>

            {/* ── Top Navbar ── */}
            <nav className="hq-navbar">
                <div className="hq-brand">
                    <div className="hq-logo-icon">{Icons.HQ}</div>
                    <div className="hq-brand-text">
                        <span className="hq-brand-title">ProBloom<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '300' }}>HQ</span></span>
                        <span className="hq-brand-subtitle">License Control Cluster</span>
                    </div>
                </div>
                <div className="hq-nav-actions">
                    <button className="hq-logout-icon-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
                        {theme === 'dark' ? Icons.Sun : Icons.Moon}
                    </button>
                    <div className="hq-admin-pill">
                        <span className="hq-status-dot-active"></span>
                        {user?.name || 'System Admin'}
                    </div>
                    <button className="hq-logout-icon-btn" onClick={logout} title="Sign Out">
                        {Icons.LogOut}
                    </button>
                </div>
            </nav>

            <main className="hq-main">
                <div className="hq-layout-inner">
                    <OfflineLicenseGenerator refreshList={fetchClients} />
                </div>
                {/* ── Metrics Grid ── */}
                <div className="hq-metrics-grid">
                    <div className="hq-metric-card">
                        <div className="hq-metric-icon bg-faded-blue text-blue">{Icons.Users}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val">{stats.total ?? '—'}</div>
                            <div className="hq-metric-label">Nodes Provisioned</div>
                        </div>
                    </div>
                    <div className="hq-metric-card">
                        <div className="hq-metric-icon bg-faded-green text-green">{Icons.CheckCircle}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val">{stats.active ?? '—'}</div>
                            <div className="hq-metric-label">Active Leases</div>
                        </div>
                    </div>
                    <div className="hq-metric-card border-glow-warning">
                        <div className="hq-metric-icon bg-faded-orange text-orange">{Icons.AlertTriangle}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val text-orange">{stats.expiringSoon ?? '—'}</div>
                            <div className="hq-metric-label">Expiring Soon</div>
                        </div>
                    </div>
                    <div className="hq-metric-card border-glow-danger">
                        <div className="hq-metric-icon bg-faded-red text-red">{Icons.Lock}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val text-red">{stats.expired ?? '—'}</div>
                            <div className="hq-metric-label">Locked Out</div>
                        </div>
                    </div>
                    <div className="hq-metric-card">
                        <div className="hq-metric-icon bg-faded-cyan text-cyan">{Icons.Cloud}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val text-cyan">{stats.digital ?? '—'}</div>
                            <div className="hq-metric-label">Cloud Cluster</div>
                        </div>
                    </div>
                    <div className="hq-metric-card border-glow-prime">
                        <div className="hq-metric-icon bg-faded-prime text-prime">{Icons.Key}</div>
                        <div className="hq-metric-content">
                            <div className="hq-metric-val text-prime">{stats.prime ?? '—'}</div>
                            <div className="hq-metric-label">Onprime Offline</div>
                        </div>
                    </div>
                </div>

                {/* ── Control Bar ── */}
                <div className="hq-control-bar">
                    <div className="hq-search-wrapper">
                        {Icons.Search}
                        <input className="hq-search-input" placeholder="Query nodes by name, tenant, or email..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="hq-filters">
                        <select className="hq-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Every State</option>
                            <option value="active">Active State</option>
                            <option value="expiring_soon">Expiring State</option>
                            <option value="expired">Expired State</option>
                        </select>
                        <select className="hq-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="all">Every Service</option>
                            <option value="digital">Cloud Services</option>
                            <option value="prime">Onprime Services</option>
                        </select>
                        <button className="hq-btn hq-btn-glow hq-btn-digital" onClick={() => navigate('/probloom-hq/provision?type=digital')}>
                            {Icons.Cloud} Provision Cloud
                        </button>
                        <button className="hq-btn hq-btn-glow hq-btn-prime" onClick={() => navigate('/probloom-hq/provision?type=prime')}>
                            {Icons.Key} Provision Onprime
                        </button>
                        <button className="hq-btn hq-btn-glow hq-btn-digital" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.4), rgba(245, 158, 11, 0.1))', color: '#fcd34d', borderColor: '#fcd34d' }} onClick={() => navigate('/probloom-hq/maintenance')}>
                            {Icons.AlertTriangle} Configure Maintenance
                        </button>
                    </div>
                </div>

                {/* ── Node Table ── */}
                <div className="hq-table-container">
                    {loading ? (
                        <div className="hq-empty-state">
                            <div className="hq-spinner"></div>
                            <p>Scanning cluster nodes...</p>
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="hq-empty-state">
                            <div className="hq-empty-icon">{Icons.Search}</div>
                            <p>No matching tenants located within the ProBloom cluster.</p>
                        </div>
                    ) : (
                        <table className="hq-data-table">
                            <thead>
                                <tr>
                                    <th>Tenant / Origin</th>
                                    <th>Service Type</th>
                                    <th>Access State</th>
                                    <th>Lease Timebox</th>
                                    <th>Contact Routing</th>
                                    <th className="text-right">Overrides</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(c => {
                                    const days = daysLeft(c.subscription?.expiresAt)
                                    let daysCls = "hq-days-left"
                                    if (days !== null && days <= 7) daysCls += " text-red font-bold"
                                    else if (days !== null && days <= 30) daysCls += " text-orange font-bold"

                                    return (
                                        <tr key={c._id} className={!c.isActive ? 'hq-row-suspended' : ''}>
                                            <td>
                                                <div className="hq-tenant-cell">
                                                    <div className="hq-tenant-name">{c.restaurantName}</div>
                                                    <div className="hq-tenant-sub">{c.email}</div>
                                                    <div style={{ marginTop: '3px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {(() => {
                                                            const limits = getTenantStaffLimits();
                                                            const staffLimit = limits[c.email] || limits[c._id] || c.maxEmployees || 3;
                                                            const devLimit = getTenantDeviceLimit(c);
                                                            return (
                                                                <>
                                                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#d4d4d8', fontWeight: '500' }}>👥 Max {staffLimit} Billers</span>
                                                                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontWeight: '500' }}>📱 Max {devLimit} Devices</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                            <td><LicenseTypeBadge type={c.licenseType} /></td>
                                            <td><StatusBadge client={c} /></td>
                                            <td>
                                                <div className="hq-expiry-cell">
                                                    <div className="hq-expiry-date">{formatDate(c.subscription?.expiresAt)}</div>
                                                    {days !== null && (
                                                        <div className={daysCls}>
                                                            {days < 0 ? `Terminated ${Math.abs(days)}d ago` : `T-minus ${days} days`}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td><span className="hq-text-muted">{c.phone || '—'}</span></td>
                                            <td>
                                                <div className="hq-action-stack">
                                                    <button className="hq-act-btn hq-btn-renew" onClick={() => handleRenew(c)} disabled={actionLoading === c._id + '_renew'} title="Extend lease +1 Year">
                                                        {actionLoading === c._id + '_renew' ? <span className="hq-spinner hq-spinner-sm" /> : Icons.Refresh} Extension
                                                    </button>
                                                    {c.licenseType === 'prime' && (
                                                        <button className="hq-act-btn hq-btn-prime" onClick={() => setModal({ type: 'offline-gen', client: c })} title="Generate Hardware-Bound Offline License">
                                                            {Icons.Key} Offline Lic
                                                        </button>
                                                    )}
                                                    <button className="hq-act-btn hq-btn-suspend" onClick={() => handleToggleStatus(c)} disabled={actionLoading === c._id + '_status'} title="Toggle network killswitch">
                                                        {actionLoading === c._id + '_status' ? <span className="hq-spinner hq-spinner-sm" /> : c.isActive ? Icons.Ban : Icons.CheckCircle}
                                                        {c.isActive ? 'Kill' : 'Restore'}
                                                    </button>
                                                    <button className="hq-act-btn hq-btn-outline" onClick={() => setDetailsModal(c)} title="Seek Customer Details">
                                                        {Icons.Eye} Details
                                                    </button>
                                                    <button className="hq-act-btn hq-btn-delete" onClick={() => handleDelete(c)} title="Permanent Data Eradication">
                                                        {Icons.Trash}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="hq-footer-bar">
                    <span className="hq-pulse-dot"></span> Cluster running normally • Tracking {clients.length} nodes
                </div>
            </main>

            {/* ── Modals & Toasts ── */}
            {modal?.type === 'license' && <LicenseModal client={modal.client} licenseKey={modal.key} onClose={() => setModal(null)} />}
            {modal?.type === 'offline-gen' && (
                <div className="hq-modal-overlay" onClick={() => setModal(null)}>
                    <div className="hq-modal hq-modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="hq-modal-header border-bottom">
                            <h3 className="hq-modal-title"><span>{Icons.Key} Generate Offline License</span></h3>
                            <p className="hq-text-muted">Target Customer: <strong>{modal.client.restaurantName}</strong></p>
                        </div>
                        <div className="hq-modal-body">
                            <OfflineLicenseGenerator clientOverride={modal.client} onComplete={() => setModal(null)} refreshList={fetchClients} />
                        </div>
                    </div>
                </div>
            )}
            {detailsModal && <ClientDetailsModal client={detailsModal} onClose={() => setDetailsModal(null)} />}

            {toast && (
                <div className="hq-notification-toast">
                    <div className="hq-toast-icon">{Icons.CheckCircle}</div>
                    <div className="hq-toast-msg">{toast}</div>
                </div>
            )}
        </div>
    )
}
