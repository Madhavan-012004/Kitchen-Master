import './Hero.css'

export default function Hero() {
  const scrollTo = (id) => document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="hero" id="home">
      {/* Decorative wave */}
      <div className="hero__bg-pattern" aria-hidden="true" />

      <div className="container hero__inner">
        {/* Left — Content */}
        <div className="hero__content">
          <div className="section-label section-label--on-dark">
            <span>🚀</span> Trusted by 10,000+ Businesses
          </div>

          <h1 className="hero__title">
            Revolutionize Your <br />
            <span className="glow-line--dark">Operations.</span>
            <br />Bloom Like a Boss.
          </h1>

          <p className="hero__subtitle">
            ProBloom is the all-in-one POS, billing &amp; management ecosystem for restaurants,
            poultry outlets, fashion retail, custom tailoring, wholesale distributors, and supermarkets — built for businesses that refuse to settle for average.
          </p>

          <div className="hero__cta-row">
            <button className="btn-primary hero__cta-main" onClick={() => scrollTo('#get-started')}>
              Get ProBloom Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <button className="btn-secondary btn-secondary--on-dark" onClick={() => scrollTo('#modules')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              See How It Works
            </button>
          </div>

          <div className="hero__trust">
            <div className="hero__trust-item">
              <div className="hero__trust-dot" />
              <span>Live &amp; Active</span>
            </div>
            <div className="hero__trust-sep" />
            <div className="hero__trust-item">
              <span>✓ No credit card needed</span>
            </div>
            <div className="hero__trust-sep" />
            <div className="hero__trust-item">
              <span>✓ 30-day free trial</span>
            </div>
          </div>
        </div>

        {/* Right — Dashboard Mockup */}
        <div className="hero__visual">
          <div className="hero__card-wrap animate-float">
            <img
              src="/hero_dashboard.png"
              alt="ProBloom POS Dashboard interface"
              className="hero__dashboard"
            />

          </div>
        </div>
      </div>

    </section>
  )
}
