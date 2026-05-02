import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './sections/Hero'
import About from './sections/About'
import WhyProBloom from './sections/WhyProBloom'
import Modules from './sections/Modules'
import Stats from './sections/Stats'
import DownloadHub from './sections/DownloadHub'
import Pricing from './sections/Pricing'
import Testimonials from './sections/Testimonials'
import GetStarted from './sections/GetStarted'
import Footer from './components/Footer'
import SuccessModal from './components/SuccessModal'

export default function App() {
  const [successData, setSuccessData] = useState(null)

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <WhyProBloom />
        <Modules />
        <DownloadHub />
        <Pricing />
        <Testimonials />
        <GetStarted onSuccess={setSuccessData} />
      </main>
      <Footer />
      {successData && (
        <SuccessModal data={successData} onClose={() => setSuccessData(null)} />
      )}
    </>
  )
}
