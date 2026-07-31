import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ZodError } from 'zod/v4'

import {
  analyzePropertyListing,
  ClaudeServiceError,
} from '@/lib/ai/claudeService'
import { PropertyScanRequestSchema } from '@/lib/ai/propertyAnalysisSchema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_payload'
  | 'missing_auth'
  | 'invalid_session'
  | 'configuration'
  | 'rate_limited'
  | 'provider_error'

type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
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

async function validateSupabaseSession(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false as const, reason: 'configuration' as const }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    return { ok: false as const, reason: 'invalid_session' as const }
  }

  return { ok: true as const, userId: data.user.id }
}

async function readJson(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function validationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

function serviceErrorResponse(error: ClaudeServiceError) {
  switch (error.code) {
    case 'configuration':
      return errorResponse(
        'configuration',
        'AI analiza trenutno nije konfigurisana.',
        500,
      )
    case 'rate_limited':
      return errorResponse(
        'rate_limited',
        'AI servis je trenutno preopterecen. Pokusajte ponovo uskoro.',
        429,
      )
    case 'timeout':
    case 'provider_unavailable':
    case 'provider_error':
    case 'invalid_response':
      return errorResponse(
        'provider_error',
        'AI analiza trenutno nije dostupna. Pokusajte ponovo kasnije.',
        502,
      )
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

  const parsedPayload = PropertyScanRequestSchema.safeParse(rawBody)

  if (!parsedPayload.success) {
    return errorResponse(
      'invalid_payload',
      'Podaci oglasa nisu u ocekivanom formatu.',
      400,
      validationDetails(parsedPayload.error),
    )
  }

  try {
    const analysis = await analyzePropertyListing(parsedPayload.data)
    return jsonResponse(analysis)
  } catch (error) {
    console.error('SCAN_ROUTE_ERROR:', error)

    if (error instanceof ClaudeServiceError) {
      return serviceErrorResponse(error)
    }

    return errorResponse(
      'provider_error',
      'AI analiza trenutno nije dostupna. Pokusajte ponovo kasnije.',
      502,
    )
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  })
}
