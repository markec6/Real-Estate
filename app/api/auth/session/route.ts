import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { buildCorsHeaders, corsPreflightResponse } from '@/lib/auth/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionPayload = {
  authenticated: boolean
  session: unknown
  user?: {
    id: string
    email: string | null
  }
  error?: string
}

function createJsonResponse(
  request: NextRequest,
  body: SessionPayload,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...buildCorsHeaders(request.headers.get('origin'), {
        methods: 'GET, OPTIONS',
      }),
    },
  })
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request.headers.get('origin'), {
    methods: 'GET, OPTIONS',
  })
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return createJsonResponse(
      request,
      { authenticated: false, session: null, error: 'configuration' },
      500,
    )
  }

  const authorization = request.headers.get('authorization')
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  if (bearerToken) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase.auth.getUser(bearerToken)

    if (error || !data.user) {
      return createJsonResponse(request, { authenticated: false, session: null }, 401)
    }

    return createJsonResponse(request, {
      authenticated: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
      session: {
        access_token: bearerToken,
        user: data.user,
      },
    })
  }

  const pendingCookies: Array<{
    name: string
    value: string
    options: Parameters<NextResponse['cookies']['set']>[2]
  }> = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({
            name,
            value,
            options: {
              ...options,
              sameSite: options.sameSite ?? 'lax',
              secure:
                process.env.NODE_ENV === 'production' ? true : options.secure,
              path: options.path ?? '/',
            },
          })
        })
      },
    },
  })

  const { data, error } = await supabase.auth.getSession()

  const payload: SessionPayload =
    error || !data.session
      ? { authenticated: false, session: null }
      : {
          authenticated: true,
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? null,
          },
          session: data.session,
        }

  const response = createJsonResponse(request, payload)

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
