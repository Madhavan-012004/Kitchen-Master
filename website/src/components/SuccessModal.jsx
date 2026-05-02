import './SuccessModal.css'

export default function SuccessModal({ data, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Registration Success">
      <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-confetti" aria-hidden="true">
          {['🎉', '🌿', '✅', '🚀', '💚', '⭐'].map((e, i) => (
            <span key={i} className="confetti-emoji" style={{ animationDelay: `${i * 0.1}s`, left: `${10 + i * 14}%` }}>{e}</span>
          ))}
        </div>
        <div className="modal-icon">⏳</div>
        <h2 className="modal-title">Registration Received, {data.name}!</h2>
        <p className="modal-subtitle">
          Your request for <strong>{data.businessName}</strong> has been sent to our verification team. 
          We'll review your details and activate your account shortly.
        </p>

        <div className="modal-plan-badge">
          {data.plan} — Verification Pending
        </div>

        <div className="modal-steps">
          <div className="modal-step">
            <div className="modal-step-num">1</div>
            <div className="modal-step-text">
              <strong>Admin Verification</strong>
              <span>Our team is reviewing your business details...</span>
            </div>
          </div>
          <div className="modal-step">
            <div className="modal-step-num">2</div>
            <div className="modal-step-text">
              <strong>Receive Credentials</strong>
              <span>Activation details will be sent to <strong>{data.email}</strong> once approved.</span>
            </div>
          </div>
          <div className="modal-step">
            <div className="modal-step-num">3</div>
            <div className="modal-step-text">
              <strong>Instant Access</strong>
              <span>You'll get full access to the ProBloom Cloud once verified!</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <a
            href="https://localhost:5173/login"
            target="_blank"
            rel="noreferrer"
            className="btn-primary modal-cta"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open ProBloom Dashboard
          </a>
          <button className="btn-secondary modal-close" onClick={onClose}>
            Back to Home
          </button>
        </div>

        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  )
}
