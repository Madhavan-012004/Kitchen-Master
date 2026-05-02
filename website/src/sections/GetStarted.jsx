import { useState } from 'react'
import './GetStarted.css'

const BUSINESS_TYPES = [
  'Restaurant / Dine-In',
  'Cloud Kitchen',
  'Café / Bakery',
  'Fast Food / QSR',
  'Bar / Lounge',
  'Hotel / Resort',
  'Supermarket / Grocery',
  'Retail Store',
  'Other',
]

const PLANS = [
  { label: '1-Month Trial', price: '₹0' },
  { label: 'Business', price: '₹7,199*' },
  { label: 'Business Duo', price: '₹12,999*' },
]

const OUTLETS = ['1', '2–5', '6–10', '10–25', '25+']

export default function GetStarted({ onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    restaurantName: '',
    phone: '',
    address: '',
    businessType: '',
    plan: '',
    outlets: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.match(/^\S+@\S+\.\S+$/)) errs.email = 'Valid email required'
    if (form.password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (!form.restaurantName.trim()) errs.restaurantName = 'Business name is required'
    if (!form.phone.match(/^[6-9]\d{9}$/)) errs.phone = 'Valid 10-digit Indian mobile number required'
    if (!form.businessType) errs.businessType = 'Please select your business type'
    if (!form.plan) errs.plan = 'Please choose a plan'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        restaurantName: form.restaurantName,
        phone: form.phone,
        address: form.address,
        businessType: form.businessType,
        requestedPlan: form.plan,
        outletsCount: form.outlets,
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Registration failed')
      onSuccess({
        name: form.name,
        email: form.email,
        businessName: form.restaurantName,
        plan: form.plan,
        token: data.data?.token,
      })
      setForm({
        name: '', email: '', password: '', restaurantName: '',
        phone: '', address: '', businessType: '', plan: '', outlets: '',
      })
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="get-started section" id="get-started">
      <div className="container">
        <div className="get-started__inner">
          {/* Left Side */}
          <div className="get-started__left">
            <div className="section-label">
              <span>🚀</span> Get Started Today
            </div>
            <h2 className="section-title">
              Your Business Deserves <br />
              <span className="glow-line">Better Software.</span>
            </h2>
            <p className="section-subtitle" style={{ marginBottom: '32px' }}>
              Fill in your details below. We'll set up your ProBloom account instantly
              and send you login credentials. No waiting, no sales calls, no nonsense.
            </p>

            <div className="get-started__perks">
              {[
                { icon: '⚡', text: 'Account ready in under 60 seconds' },
                { icon: '🔑', text: 'Login credentials sent to your email' },
                { icon: '📱', text: 'Download apps on any device immediately' },
                { icon: '🆓', text: '1-Month unrestricted trial — no card needed' },
                { icon: '🛎️', text: 'Dedicated onboarding support included' },
              ].map(p => (
                <div key={p.text} className="get-started__perk">
                  <span className="get-started__perk-icon">{p.icon}</span>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side — Form */}
          <div className="get-started__form-wrap glass-card">
            <h3 className="get-started__form-title">
              Create Your ProBloom Account
            </h3>

            {apiError && (
              <div className="get-started__api-error">
                ⚠️ {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="get-started__form" id="registration-form">
              <div className="get-started__row">
                <div className="get-started__field">
                  <label htmlFor="gs-name">Your Full Name *</label>
                  <input
                    id="gs-name"
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={set('name')}
                    className={errors.name ? 'error' : ''}
                    autoComplete="name"
                  />
                  {errors.name && <span className="get-started__error">{errors.name}</span>}
                </div>
                <div className="get-started__field">
                  <label htmlFor="gs-phone">Mobile Number *</label>
                  <input
                    id="gs-phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={form.phone}
                    onChange={set('phone')}
                    className={errors.phone ? 'error' : ''}
                    autoComplete="tel"
                  />
                  {errors.phone && <span className="get-started__error">{errors.phone}</span>}
                </div>
              </div>

              <div className="get-started__field">
                <label htmlFor="gs-email">Email Address *</label>
                <input
                  id="gs-email"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={set('email')}
                  className={errors.email ? 'error' : ''}
                  autoComplete="email"
                />
                {errors.email && <span className="get-started__error">{errors.email}</span>}
              </div>

              <div className="get-started__field">
                <label htmlFor="gs-password">Set Password *</label>
                <input
                  id="gs-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={set('password')}
                  className={errors.password ? 'error' : ''}
                  autoComplete="new-password"
                />
                {errors.password && <span className="get-started__error">{errors.password}</span>}
              </div>

              <div className="get-started__field">
                <label htmlFor="gs-restaurant">Restaurant / Business Name *</label>
                <input
                  id="gs-restaurant"
                  type="text"
                  placeholder="e.g. Biryani Kingdom"
                  value={form.restaurantName}
                  onChange={set('restaurantName')}
                  className={errors.restaurantName ? 'error' : ''}
                />
                {errors.restaurantName && <span className="get-started__error">{errors.restaurantName}</span>}
              </div>

              <div className="get-started__row">
                <div className="get-started__field">
                  <label htmlFor="gs-type">Business Type *</label>
                  <select
                    id="gs-type"
                    value={form.businessType}
                    onChange={set('businessType')}
                    className={errors.businessType ? 'error' : ''}
                  >
                    <option value="">Select type...</option>
                    {BUSINESS_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.businessType && <span className="get-started__error">{errors.businessType}</span>}
                </div>
                <div className="get-started__field">
                  <label htmlFor="gs-outlets">Number of Outlets</label>
                  <select
                    id="gs-outlets"
                    value={form.outlets}
                    onChange={set('outlets')}
                  >
                    <option value="">Select...</option>
                    {OUTLETS.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="get-started__field">
                <label htmlFor="gs-plan">Choose Your Plan *</label>
                <div className="get-started__plan-group">
                  {PLANS.map(p => (
                    <div
                      key={p.label}
                      className={`get-started__plan-option ${form.plan === p.label ? 'selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, plan: f.plan === p.label ? '' : p.label }))}
                    >
                      <span className="get-started__plan-name">{p.label}</span>
                      <span className="get-started__plan-price">{p.price}</span>
                    </div>
                  ))}
                </div>
                <p className="get-started__offer-note">* Business: ₹7,199 (Renew ₹8,499). Duo: ₹12,999 (Renew ₹14,999). All prices per outlet/year.</p>
                {errors.plan && <span className="get-started__error">{errors.plan}</span>}
              </div>

              <div className="get-started__field">
                <label htmlFor="gs-address">Business Address</label>
                <input
                  id="gs-address"
                  type="text"
                  placeholder="Full address (optional)"
                  value={form.address}
                  onChange={set('address')}
                  autoComplete="street-address"
                />
              </div>

              <button
                type="submit"
                className={`btn-primary get-started__submit ${loading ? 'loading' : ''}`}
                disabled={loading}
                id="submit-registration"
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Setting Up Your Account…
                  </>
                ) : (
                  <>
                    Get ProBloom Now — Start Trial
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>

              <p className="get-started__disclaimer">
                By registering, you agree to our <a href="#" className="get-started__link">Terms of Service</a> and <a href="#" className="get-started__link">Privacy Policy</a>.
                Your data is encrypted and never shared.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
