import { NextResponse } from 'next/server'

import { resolveCorsOrigin } from '@/lib/auth/origins'

const DEFAULT_ALLOW_HEADERS = 'Content-Type, Authorization'
const DEFAULT_ALLOW_METHODS = 'GET, POST, OPTIONS'

export function buildCorsHeaders(
  requestOrigin: string | null,
  options?: {
    methods?: string
    headers?: string
    allowCredentials?: boolean
  },
) {
  const allowedOrigin = resolveCorsOrigin(requestOrigin)
  const allowCredentials = options?.allowCredentials ?? true

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': options?.methods ?? DEFAULT_ALLOW_METHODS,
    'Access-Control-Allow-Headers': options?.headers ?? DEFAULT_ALLOW_HEADERS,
    Vary: 'Origin',
  }

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin
    if (allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true'
    }
  }

  return headers
}

export function corsPreflightResponse(
  requestOrigin: string | null,
  options?: {
    methods?: string
    headers?: string
    allowCredentials?: boolean
  },
) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(requestOrigin, options),
  })
}
