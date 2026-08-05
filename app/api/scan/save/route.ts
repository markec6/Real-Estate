import { NextResponse, type NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_payload'
  | 'missing_auth'
  | 'invalid_session'
  | 'configuration'
  | 'listing_conflict'
  | 'database_error'

type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
}

type ListingRow = {
  id: number
  portal_url: string
  user_id: string | null
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  ...CORS_HEADERS,
}

function jsonResponse<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  })
}

function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }

  return jsonResponse(body, status)
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function createAuthedClient(accessToken: string): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

async function validateSupabaseSession(accessToken: string) {
  const supabase = createAuthedClient(accessToken)

  if (!supabase) {
    return { ok: false as const, reason: 'configuration' as const }
  }

  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    return { ok: false as const, reason: 'invalid_session' as const }
  }

  return {
    ok: true as const,
    userId: data.user.id,
    supabase,
  }
}

async function readJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }

  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function parseLocaleNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') return null

  const compact = value
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d.,+-]/g, '')

  if (!compact) return null

  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')
  const decimalSeparator =
    lastComma > -1 && lastDot > -1
      ? lastComma > lastDot
        ? ','
        : '.'
      : lastComma > -1
        ? ','
        : lastDot > -1
          ? '.'
          : null

  if (!decimalSeparator) {
    const parsed = Number(compact)
    return Number.isFinite(parsed) ? parsed : null
  }

  const separatorIndex = compact.lastIndexOf(decimalSeparator)
  const fractionalDigits = compact.length - separatorIndex - 1
  const looksLikeThousandsSeparator =
    fractionalDigits === 3 &&
    compact.slice(0, separatorIndex).replace(/[^\d]/g, '').length >= 1

  if (
    looksLikeThousandsSeparator &&
    (compact.match(/[.,]/g)?.length ?? 0) === 1
  ) {
    const parsed = Number(compact.replace(/[.,]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalized =
    decimalSeparator === ','
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePortalUrl(value: unknown): string | null {
  const raw = asString(value, 2000)
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

function deriveSourcePortal(
  portalUrl: string,
  explicit: string | null,
): string | null {
  if (explicit) return explicit.slice(0, 120)

  try {
    return new URL(portalUrl).hostname.replace(/^www\./i, '') || null
  } catch {
    return null
  }
}

function extractDealScore(aiAnalysis: Record<string, unknown> | null): number | null {
  if (!aiAnalysis) return null

  const candidates = [
    aiAnalysis.deal_score,
    aiAnalysis.dealScore,
    asRecord(aiAnalysis.financials)?.deal_score,
    asRecord(aiAnalysis.valuation)?.deal_score,
    asRecord(aiAnalysis.procena_vrednosti)?.deal_score,
  ]

  for (const candidate of candidates) {
    const parsed = parseLocaleNumber(candidate)
    if (parsed !== null) return parsed
  }

  return null
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === '23505') return true
  return /duplicate key|unique constraint/i.test(error.message ?? '')
}

type ParsedSavePayload = {
  portalUrl: string
  sourcePortal: string | null
  originalIdOnPortal: string | null
  title: string | null
  description: string | null
  phoneNumber: string | null
  isOwner: boolean | null
  priceAtScan: number | null
  locationName: string | null
  dealScore: number | null
  aiAnalysis: Record<string, unknown> | null
}

function parseSavePayload(rawBody: unknown): ParsedSavePayload | { error: string } {
  const body = asRecord(rawBody)
  if (!body) {
    return { error: 'Zahtev mora biti JSON objekat.' }
  }

  const detection = asRecord(body.detection)
  const detectedListing = asRecord(detection?.listing)
  const contactDetails =
    asRecord(body.contact_details) ??
    asRecord(asRecord(body.ai_analysis)?.contact_details)

  const portalUrl = normalizePortalUrl(
    body.portal_url ??
      body.listing_url ??
      detectedListing?.listing_url ??
      detectedListing?.portal_url,
  )

  if (!portalUrl) {
    return {
      error: 'Nedostaje validan portal_url (http/https) za cuvanje oglasa.',
    }
  }

  const aiAnalysis = asRecord(body.ai_analysis)
  const priceAtScan =
    parseLocaleNumber(body.price) ??
    parseLocaleNumber(detectedListing?.price) ??
    parseLocaleNumber(asRecord(detectedListing?.price)?.value)

  const isOwnerRaw =
    contactDetails?.is_owner ??
    body.is_owner ??
    detectedListing?.is_owner

  const isOwner =
    typeof isOwnerRaw === 'boolean'
      ? isOwnerRaw
      : typeof isOwnerRaw === 'string'
        ? /^(true|1|da|yes)$/i.test(isOwnerRaw.trim())
          ? true
          : /^(false|0|ne|no)$/i.test(isOwnerRaw.trim())
            ? false
            : null
        : null

  const sourcePortal = deriveSourcePortal(
    portalUrl,
    asString(
      body.source_portal ??
        body.portal_name ??
        detectedListing?.portal_name,
      120,
    ),
  )

  return {
    portalUrl,
    sourcePortal,
    originalIdOnPortal: asString(
      body.original_id_on_portal ??
        body.listing_id ??
        detectedListing?.listing_id,
      240,
    ),
    title: asString(body.title ?? detectedListing?.title, 240),
    description: asString(
      body.description ?? detectedListing?.description,
      6000,
    ),
    phoneNumber: asString(
      contactDetails?.phone_number ??
        body.phone_number ??
        body.phone ??
        detectedListing?.phone_number ??
        detectedListing?.phone,
      120,
    ),
    isOwner,
    priceAtScan,
    locationName: asString(
      body.location ?? body.location_name ?? detectedListing?.location,
      180,
    ),
    dealScore: extractDealScore(aiAnalysis),
    aiAnalysis,
  }
}

async function upsertScannedListing(
  supabase: SupabaseClient,
  userId: string,
  payload: ParsedSavePayload,
): Promise<
  | { ok: true; listing: ListingRow }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; message: string }
> {
  const listingFields = {
    portal_url: payload.portalUrl,
    source_portal: payload.sourcePortal,
    original_id_on_portal: payload.originalIdOnPortal,
    title: payload.title,
    description: payload.description,
    phone_number: payload.phoneNumber,
    is_owner: payload.isOwner ?? false,
    price_at_scan: payload.priceAtScan,
    location_name: payload.locationName,
    deal_score: payload.dealScore,
    ai_analysis: payload.aiAnalysis,
    user_id: userId,
    last_scanned_at: new Date().toISOString(),
  }

  const { data: existing, error: selectError } = await supabase
    .from('scanned_listings')
    .select('id, portal_url, user_id')
    .eq('user_id', userId)
    .eq('portal_url', payload.portalUrl)
    .maybeSingle()

  if (selectError) {
    return {
      ok: false,
      conflict: false,
      message: selectError.message || 'Neuspesno citanje postojeceg oglasa.',
    }
  }

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from('scanned_listings')
      .update(listingFields)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('id, portal_url, user_id')
      .single()

    if (updateError || !updated) {
      return {
        ok: false,
        conflict: false,
        message: updateError?.message || 'Neuspesno azuriranje oglasa.',
      }
    }

    return { ok: true, listing: updated as ListingRow }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('scanned_listings')
    .insert(listingFields)
    .select('id, portal_url, user_id')
    .single()

  if (!insertError && inserted) {
    return { ok: true, listing: inserted as ListingRow }
  }

  if (isUniqueViolation(insertError)) {
    // Global portal_url unique may be owned by another user (hidden by RLS).
    const { data: ownRetry } = await supabase
      .from('scanned_listings')
      .select('id, portal_url, user_id')
      .eq('user_id', userId)
      .eq('portal_url', payload.portalUrl)
      .maybeSingle()

    if (ownRetry?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('scanned_listings')
        .update(listingFields)
        .eq('id', ownRetry.id)
        .eq('user_id', userId)
        .select('id, portal_url, user_id')
        .single()

      if (!updateError && updated) {
        return { ok: true, listing: updated as ListingRow }
      }
    }

    return { ok: false, conflict: true }
  }

  return {
    ok: false,
    conflict: false,
    message: insertError?.message || 'Neuspesno cuvanje oglasa.',
  }
}

async function ensureSavedProperty(
  supabase: SupabaseClient,
  userId: string,
  listingId: number,
): Promise<
  | { ok: true; savedPropertyId: number }
  | { ok: false; message: string }
> {
  const { data: existing, error: selectError } = await supabase
    .from('saved_properties')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (selectError) {
    return {
      ok: false,
      message: selectError.message || 'Neuspesno citanje sacuvanog oglasa.',
    }
  }

  if (existing?.id) {
    return { ok: true, savedPropertyId: existing.id as number }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('saved_properties')
    .insert({
      user_id: userId,
      listing_id: listingId,
      status: 'novo',
    })
    .select('id')
    .single()

  if (!insertError && inserted?.id) {
    return { ok: true, savedPropertyId: inserted.id as number }
  }

  if (isUniqueViolation(insertError)) {
    const { data: raced } = await supabase
      .from('saved_properties')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .maybeSingle()

    if (raced?.id) {
      return { ok: true, savedPropertyId: raced.id as number }
    }
  }

  return {
    ok: false,
    message: insertError?.message || 'Neuspesno povezivanje oglasa sa Dashboard-om.',
  }
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request)

  if (!accessToken) {
    return errorResponse(
      'missing_auth',
      'Nedostaje Authorization Bearer token.',
      401,
    )
  }

  const session = await validateSupabaseSession(accessToken)

  if (!session.ok) {
    if (session.reason === 'configuration') {
      return errorResponse(
        'configuration',
        'Autentikacija trenutno nije konfigurisana.',
        500,
      )
    }

    return errorResponse(
      'invalid_session',
      'Sesija nije vazeca ili je istekla.',
      401,
    )
  }

  const rawBody = await readJson(request)

  if (!rawBody) {
    return errorResponse(
      'invalid_json',
      'Zahtev mora biti validan JSON objekat.',
      400,
    )
  }

  const parsed = parseSavePayload(rawBody)

  if ('error' in parsed) {
    return errorResponse('invalid_payload', parsed.error, 400)
  }

  const listingResult = await upsertScannedListing(
    session.supabase,
    session.userId,
    parsed,
  )

  if (!listingResult.ok) {
    if (listingResult.conflict) {
      return errorResponse(
        'listing_conflict',
        'Ovaj oglas je vec sacuvan od strane drugog korisnika.',
        409,
      )
    }

    return errorResponse(
      'database_error',
      listingResult.message,
      500,
    )
  }

  const savedResult = await ensureSavedProperty(
    session.supabase,
    session.userId,
    listingResult.listing.id,
  )

  if (!savedResult.ok) {
    return errorResponse('database_error', savedResult.message, 500)
  }

  const { data: profile } = await session.supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', session.userId)
    .maybeSingle()

  return jsonResponse({
    ok: true,
    saved_property_id: savedResult.savedPropertyId,
    listing_id: listingResult.listing.id,
    credits_remaining:
      typeof profile?.credits_remaining === 'number'
        ? profile.credits_remaining
        : null,
  })
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  })
}
