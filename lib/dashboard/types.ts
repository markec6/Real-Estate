export type ContactDetails = {
  agency_name: string
  phone_number: string
  contact_email: string
  is_owner: boolean
  advertiser_type: string
}

export type ScannedListingJoin = {
  id: number
  title: string | null
  portal_url: string
  source_portal: string | null
  price_at_scan: number | null
  location_name: string | null
  is_owner: boolean | null
  phone_number: string | null
  deal_score: number | null
  ai_analysis: Record<string, unknown> | null
  last_scanned_at: string | null
}

export type SavedListingRow = {
  id: number
  status: string
  agent_notes: string | null
  saved_at: string
  listing: ScannedListingJoin | null
}

export type ListingDisplay = {
  savedId: number
  listingId: number
  title: string
  priceEur: number | null
  pricePerSqm: number | null
  city: string | null
  neighborhood: string | null
  isOwner: boolean
  advertiserLabel: 'Vlasnik' | 'Agencija'
  portalUrl: string
  contactDetails: ContactDetails | null
  aiAnalysis: Record<string, unknown> | null
  status: string
  savedAt: string
}

export type DashboardLoadState = 'loading' | 'ready' | 'error' | 'unauthenticated'
