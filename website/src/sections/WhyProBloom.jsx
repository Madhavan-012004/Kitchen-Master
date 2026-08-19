import { useRef, useEffect, useState } from 'react'
import './WhyProBloom.css'

const EDGES = [
  {
    icon: '💼',
    tag: 'Versatility',
    title: 'Multi-Vertical POS Engine',
    desc: 'Switch effortlessly between Restaurant, Poultry, Fashion Retail, Tailoring, Distributor Wholesale, or Supermarket mode with tailored billing, units, and stock workflows.',
    highlight: 'One platform for every business type.',
  },
  {
    icon: '⚡',
    tag: 'Performance',
    title: 'Lightning-Fast Offline Mode',
    desc: "Bills keep printing, orders keep flowing, and data keeps syncing — even when your internet dies. ProBloom's offline-first engine ensures zero downtime, ever.",
    highlight: 'Zero downtime. Zero excuses.',
  },
  {
    icon: '🧠',
    tag: 'Intelligence',
    title: 'AI-Powered Business Insights',
    desc: "Not just charts — actual recommendations. ProBloom's analytics engine flags slow movers, predicts peak hours, and tells you what to buy before you run out.",
    highlight: 'Your smartest employee.',
  },
  {
    icon: '🔄',
    tag: 'Connectivity',
    title: 'True Omni-Channel Sync',
    desc: 'Web POS, Android captain app, iOS billing, kitchen display — all speak the same language in real-time. Change a menu item once; it updates everywhere instantly.',
    highlight: 'One truth. Every device.',
  },
  {
    icon: '💸',
    tag: 'Value',
    title: 'Honest, Transparent Pricing',
    desc: 'No percentage-of-sales cuts. No hardware lock-in. No hidden AMC fees. Just flat, predictable pricing that scales with your growth — not against it.',
    highlight: 'You keep what you earn.',
  },
  {
    icon: '🔒',
    tag: 'Security',
    title: 'Bank-Grade Data Security',
    desc: 'Your revenue data, customer info, and inventory lives on encrypted, privately hosted infrastructure. GDPR-aligned. Role-based access. Audit trails on everything.',
    highlight: 'Your data, your fortress.',
  },
  {
    icon: '🛠️',
    tag: 'Support',
    title: '24×7 Dedicated Support',
    desc: "You're not a ticket number. Every ProBloom merchant gets a dedicated account manager, live chat, and a direct escalation line — because your business won't wait.",
    highlight: 'A partner, not a vendor.',
  },
]

function EdgeCard({ edge, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`why__card glass-card ${visible ? 'why__card--visible' : ''}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="why__card-top">
        <div className="why__card-icon">{edge.icon}</div>
        <span className="why__card-tag">{edge.tag}</span>
      </div>
      <h3 className="why__card-title">{edge.title}</h3>
      <p className="why__card-desc">{edge.desc}</p>
      <div className="why__card-highlight">
        <span className="why__card-highlight-dot" />
        {edge.highlight}
      </div>
    </div>
  )
}

export default function WhyProBloom() {
  return (
    <section className="why section" id="why">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>⚔️</span> The ProBloom Edge
          </div>
          <h2 className="section-title">
            Why Thousands Choose <br />
            <span className="glow-line">ProBloom Over Others</span>
          </h2>
          <p className="section-subtitle">
            The market is full of software. But ProBloom is built differently —
            obsessively engineered for growing Indian businesses that need reliability, speed, and intelligence.
          </p>
        </div>

        <div className="why__grid">
          {EDGES.map((edge, i) => (
            <EdgeCard key={edge.title} edge={edge} index={i} />
          ))}
        </div>

        <div className="why__bottom-banner glass-card">
          <div className="why__bottom-text">
            <h3>Still on the fence?</h3>
            <p>Join 10,000+ businesses that switched to ProBloom and never looked back.</p>
          </div>
          <button
            className="btn-primary"
            onClick={() => document.querySelector('#get-started')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Start Your Free Trial
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </section>
  )
}
