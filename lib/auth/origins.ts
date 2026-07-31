export const LOCAL_WEBSITE_ORIGIN = 'http://localhost:3000'
export const PRODUCTION_WEBSITE_ORIGIN = 'https://real-estate-lac-ten.vercel.app'

const EXTRA_WEBSITE_ORIGINS = (process.env.NEXT_PUBLIC_ALLOWED_AUTH_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const WEBSITE_AUTH_ORIGINS = Array.from(
  new Set([
    LOCAL_WEBSITE_ORIGIN,
    PRODUCTION_WEBSITE_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '').trim(),
    ...EXTRA_WEBSITE_ORIGINS,
  ].filter((origin): origin is string => Boolean(origin))),
)

export function isWebsiteAuthOrigin(origin: string | null | undefined): origin is string {
  return Boolean(origin && WEBSITE_AUTH_ORIGINS.includes(origin))
}

export function isChromeExtensionOrigin(origin: string | null | undefined): origin is string {
  return Boolean(origin?.startsWith('chrome-extension://'))
}

export function isAllowedAuthBridgeOrigin(origin: string | null | undefined): origin is string {
  return isWebsiteAuthOrigin(origin) || isChromeExtensionOrigin(origin)
}

export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null
  if (isWebsiteAuthOrigin(requestOrigin) || isChromeExtensionOrigin(requestOrigin)) {
    return requestOrigin
  }
  return null
}
