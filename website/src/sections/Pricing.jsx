import { useState } from 'react'
import './Pricing.css'

const PLANS = [
  {
    id: 'starter',
    name: '1-Month Trial',
    price: '0',
    billing: 'Standard Duration',
    tagline: 'Experience ProBloom risk-free.',
    color: '#9ca3af',
    features: [
      'Full access for 30 days',
      'Up to 1 outlet',
      '1 Counter POS (Web)',
      'Basic billing & KOT printing',
      'Unlimited menu items',
      'Basic inventory tracking',
      'Onboarding Support',
    ],
    cta: 'Start Your Trial',
    popular: false,
  },
  {
    id: 'business',
    name: 'Business',
    price: '7,199',
    originalPrice: '8,499',
    billing: '12 Months Access',
    tagline: 'Complete automation for your outlet.',
    color: '#C6F53D',
    features: [
      'Special: Pay for 10 Months Only',
      'Full 1 Year Subscription',
      '₹8,499 Annual Renewal',
      'Valid for 1 Outlet',
      'Unlimited POS logins',
      'Captain & Waiter mobile app',
      'Kitchen Display System (KDS)',
      'Advanced inventory + recipe costing',
      'AI analytics & reports',
      'Priority support (24×7)',
    ],
    cta: 'Claim 10-Month Offer',
    popular: true,
  },
  {
    id: 'duo',
    name: 'Business Duo',
    price: '12,999',
    originalPrice: '14,999',
    billing: '12 Months Access',
    tagline: 'Perfect for managing 2 locations.',
    color: '#a78bfa',
    features: [
      'Special 1-Year Bundle',
      'Valid for 2 Outlets (Layouts)',
      '₹14,999 Annual Renewal',
      'Manage multiple locations',
      'Everything in Business Plan',
      'Multi-outlet Consolidated View',
      'Central Menu Management',
      'Priority Support (24×7)',
      'Advanced API Access',
    ],
    cta: 'Claim Duo Savings',
    popular: false,
  },
]

export default function Pricing() {

  const handleCta = (plan) => {
    if (plan.id === 'premium') {
      window.location.href = 'mailto:admin.probloom@gmail.com?subject=Premium Elite Inquiry'
    } else {
      document.querySelector('#get-started')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="pricing section" id="pricing">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>💸</span> Pricing
          </div>
          <h2 className="section-title">
            Simple, Honest <br />
            <span className="glow-line">Pricing For Every Scale</span>
          </h2>
          <p className="section-subtitle">
            No percentage cuts on your revenue. No hidden fees. Cancel anytime.
            Plans that grow with your business, not against it.
          </p>
        </div>

        <div className="pricing__grid">
          {PLANS.map(plan => {
            return (
              <div
                key={plan.id}
                className={`pricing__card glass-card ${plan.popular ? 'pricing__card--popular' : ''}`}
                style={{ '--plan-color': plan.color }}
              >
                {plan.popular && (
                  <div className="pricing__popular-badge">⭐ Most Popular</div>
                )}
                <div className="pricing__plan-name" style={{ color: plan.color }}>
                  {plan.name}
                </div>
                <p className="pricing__tagline">{plan.tagline}</p>

                <div className="pricing__price">
                  <div className="pricing__price-main">
                    <span className="pricing__price-currency">₹</span>
                    <span className="pricing__price-value">
                      {plan.price}
                    </span>
                  </div>
                  {plan.originalPrice && (
                    <span className="pricing__price-original">
                      ₹{plan.originalPrice}
                    </span>
                  )}
                  <span className="pricing__price-period">
                    {plan.billing}
                  </span>
                </div>

                <ul className="pricing__features">
                  {plan.features.map(feat => (
                    <li key={feat} className="pricing__feature">
                      <span className="pricing__feature-check" style={{ color: plan.color }}>✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>

                <button
                  className="pricing__cta"
                  style={{
                    background: plan.popular ? plan.color : 'transparent',
                    color: plan.popular ? '#000' : plan.color,
                    border: plan.popular ? 'none' : `1.5px solid ${plan.color}`,
                  }}
                  onClick={() => handleCta(plan)}
                >
                  {plan.cta}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            )
          })}
        </div>

        <p className="pricing__note">
          All plans include a 30-day free trial. No credit card required to start.
          GST will be applied as per applicable rates.
        </p>
      </div>
    </section>
  )
}
