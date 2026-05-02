import './DownloadHub.css'

export default function DownloadHub() {
  return (
    <section className="download section" id="download">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>📲</span> Download ProBloom
          </div>
          <h2 className="section-title">
            Your Business, On Every <br />
            <span className="glow-line">Screen & Device</span>
          </h2>
          <p className="section-subtitle">
            ProBloom runs everywhere your business needs it to. Same account,
            same data — perfectly synced across all your devices, always.
          </p>
        </div>

        <div className="download__grid">
          {/* Web App */}
          <div className="download__card glass-card download__card--featured">
            <div className="download__card-badge">Most Popular</div>
            <div className="download__card-icon">🌐</div>
            <h3 className="download__card-title">Web Application</h3>
            <p className="download__card-desc">
              The full ProBloom experience in your browser. Counter billing, table management, analytics dashboards, and admin controls — no installation required.
            </p>
            <ul className="download__card-specs">
              <li>✓ Works on Chrome, Firefox, Edge, Safari</li>
              <li>✓ Optimized for tablets and large screens</li>
              <li>✓ Auto-updates — always on latest version</li>
              <li>✓ Offline-capable service worker</li>
            </ul>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="btn-primary download__btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open Web App
            </a>
          </div>

          {/* Android */}
          <div className="download__card glass-card">
            <div className="download__card-icon">📱</div>
            <h3 className="download__card-title">Android App</h3>
            <p className="download__card-desc">
              The ProBloom captain & waiter app for Android. Take orders tableside, view live kitchen status, and print bills — all from your Android phone or tablet.
            </p>
            <ul className="download__card-specs">
              <li>✓ Android 8.0 and above</li>
              <li>✓ Works on phone & tablet</li>
              <li>✓ Bluetooth & WiFi printing</li>
              <li>✓ Biometric attendance tracking</li>
            </ul>
            <button className="btn-primary download__btn download__btn--android">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.342c-.346 0-.622.277-.622.629v4.705c0 .347.276.624.622.624.347 0 .623-.277.623-.624v-4.705c0-.352-.276-.629-.623-.629zm-11.046 0c-.346 0-.622.277-.622.629v4.705c0 .347.276.624.622.624.347 0 .623-.277.623-.624v-4.705c0-.352-.276-.629-.623-.629zM16.5 9l1.567-2.836a.315.315 0 0 0-.13-.427.318.318 0 0 0-.43.13L15.93 8.7A7.826 7.826 0 0 0 12 7.832a7.826 7.826 0 0 0-3.93.868L6.494 5.867a.318.318 0 0 0-.43-.13.315.315 0 0 0-.13.427L7.5 9C5.945 10.005 4.8 11.724 4.8 13.8h14.4c0-2.076-1.145-3.795-2.7-4.8zm-6.5 2.4h-1.2v-1.2H10v1.2zm4.2 0h-1.2v-1.2h1.2v1.2zM4.8 14.4v5.226c0 .758.615 1.374 1.374 1.374h.624V23h1.245v-1.974h3.914V23h1.245v-1.974h.624c.759 0 1.374-.616 1.374-1.374V14.4H4.8z"/></svg>
              Download for Android
            </button>
            <p className="download__card-note">APK v2.4.1 · 18.6MB</p>
          </div>

          {/* iOS */}
          <div className="download__card glass-card">
            <div className="download__card-icon">🍎</div>
            <h3 className="download__card-title">iOS App</h3>
            <p className="download__card-desc">
              Native iOS experience built for iPhone and iPad. Smooth, fast, and beautifully integrated with Apple ecosystem for the ultimate tableside ordering experience.
            </p>
            <ul className="download__card-specs">
              <li>✓ iOS 14 and above</li>
              <li>✓ iPhone & iPad optimized</li>
              <li>✓ AirPrint support</li>
              <li>✓ Face ID authentication</li>
            </ul>
            <button className="btn-primary download__btn download__btn--ios">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Download for iOS
            </button>
            <p className="download__card-note">App Store · Requires iOS 14+</p>
          </div>
        </div>

        {/* Platform badge strip */}
        <div className="download__platform-strip">
          <span>Available on:</span>
          {['Chrome', 'Firefox', 'Safari', 'Android', 'iOS', 'Windows', 'macOS'].map(p => (
            <span key={p} className="download__platform-badge">{p}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
