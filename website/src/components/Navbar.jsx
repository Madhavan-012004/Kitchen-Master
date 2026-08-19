import { useState, useEffect } from 'react'
import './Navbar.css'

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Why ProBloom', href: '#why' },
  { label: 'Features', href: '#modules' },
  { label: 'Download', href: '#download' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNav = (href) => {
    setMenuOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="container navbar__inner">
        <a href="#" className="navbar__logo">
          <div className="navbar__logo-mark">🌿</div>
          <span className="navbar__logo-text">Pro<span className="navbar__logo-accent">Bloom</span></span>
        </a>

        <nav className="navbar__links hide-mobile" aria-label="Main navigation">
          {NAV_LINKS.map(l => (
            <button key={l.label} onClick={() => handleNav(l.href)} className="navbar__link">
              {l.label}
            </button>
          ))}
        </nav>

        <div className="navbar__actions">
          <a
            href="https://localhost:5173/login"
            target="_blank"
            rel="noreferrer"
            className="navbar__login hide-mobile"
          >
            Login
          </a>
          <button
            className="btn-primary navbar__cta"
            onClick={() => handleNav('#get-started')}
          >
            Get Started Free
          </button>
          <button
            className="navbar__hamburger hide-desktop"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <span className={`hamburger-bar ${menuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`navbar__mobile-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        {NAV_LINKS.map(l => (
          <button key={l.label} onClick={() => handleNav(l.href)} className="navbar__mobile-link">
            {l.label}
          </button>
        ))}
        <a href="https://localhost:5173/login" target="_blank" rel="noreferrer" className="navbar__mobile-link">
          Login to App ↗
        </a>
        <button
          className="btn-primary navbar__mobile-cta"
          onClick={() => handleNav('#get-started')}
        >
          Get Started Free
        </button>
      </div>
    </header>
  )
}
