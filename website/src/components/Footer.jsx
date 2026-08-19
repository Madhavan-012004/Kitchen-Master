import './Footer.css'

const FOOTER_LINKS = {
  'POS Verticals': [
    { label: 'Restaurant & Dining POS', href: '#modules' },
    { label: 'Poultry & Meat POS', href: '#modules' },
    { label: 'Clothing & Fashion POS', href: '#modules' },
    { label: 'Tailoring & Job Card POS', href: '#modules' },
    { label: 'Distributor Mobile POS', href: '#modules' },
    { label: 'Supermarket & Retail POS', href: '#modules' },
  ],
  Company: [
    { label: 'About ProBloom', href: '#about' },
    { label: 'Why ProBloom', href: '#why' },
    { label: 'Download Hub', href: '#download' },
    { label: 'Testimonials', href: '#testimonials' },
  ],
  Support: [
    { label: 'Help & Support', href: '#' },
    { label: 'Contact Us', href: 'mailto:admin.probloom@gmail.com' },
    { label: 'System Status', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
}

export default function Footer() {
  const scrollTo = (href) => (e) => {
    e.preventDefault()
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
    else if (href.startsWith('mailto:')) window.location.href = href
  }

  return (
    <footer className="footer" id="footer">
      {/* CTA Banner */}
      <div className="footer__cta-banner">
        <div className="container footer__cta-inner">
          <div>
            <h2 className="footer__cta-title">
              Ready to make your business <span className="glow-line">bloom?</span>
            </h2>
            <p className="footer__cta-sub">
              Join 10,000+ businesses already using ProBloom. Start free, scale fearlessly.
            </p>
          </div>
          <button
            className="btn-primary footer__cta-btn"
            onClick={() => document.querySelector('#get-started')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Main Footer */}
      <div className="footer__main">
        <div className="container footer__grid">
          {/* Brand column */}
          <div className="footer__brand">
            <div className="footer__logo">
              <span className="footer__logo-icon">🌿</span>
              <span>Pro<span className="accent">Bloom</span></span>
            </div>
            <p className="footer__brand-desc">
              The unified multi-POS &amp; business management ecosystem for restaurants, poultry outlets, clothing retail, tailoring, distribution, and supermarkets across India.
            </p>
            <div className="footer__contact">
              <a href="tel:+916381537195" className="footer__contact-item">
                📞 +91 63815 37195
              </a>
              <a href="mailto:admin.probloom@gmail.com" className="footer__contact-item">
                ✉️ admin.probloom@gmail.com
              </a>
              <a href="mailto:madhavan.probloom@gmail.com" className="footer__contact-item">
                ✉️ madhavan.probloom@gmail.com
              </a>
            </div>
            <div className="footer__social">
              {['𝕏', 'in', 'f', '▶'].map((icon, i) => (
                <a key={i} href="#" className="footer__social-icon" aria-label={`Social ${i}`}>
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category} className="footer__links-col">
              <h4 className="footer__links-title">{category}</h4>
              <ul className="footer__links">
                {links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="footer__link"
                      onClick={link.href.startsWith('#') ? scrollTo(link.href) : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="container footer__bottom">
          <p className="footer__copyright">
            © 2026 ProBloom Technologies Pvt. Ltd. All rights reserved. Made with ❤️ in India.
          </p>
          <p className="footer__tagline">
            🌿 <em>Revolutionize Your Operations. Bloom Like a Boss.</em>
          </p>
        </div>
      </div>
    </footer>
  )
}
