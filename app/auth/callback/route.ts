import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const DEFAULT_REDIRECT = '/'

function getSafeRedirect(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next')
  if (!next) return DEFAULT_REDIRECT

  if (next.startsWith('/') && !next.startsWith('//')) {
    return next
  }

  const configuredExtensionUrl = process.env.NEXT_PUBLIC_EXTENSION_INSTALL_URL?.trim()
  return configuredExtensionUrl && next === configuredExtensionUrl
    ? next
    : DEFAULT_REDIRECT
}

export async function GET(request: NextRequest) {
  const redirectUrl = new URL(getSafeRedirect(request), request.url)
  const response = NextResponse.redirect(redirectUrl)
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?authError=missing_code', request.url))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/?authError=configuration', request.url))
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            sameSite: options.sameSite ?? 'lax',
            secure: true,
            path: options.path ?? '/',
          })
        })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/?authError=callback_failed', request.url))
  }

  return response
}
