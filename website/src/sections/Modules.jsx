import { useState } from 'react'
import './Modules.css'

const POS_VERTICALS = [
  {
    id: 'restaurant-pos',
    type: 'vertical',
    icon: '🍽️',
    title: 'Restaurant & Dining POS',
    tagline: 'End-to-end food service & dining management.',
    color: '#C6F53D',
    features: [
      'Table layout management with real-time status',
      'Split bills, merged tables & custom discounts',
      'Category-based KOT routing (Kitchen, Bar, Grill)',
      'Captain & Waiter mobile app tableside ordering',
      'Takeaway, dine-in & online delivery order sync',
      'Offline billing with auto-cloud sync',
    ],
  },
  {
    id: 'poultry-pos',
    type: 'vertical',
    icon: '🐔',
    title: 'Poultry & Meat POS',
    tagline: 'Specialized weight & live bird billing engine.',
    color: '#f59e0b',
    features: [
      'Live bird weight-based billing with auto calculations',
      'Daily market price management (Live/Dressed rate)',
      'Client ledger & supplier account tracking',
      'Batch flock numbers & purchase detail logging',
      'Dual-sync payment status (Paid / Pending)',
      'Fast scales integration & thermal receipt printing',
    ],
  },
  {
    id: 'clothing-pos',
    type: 'vertical',
    icon: '👗',
    title: 'Clothing & Fashion Retail POS',
    tagline: 'Multi-variant apparel & barcode management.',
    color: '#ec4899',
    features: [
      'Size, color, style & fabric variant matrix',
      'Rapid barcode tag generation & barcode scanning',
      'Stock intake, transfer & warehouse tracking',
      'Sales performance by brand & category',
      'Fast counter checkout & receipt printing',
      'Returns & exchange management workflow',
    ],
  },
  {
    id: 'tailoring-pos',
    type: 'vertical',
    icon: '✂️',
    title: 'Tailoring & Custom Apparel POS',
    tagline: 'Job card management from measurements to delivery.',
    color: '#8b5cf6',
    features: [
      'Customer measurement recording & fit notes',
      'Unique token lookup & order lifecycle status',
      'Stitching, Fitting, Ready & Delivered tracking',
      'Fabric attachment logging & design instructions',
      'Automated WhatsApp order notifications',
      'Advance payment & customer balance ledgers',
    ],
  },
  {
    id: 'distributor-pos',
    type: 'vertical',
    icon: '🚚',
    title: 'Distributor Wholesale POS',
    tagline: 'High-density mobile POS for route sales & vans.',
    color: '#3b82f6',
    features: [
      '360x800 phone-optimized touch layout for mobile POS',
      'Storage location & warehouse stock filtering',
      'Quick-share shop banners & frequently bought items',
      'Wholesale bulk pricing & client ledger billing',
      'Offline handheld billing for route salespeople',
      'Bluetooth thermal printer integration',
    ],
  },
  {
    id: 'supermarket-pos',
    type: 'vertical',
    icon: '🛒',
    title: 'Supermarket & General Retail POS',
    tagline: 'High-speed barcode checkout & batch inventory.',
    color: '#10b981',
    features: [
      'High-speed barcode scanning & express billing',
      'Raw material & finished goods stock tracking',
      'Expiry date alerts & batch management',
      'Production batching & raw ingredient intake',
      'GST-compliant invoices with custom branding',
      'Multi-counter drawer & card payment support',
    ],
  },
]

