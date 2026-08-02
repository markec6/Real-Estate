import type { Metadata } from 'next'
import './dashboard.css'

export const metadata: Metadata = {
  title: 'Dashboard | Balkan Real Estate Intelligence',
  description: 'Pregledajte sačuvane nekretnine i AI analize na jednom mestu.',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
