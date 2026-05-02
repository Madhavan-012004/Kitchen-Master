import './Testimonials.css'

const TESTIMONIALS = [
  {
    quote: "We switched from another POS to ProBloom and our billing speed doubled instantly. The offline mode alone saved us during three power cuts last month. Zero orders lost.",
    name: "Rahul Sharma",
    role: "Owner, Biryani Kingdom — 4 outlets",
    rating: 5,
    avatar: 'RS',
  },
  {
    quote: "The Kitchen Display System changed everything. My kitchen team used to yell across the counter. Now orders appear silently on the screen and we've cut prep errors by 80%.",
    name: "Priya Menon",
    role: "Chef-Owner, The Coastal Plate",
    rating: 5,
    avatar: 'PM',
  },
  {
    quote: "ProBloom's analytics told me that my weekday lunch combo was my most profitable item — I had no idea. I doubled down on it and revenue jumped 22% in one month.",
    name: "Aakash Verma",
    role: "MD, FreshGreen Supermarkets",
    rating: 5,
    avatar: 'AV',
  },
  {
    quote: "Running 12 cloud kitchens from one dashboard is a dream. Central menu updates, consolidated reports — ProBloom is the only software that understood cloud kitchens.",
    name: "Sneha Kapoor",
    role: "Operations Head, CloudBite Group",
    rating: 5,
    avatar: 'SK',
  },
  {
    quote: "The captain app is so smooth that my waiters actually use it without complaints. When they're happy, service quality goes up and so do tips. Customers love it.",
    name: "Mohammed Iqbal",
    role: "GM, The Grand Spice Hotel",
    rating: 5,
    avatar: 'MI',
  },
  {
    quote: "Customer support is genuinely exceptional. My account manager picked up at 11 PM on a Saturday when our billing server hit an issue. That's not just software — it's a partner.",
    name: "Divya Nair",
    role: "Owner, Café Nair & Co.",
    rating: 5,
    avatar: 'DN',
  },
]

export default function Testimonials() {
  return (
    <section className="testimonials section" id="testimonials">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>💬</span> What Our Clients Say
          </div>
          <h2 className="section-title">
            Real Businesses. <br />
            <span className="glow-line">Real Results.</span>
          </h2>
          <p className="section-subtitle">
            Don't take our word for it. Here's what restaurant and retail owners across India say about ProBloom.
          </p>
        </div>

        <div className="testimonials__grid">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="testimonials__card glass-card">
              <div className="testimonials__stars">
                {'★'.repeat(t.rating)}
              </div>
              <p className="testimonials__quote">"{t.quote}"</p>
              <div className="testimonials__author">
                <div className="testimonials__avatar">
                  {t.avatar}
                </div>
                <div>
                  <div className="testimonials__name">{t.name}</div>
                  <div className="testimonials__role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
