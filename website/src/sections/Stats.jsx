import { useEffect, useRef, useState } from 'react'
import './Stats.css'

const STATS = [
  { value: 10000, suffix: '+', label: 'Active Businesses', icon: '🏪' },
  { value: 500, suffix: 'Cr+', label: 'Revenue Processed (₹)', icon: '💰' },
  { value: 99.9, suffix: '%', label: 'Uptime Guaranteed', icon: '⚡', decimal: true },
  { value: 24, suffix: '×7', label: 'Customer Support', icon: '🛎️' },
  { value: 0, suffix: '%', label: 'Transaction Errors', icon: '✅' },
  { value: 4.9, suffix: '★', label: 'Average Rating', icon: '🌟', decimal: true },
]

function useCountUp(target, started, decimal) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    const duration = 1800
    const steps = 60
    const stepVal = target / steps
    let current = 0
    const interval = setInterval(() => {
      current += stepVal
      if (current >= target) {
        setCount(target)
        clearInterval(interval)
      } else {
        setCount(decimal ? parseFloat(current.toFixed(1)) : Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(interval)
  }, [started, target, decimal])
  return count
}

function StatItem({ stat, started }) {
  const count = useCountUp(stat.value, started, stat.decimal)
  return (
    <div className="stats__item glass-card">
      <div className="stats__icon">{stat.icon}</div>
      <div className="stats__value">
        {stat.decimal ? count : count.toLocaleString()}{stat.suffix}
      </div>
      <div className="stats__label">{stat.label}</div>
    </div>
  )
}

export default function Stats() {
  const ref = useRef(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStarted(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="stats section" ref={ref} id="stats">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>📊</span> By The Numbers
          </div>
          <h2 className="section-title">
            Numbers That <span className="glow-line">Speak For Themselves</span>
          </h2>
        </div>
        <div className="stats__grid">
          {STATS.map(s => (
            <StatItem key={s.label} stat={s} started={started} />
          ))}
        </div>
      </div>
    </section>
  )
}
