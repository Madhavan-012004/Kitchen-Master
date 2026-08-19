import './About.css'

const ECOSYSTEM_ITEMS = [
  {
    icon: '🍽️',
    title: 'Restaurant & Dining POS',
    desc: 'Table management, captain waiter app, kitchen displays (KDS), split bills & KOT routing.',
  },
  {
    icon: '🐔',
    title: 'Poultry & Meat POS',
    desc: 'Live bird weight-based billing, daily market rate updates, client ledgers & purchase tracking.',
  },
  {
    icon: '👗',
    title: 'Clothing & Fashion POS',
    desc: 'Garment stock management, size/color variant matrix, barcode tag scanning & intake.',
  },
  {
    icon: '✂️',
    title: 'Tailoring & Job Card POS',
    desc: 'Customer measurement recording, token lookup, stitching-to-delivery order lifecycle.',
  },
  {
    icon: '🚚',
    title: 'Distributor Mobile POS',
    desc: 'Handheld route sales billing, high-density touch layout, storage location stock filters.',
  },
  {
    icon: '🛒',
    title: 'Supermarket & Retail POS',
    desc: 'Ultra-fast barcode checkout, raw material tracking, expiry alerts & production batching.',
  },
  {
    icon: '📦',
    title: 'Smart Inventory Engine',
    desc: 'Auto-deduction on orders, recipe costing, low stock alerts & automated supplier orders.',
  },
  {
    icon: '📊',
    title: 'AI Analytics & Compliance',
    desc: 'Smart revenue insights, expenditure tracking, staff performance & GSTR-1 ready reports.',
  },
]

export default function About() {
  return (
    <section className="about section" id="about">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>🌿</span> About ProBloom
          </div>
          <h2 className="section-title">
            One Engine — Multiple Industry <br />
            <span className="glow-line">POS Verticals & Ecosystem</span>
          </h2>
          <p className="section-subtitle">
            ProBloom is the unified command centre engineered for restaurants, poultry outlets, fashion retail,
            custom tailoring, wholesale distribution, and supermarkets.
          </p>
        </div>

        {/* Story block */}
        <div className="about__story glass-card">
          <div className="about__story-content">
            <h3 className="about__story-title">Built from the ground up for every business vertical.</h3>
            <p>
              ProBloom was created to solve a major problem: business owners juggling incompatible software,
              losing stock tracking, struggling with specialized billing, and guessing month-end profits.
              We built a unified, multi-POS engine that works online, offline, and adapts to your exact industry.
            </p>
            <p>
              Whether you run a dine-in restaurant, poultry wholesale hub, apparel boutique, tailoring unit,
              distributor van network, or neighbourhood supermarket — ProBloom provides dedicated workflows
              tailored to your operational needs.
            </p>
          </div>
          <div className="about__story-stats">
            <div className="about__story-stat">
              <div className="about__story-stat-value">6+</div>
              <div className="about__story-stat-label">Specialized POS Types</div>
            </div>
            <div className="about__story-stat">
              <div className="about__story-stat-value">10K+</div>
              <div className="about__story-stat-label">Active Outlets</div>
            </div>
            <div className="about__story-stat">
              <div className="about__story-stat-value">₹500Cr+</div>
              <div className="about__story-stat-label">Revenue Processed</div>
            </div>
            <div className="about__story-stat">
              <div className="about__story-stat-value">99.9%</div>
              <div className="about__story-stat-label">Uptime SLA</div>
            </div>
          </div>
        </div>

        {/* Ecosystem grid */}
        <div className="about__grid">
          {ECOSYSTEM_ITEMS.map((item) => (
            <div key={item.title} className="about__item glass-card">
              <div className="about__item-icon">{item.icon}</div>
              <h4 className="about__item-title">{item.title}</h4>
              <p className="about__item-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