const CORE_MODULES = [
  {
    id: 'inventory',
    type: 'core',
    icon: '📦',
    title: 'Inventory & Recipe Engine',
    tagline: 'Know what you have before you run out.',
    color: '#7efcc8',
    features: [
      'Raw material & finished goods tracking',
      'Recipe costing — auto-deduct on every order',
      'Low stock alerts & automated purchase orders',
      'Supplier management & purchase history',
      'Barcode & QR-based stock intake',
      'Expiry tracking & wastage logging',
    ],
  },
  {
    id: 'kds',
    type: 'core',
    icon: '🍳',
    title: 'Kitchen Display System (KDS)',
    tagline: 'Your kitchen, perfectly orchestrated.',
    color: '#f97316',
    features: [
      'Real-time order streaming to kitchen screens',
      'Item-category routing (Grill, Salads, Bar)',
      'Prep time tracking & delay alert flags',
      'Priority flags for urgent or VIP orders',
      'Sound & visual alerts for new KOTs',
      'Works on any tablet, iPad, or Android TV',
    ],
  },
  {
    id: 'analytics',
    type: 'core',
    icon: '📊',
    title: 'AI Analytics & Reports',
    tagline: 'Data that drives real business decisions.',
    color: '#a78bfa',
    features: [
      'Daily, weekly & monthly revenue dashboards',
      'Item-wise sales & profitability breakdown',
      'Expenditure tracking & P&L summaries',
      'Tax reports ready for GSTR-1 compliance',
      'Staff performance & shift activity logs',
      'Real-time multi-outlet consolidated view',
    ],
  },
  {
    id: 'captain',
    type: 'core',
    icon: '🤵',
    title: 'Captain & Waiter App',
    tagline: 'Full POS terminal in your staff\'s pocket.',
    color: '#38bdf8',
    features: [
      'Tableside order taking on Android & iOS',
      'Real-time menu sync with live availability',
      'Custom notes, special instructions & modifiers',
      'Live kitchen prep status monitoring',
      'Mobile Bluetooth bill printing',
      'Geofenced attendance clock-in',
    ],
  },
  {
    id: 'crm',
    type: 'core',
    icon: '💫',
    title: 'Customer & Loyalty CRM',
    tagline: 'Turn one-time buyers into loyal regulars.',
    color: '#f472b6',
    features: [
      'Customer profile creation at checkout',
      'Visit history & total spend tracking',
      'Points-based loyalty rewards program',
      'WhatsApp digital receipt sharing',
      'Automated birthday & anniversary offers',
      'Customer feedback & sentiment analytics',
    ],
  },
  {
    id: 'staff-sec',
    type: 'core',
    icon: '👥',
    title: 'Staff, Attendance & Security',
    tagline: 'Complete control over roles, shifts & security.',
    color: '#06b6d4',
    features: [
      'Geofenced heartbeat staff clock-in / clock-out',
      'Role-based permissions (Admin, Manager, Cashier, Waiter)',
      'Staff performance & order speed reporting',
      'App PIN lock & sensitive action approval',
      'Comprehensive audit trails for every bill edit',
      'Multi-device session security management',
    ],
  },
]

export default function Modules() {
  const [activeTab, setActiveTab] = useState('all')

  const itemsToDisplay =
    activeTab === 'pos'
      ? POS_VERTICALS
      : activeTab === 'core'
        ? CORE_MODULES
        : [...POS_VERTICALS, ...CORE_MODULES]

  return (
    <section className="modules section" id="modules">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>⚙️</span> POS Verticals & Features
          </div>
          <h2 className="section-title">
            Every Business Vertical & Tool <br />
            <span className="glow-line">In One Unified Platform</span>
          </h2>
          <p className="section-subtitle">
            From specialized industry POS engines to core platform operations — ProBloom equips your business with everything to run, bill, and scale.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="modules__tabs-wrapper">
          <div className="modules__tabs">
            <button
              className={`modules__tab ${activeTab === 'all' ? 'modules__tab--active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>🌐 All Modules</span>
              <span className="modules__tab-badge">12</span>
            </button>
            <button
              className={`modules__tab ${activeTab === 'pos' ? 'modules__tab--active' : ''}`}
              onClick={() => setActiveTab('pos')}
            >
              <span>💼 Specialized POS Types</span>
              <span className="modules__tab-badge">6</span>
            </button>
            <button
              className={`modules__tab ${activeTab === 'core' ? 'modules__tab--active' : ''}`}
              onClick={() => setActiveTab('core')}
            >
              <span>⚡ Core Operations & AI</span>
              <span className="modules__tab-badge">6</span>
            </button>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="modules__grid">
          {itemsToDisplay.map((m) => (
            <div className="modules__card glass-card" key={m.id}>
              <div className="modules__card-header">
                <span
                  className="modules__card-badge"
                  style={{ color: m.color, borderColor: `${m.color}50` }}
                >
                  {m.type === 'vertical' ? 'Specialized POS' : 'Core Module'}
                </span>
                <div className="modules__card-icon" style={{ borderColor: m.color }}>
                  {m.icon}
                </div>
                <div>
                  <h3 className="modules__card-title">{m.title}</h3>
                  <p className="modules__card-tagline" style={{ color: 'var(--teal-dark)' }}>
                    {m.tagline}
                  </p>
                </div>
              </div>

              <ul className="modules__features">
                {m.features.map((feat) => (
                  <li key={feat} className="modules__feature">
                    <span className="modules__feature-check" style={{ color: m.color }}>
                      ✓
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
