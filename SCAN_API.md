# Property Scan Analysis API

`POST /api/scan/analyze` accepts listing data already extracted by the browser extension and returns a structured Serbian-language real estate analysis.

## Auth session bridge

`GET /api/auth/session` returns the current Supabase session for the website origin (cookie credentials) or a bearer token. Allowed CORS origins include `https://real-estate-lac-ten.vercel.app`, `http://localhost:3000`, and `chrome-extension://*` IDs. The Chrome extension content script syncs this into `chrome.storage.local`.

## Authentication

Send the existing Supabase access token from the extension session:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

The route validates the token with Supabase and does not modify sessions, credits, or database rows.

## Request Body

```json
{
  "title": "Stan na Vracaru",
  "price": "120.000 €",
  "location": "Beograd, Vracar",
  "m2": "54",
  "description": "Dvosoban stan...",
  "features": ["centralno grejanje", "lift", "uknjizen"],
  "portal_url": "https://example.com/oglas/123"
}
```

`price` and `m2` may be numbers or localized strings. `portal_url` must use `http` or `https`.

## Success Response

The response is the analysis object directly:

```json
{
  "summary": "...",
  "valuation": {
    "market_assessment": "Fair",
    "estimated_deviation_pct": 0,
    "price_per_m2": 2222,
    "analysis_reasoning": "..."
  },
  "costs_breakdown": {
    "utilities_assessment": "...",
    "estimated_monthly_utilities_eur": null,
    "renovation_assessment": "...",
    "estimated_renovation_cost_eur": null,
    "upkeep_notes": ["..."]
  },
  "legal_and_technical_checks": {
    "registration_status": "...",
    "heating": "...",
    "building_age": "...",
    "red_flags": [],
    "recommended_checks": ["..."]
  },
  "negotiation_strategy": {
    "target_discount_pct": 7,
    "leverage_points": ["..."],
    "script_lines": ["...", "...", "..."]
  },
  "dynamic_faq": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}
```

## Error Response

Errors use this shape:

```json
{
  "error": {
    "code": "invalid_payload",
    "message": "Podaci oglasa nisu u ocekivanom formatu.",
    "details": []
  }
}
```

Stable error codes: `invalid_json`, `invalid_payload`, `missing_auth`, `invalid_session`, `configuration`, `rate_limited`, `provider_error`.

## Save listing API

`POST /api/scan/save` persists an analyzed listing for the authenticated user.

### Authentication

Same Bearer token as analyze. Credits are **not** deducted here (unlock already charges).

### Request body (key fields)

```json
{
  "title": "Stan na Vracaru",
  "location": "Beograd, Vracar",
  "price": "120.000 €",
  "portal_url": "https://example.com/oglas/123",
  "ai_analysis": {},
  "contact_details": {},
  "detection": { "listing": { "listing_url": "https://example.com/oglas/123" } }
}
```

`portal_url` (or `listing_url` / `detection.listing.listing_url`) is required.

### Success response

```json
{
  "ok": true,
  "saved_property_id": 1,
  "listing_id": 1,
  "credits_remaining": 4
}
```

### Save error codes

`invalid_json`, `invalid_payload`, `missing_auth`, `invalid_session`, `configuration`, `listing_conflict`, `database_error`.

## Environment

Server-side Claude integration requires `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` is optional and defaults to the current Sonnet model configured in the service.
