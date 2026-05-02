import { useState } from 'react'
import './Modules.css'

const MODULES = [
  {
    id: 'pos',
    icon: '🖥️',
    title: 'Smart POS & Billing',
    tagline: 'Bill faster than ever before.',
    features: [
      'Table and takeaway management with live status',
      'Split bills, merge tables, apply discounts & offers',
      'Multi-payment: Cash, UPI, Card, Split & custom',
      'Thermal printer support (KOT + Bill)',
      'GST-compliant receipts with custom branding',
      'Offline billing — data syncs when back online',
    ],
    color: '#C6F53D',
  },
  {
    id: 'inventory',
    icon: '📦',
    title: 'Inventory & Recipe Engine',
    tagline: 'Know what you have, before you run out.',
    features: [
      'Raw material & finished goods tracking',
      'Recipe costing — auto-deduct on every order',
      'Low stock alerts & automated purchase orders',
      'Supplier management and purchase history',
      'Barcode & QR-based stock intake',
      'Expiry tracking and wastage logging',
    ],
    color: '#7efcc8',
  },
  {
    id: 'kds',
    icon: '🍳',
    title: 'Kitchen Display System',
    tagline: 'Your kitchen, perfectly orchestrated.',
    features: [
      'Real-time order streaming to kitchen screens',
      'Item-category routing (grill, salads, bar, etc.)',
      'Prep time tracking and delay alerts',
      'Priority flagging for urgent or VIP orders',
      'Sound + visual alerts for new KOTs',
      'Works on any tablet or Android TV',
    ],
    color: '#f59e0b',
  },
  {
    id: 'analytics',
    icon: '📊',
    title: 'Analytics & Reports',
    tagline: 'Data that actually tells you something.',
    features: [
      'Daily, weekly, monthly revenue dashboards',
      'Item-wise sales and profitability analysis',
      'Staff performance and shift reports',
      'Tax reports (GSTR-1 ready)',
      'Expense tracking and P&L summary',
      'Real-time multi-outlet consolidated view',
    ],
    color: '#a78bfa',
  },
  {
    id: 'captain',
    icon: '🤵',
    title: 'Captain & Waiter App',
    tagline: 'Full restaurant in your staff\'s pocket.',
    features: [
      'Table-side order taking on Android/iOS',
      'Real-time menu sync with prices & availability',
      'Customer notes, special requests & modifiers',
      'Order status tracking from kitchen',
      'Bill printing from mobile',
      'Geofence-based staff attendance',
    ],
    color: '#38bdf8',
  },
  {
    id: 'crm',
    icon: '💫',
    title: 'Customer & Loyalty CRM',
    tagline: 'Turn one-time guests into regulars.',
    features: [
      'Customer profile creation at checkout',
      'Visit history and spend tracking',
      'Points-based loyalty program',
      'WhatsApp bill sharing and promotions',
      'Birthday & anniversary offers automation',
      'Feedback collection and sentiment view',
    ],
    color: '#f472b6',
  },
]

export default function Modules() {
  return (
    <section className="modules section" id="modules">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>⚙️</span> Core Modules
          </div>
          <h2 className="section-title">
            Every Tool Your Business <br />
            <span className="glow-line">Will Ever Need</span>
          </h2>
          <p className="section-subtitle">
            Six powerhouse modules, fully integrated. Run them all seamlessly — ProBloom handles it.
          </p>
        </div>

        <div className="modules__grid">
          {MODULES.map(m => (
            <div className="modules__card glass-card" key={m.id}>
              <div className="modules__card-header">
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
                {m.features.map(feat => (
                  <li key={feat} className="modules__feature">
                    <span className="modules__feature-check" style={{ color: 'var(--teal-dark)' }}>✓</span>
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
