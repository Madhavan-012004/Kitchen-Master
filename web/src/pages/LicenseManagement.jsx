import React, { useState, useEffect, useCallback } from 'react';
import './LicenseManagement.css';
import api from '../api/client.js';

// ── Icons (inline SVG) ────────────────────────────────────────────────────────
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 17 12 21 16 17" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ── Helper ────────────────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

function getBadgeClass(status, daysLeft) {
  if (!status) return 'missing';
  if (status === 'ACTIVE' && daysLeft != null && daysLeft <= 30) return 'warning';
  switch (status) {
    case 'ACTIVE': return 'active';
    case 'EXPIRED': return 'expired';
    case 'MISSING': return 'missing';
    default: return 'invalid';
  }
}

function getBadgeText(status, daysLeft, message) {
  if (status === 'ACTIVE') {
    if (daysLeft != null && daysLeft <= 30) return `⚠ Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    return '✓ License Active';
  }
  if (status === 'EXPIRED') return 'License Expired';
  if (status === 'MISSING') return 'No License Found';
  return message || 'License Invalid';
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LicenseManagement() {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // { success, message }
  const [generatingRequest, setGeneratingRequest] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Fetch license status on mount
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/license/status');
      setLicenseStatus(res.data);
    } catch (err) {
      setLicenseStatus({
        valid: false,
        status: 'MISSING',
        message: 'Unable to reach the backend server.',
        hardwareId: 'UNKNOWN'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Generate and download machine.req
  const handleGenerateRequest = async () => {
    setGeneratingRequest(true);
    try {
      const res = await api.post('/license/generate-request', {});
      const requestData = res.data.requestData;
      const blob = new Blob([JSON.stringify(requestData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'machine.req';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate request: ' + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingRequest(false);
    }
  };

  // Upload license file
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await api.post('/license/upload', formData);
      setUploadResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) {
        // Refresh license status
        setLicenseStatus(res.data.status);
        setUploadFile(null);
      }
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Upload failed. Please try again.'
      });
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.lic')) {
      setUploadFile(file);
      setUploadResult(null);
    } else {
      alert('Please drop a valid .lic file.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const badgeClass = licenseStatus
    ? getBadgeClass(licenseStatus.status, licenseStatus.daysLeft)
    : 'missing';

  return (
    <div className="license-page">
      <div className="license-card">

        {/* Header */}
        <div className="license-header">
          <div className="license-logo"><ShieldIcon /></div>
          <h1>ProBloom License</h1>
          <p>Offline activation powered by ProBloom HQ</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="license-loading">
            <div className="license-spinner" />
            <span style={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.9rem' }}>Checking license status...</span>
          </div>
        )}

        {!loading && licenseStatus && (
          <>
            {/* Status Badge */}
            <div className={`license-status-badge ${badgeClass}`}>
              <span className={`status-dot ${badgeClass}`} />
              <span>{getBadgeText(licenseStatus.status, licenseStatus.daysLeft, licenseStatus.message)}</span>
            </div>

            {/* Info Grid */}
            <div className="license-info-grid">
              <div className="license-info-item">
                <div className="info-label">Hardware ID</div>
                <div className="info-value" style={{ fontSize: '0.78rem' }}>
                  {licenseStatus.hardwareId || '—'}
                </div>
              </div>
              <div className="license-info-item">
                <div className="info-label">Status</div>
                <div className={`info-value ${licenseStatus.valid ? 'healthy' : ''}`}>
                  {licenseStatus.status || 'UNKNOWN'}
                </div>
              </div>
              {licenseStatus.issuedAt && (
                <div className="license-info-item">
                  <div className="info-label">Issued On</div>
                  <div className="info-value">{formatDate(licenseStatus.issuedAt)}</div>
                </div>
              )}
              {licenseStatus.expiresAt && (
                <div className="license-info-item">
                  <div className="info-label">Expires On</div>
                  <div className={`info-value ${licenseStatus.daysLeft != null && licenseStatus.daysLeft <= 30 ? 'expiring-soon' : ''}`}>
                    {formatDate(licenseStatus.expiresAt)}
                  </div>
                </div>
              )}
              {licenseStatus.daysLeft != null && (
                <div className="license-info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="info-label">Days Remaining</div>
                  <div className={`info-value ${licenseStatus.daysLeft <= 30 ? 'expiring-soon' : 'healthy'}`}>
                    {licenseStatus.daysLeft} day{licenseStatus.daysLeft !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>

            <hr className="license-divider" />

            {/* === Step 1: Generate Machine Request === */}
            <p className="license-section-title">Step 1 — Generate License Request</p>
            <div className="license-steps" style={{ marginBottom: '1.5rem' }}>
              <div className="license-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Download your Machine Request file</h4>
                  <p>This file contains your unique Hardware ID. Email it to ProBloom HQ to receive your license.</p>
                </div>
              </div>
              <div className="license-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Send to ProBloom HQ</h4>
                  <p>Email the <code>machine.req</code> file to <strong>support@probloom.in</strong> with your business name.</p>
                </div>
              </div>
              <div className="license-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Upload the license file below</h4>
                  <p>ProBloom HQ will send you a <code>license.lic</code> file. Upload it here to activate your system.</p>
                </div>
              </div>
            </div>

            <button
              id="btn-generate-request"
              className="btn-license-secondary"
              onClick={handleGenerateRequest}
              disabled={generatingRequest}
              style={{ marginBottom: '1.5rem' }}
            >
              <DownloadIcon />
              {generatingRequest ? 'Generating...' : 'Download machine.req File'}
            </button>

            <hr className="license-divider" />

            {/* === Step 2: Upload License === */}
            <p className="license-section-title">Step 2 — Upload License File</p>

            <div
              className={`license-upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                id="license-file-input"
                type="file"
                accept=".lic"
                onChange={(e) => {
                  setUploadFile(e.target.files[0] || null);
                  setUploadResult(null);
                }}
              />
              <div className="upload-icon"><UploadIcon /></div>
              <h4>Drop your license.lic file here</h4>
              <p>or click to browse</p>
              {uploadFile && <div className="upload-filename">📄 {uploadFile.name}</div>}
            </div>

            {uploadResult && (
              <div className={`license-alert ${uploadResult.success ? 'success' : 'error'}`}>
                {uploadResult.success ? '✓ ' : '✗ '}{uploadResult.message}
              </div>
            )}

            <div className="license-actions" style={{ marginTop: '1rem' }}>
              <button
                id="btn-upload-license"
                className="btn-license-primary"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
              >
                <ShieldIcon />
                {uploading ? 'Activating License...' : 'Activate License'}
              </button>

              <button
                id="btn-refresh-status"
                className="btn-license-secondary"
                onClick={fetchStatus}
              >
                Refresh Status
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="license-footer">
          ProBloom ProBloom · Offline Edition<br />
          For support, contact{' '}
          <a href="mailto:support@probloom.in">support@probloom.in</a>
        </div>
      </div>
    </div>
  );
}
