import { supabase } from '@/lib/supabase/client'
import { parseSavedListings } from '@/lib/dashboard/parseListingDisplay'
import type { ListingDisplay, SavedListingRow } from '@/lib/dashboard/types'

export type FetchSavedListingsResult =
  | { ok: true; listings: ListingDisplay[] }
  | { ok: false; error: string }

export async function fetchSavedListings(): Promise<FetchSavedListingsResult> {
  const { data, error } = await supabase
    .from('saved_properties')
    .select(
      `
      id,
      status,
      agent_notes,
      saved_at,
      listing:scanned_listings (
        id,
        title,
        portal_url,
        source_portal,
        price_at_scan,
        location_name,
        is_owner,
        phone_number,
        deal_score,
        ai_analysis,
        last_scanned_at
      )
    `,
    )
    .order('saved_at', { ascending: false })

  if (error) {
    return {
      ok: false,
      error: error.message || 'Neuspešno učitavanje sačuvanih oglasa.',
    }
  }

  const rows = (data ?? []) as unknown as SavedListingRow[]
  return {
    ok: true,
    listings: parseSavedListings(rows),
  }
}
