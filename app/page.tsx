import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Comparison from '@/components/Comparison'
import HowItWorks from '@/components/HowItWorks'
import Pricing from '@/components/Pricing'
import Testimonials from '@/components/Testimonials'

export default function Page() {
  return (
    <div className="page-wrapper">
      <Header />
      <main>
        <Hero />
        <Comparison />
        <HowItWorks />
        <Pricing />
        <Testimonials />
      </main>
    </div>
  )
}
