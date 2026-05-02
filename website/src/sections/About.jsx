import './About.css'

const ECOSYSTEM_ITEMS = [
  {
    icon: '🖥️',
    title: 'Web POS',
    desc: 'Full-featured counter billing from any browser. No installation required.',
  },
  {
    icon: '📱',
    title: 'Captain App',
    desc: 'Android & iOS app for waiters to take orders tableside—directly to the kitchen.',
  },
  {
    icon: '🍳',
    title: 'Kitchen Display',
    desc: 'Real-time KDS so your kitchen never misses an order or forgets modifiers.',
  },
  {
    icon: '📦',
    title: 'Inventory Suite',
    desc: 'Track raw materials, set alerts, and manage supplier purchases effortlessly.',
  },
  {
    icon: '📈',
    title: 'AI Analytics',
    desc: 'Smart insights on your sales, waste, and profits—no spreadsheets needed.',
  },
  {
    icon: '👥',
    title: 'Staff & Attendance',
    desc: 'Manage staff roles, shifts, and track attendance—all in one place.',
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
            More Than a POS — It's a <br />
            <span className="glow-line">Living Ecosystem</span>
          </h2>
          <p className="section-subtitle">
            ProBloom is the command centre for your entire food or retail operation.
            From the first order to midnight stock count, every piece works in perfect symphony.
          </p>
        </div>

        {/* Story block */}
        <div className="about__story glass-card">
          <div className="about__story-content">
            <h3 className="about__story-title">Built from the kitchen floor up.</h3>
            <p>
              ProBloom was born from a real problem: restaurant owners juggling five different apps,
              losing data, missing orders, and still guessing their profitability at month-end.
              We rebuilt the whole stack from scratch — a unified, real-time, cloud-synced powerhouse
              that works online, offline, and every mode in between.
            </p>
            <p>
              Whether you run a fine-dining restaurant, a cloud kitchen chain, a fast-food outlet,
              or a neighbourhood supermarket — ProBloom molds itself to your business model, not the other way around.
            </p>
          </div>
          <div className="about__story-stats">
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
