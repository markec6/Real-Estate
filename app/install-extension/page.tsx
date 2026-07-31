import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import InstallExtensionContent from '@/components/InstallExtensionContent'

export const metadata: Metadata = {
  title: 'Instalirajte Chrome Ekstenziju | Balkan Real Estate Intelligence',
  description:
    'Preuzmite Balkan Real Estate Intelligence Chrome ekstenziju i aktivirajte skeniranje oglasa u tri brza koraka.',
}

export default function InstallExtensionPage() {
  return (
    <div className="page-wrapper">
      <Header />
      <main>
        <InstallExtensionContent />
      </main>
      <Footer />
    </div>
  )
}
