import 'server-only'

import { z, ZodError } from 'zod/v4'

import { type PropertyScanRequest } from './propertyAnalysisSchema'
import { PROPERTY_ANALYSIS_SYSTEM_PROMPT } from './propertyAnalysisPrompt'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5'
const FALLBACK_MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 3500

type ClaudeContentBlock = {
  type?: string
  text?: string
}

type AnthropicDirectResponse = {
  content?: ClaudeContentBlock[]
}

type AnthropicFetchResult =
  | {
      ok: true
      body: AnthropicDirectResponse
    }
  | {
      ok: false
      status: number
      rawErrorPayload: unknown
    }

export type ClaudeServiceErrorCode =
  | 'configuration'
  | 'rate_limited'
  | 'timeout'
  | 'provider_unavailable'
  | 'provider_error'
  | 'invalid_response'

export class ClaudeServiceError extends Error {
  constructor(
    readonly code: ClaudeServiceErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ClaudeServiceError'
  }
}

const SerbianPropertyAnalysisSchema = z
  .object({
    sažetak: z.string().min(1),
    procena_vrednosti: z
      .object({
        tržišna_procena: z.enum(['Precenjeno', 'Realno', 'Povoljno']),
        odstupanje_od_tržišta_procenat: z.number().finite(),
        cena_po_m2: z.number().finite().nonnegative(),
        obrazloženje: z.string().min(1),
      })
      .strict(),
    troškovi: z
      .object({
        procena_režija: z.string().min(1),
        mesečne_režije_eur: z.number().finite().nonnegative().nullable(),
        procena_renoviranja: z.string().min(1),
        trošak_renoviranja_eur: z.number().finite().nonnegative().nullable(),
        napomene_o_održavanju: z.array(z.string().min(1)).min(1).max(6),
      })
      .strict(),
    pravne_i_tehničke_provere: z
      .object({
        uknjiženost: z.string().min(1),
        grejanje: z.string().min(1),
        starost_zgrade: z.string().min(1),
        crvene_zastavice: z.array(z.string().min(1)).max(6),
        preporučene_provere: z.array(z.string().min(1)).min(1).max(6),
      })
      .strict(),
    kontakt: z
      .object({
        telefon: z.string().nullable(),
        ime_vlasnika: z.string().nullable(),
        agencija: z.string().nullable(),
      })
      .strict(),
    strategija_pregovaranja: z
      .object({
        ciljani_popust_procenat: z.number().finite().min(0).max(15),
        argumenti_za_spuštanje_cene: z.array(z.string().min(1)).min(1).max(5),
        skripte_za_pregovor: z.array(z.string().min(1)).min(3).max(4),
      })
      .strict(),
    dinamička_pitanja: z
      .array(
        z
          .object({
            pitanje: z.string().min(1),
            odgovor: z.string().min(1),
          })
          .strict(),
      )
      .min(3)
      .max(5),
  })
  .strict()

type SerbianPropertyAnalysis = z.infer<typeof SerbianPropertyAnalysisSchema>

function getAnthropicApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new ClaudeServiceError(
      'configuration',
      'Anthropic API key is not configured.',
    )
  }

  return apiKey
}

function getRequestedModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL
}

function extractResponseText(content: ClaudeContentBlock[]) {
  const text = content
    .filter(
      (block): block is ClaudeContentBlock & { text: string } =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new ClaudeServiceError(
      'invalid_response',
      'Claude response did not include text content.',
    )
  }

  return text
}

function getFallbackPropertyAnalysis(
  listing?: PropertyScanRequest,
): SerbianPropertyAnalysis {
  return {
    sažetak:
      'Analiza je delimično dostupna jer je AI odgovor prekinut. Proverite cenu, lokaciju i stanje objekta pre odluke.',
    procena_vrednosti: {
      tržišna_procena: 'Realno',
      odstupanje_od_tržišta_procenat: 0,
      cena_po_m2:
        listing && listing.m2 > 0
          ? Math.round(listing.price / listing.m2)
          : 0,
      obrazloženje:
        'Nije moguće dati potpunu procenu jer je AI odgovor bio nekompletan. Koristite dostupne podatke oglasa kao orijentir.',
    },
    troškovi: {
      procena_režija: 'Nepoznato na osnovu nekompletnog AI odgovora.',
      mesečne_režije_eur: null,
      procena_renoviranja: 'Nepoznato na osnovu nekompletnog AI odgovora.',
      trošak_renoviranja_eur: null,
      napomene_o_održavanju: [
        'Tražite potvrdu mesečnih režija i stanja instalacija od oglašivača.',
      ],
    },
    pravne_i_tehničke_provere: {
      uknjiženost: 'Nepoznato – proveriti list nepokretnosti.',
      grejanje: listing?.heating || 'Nepoznato',
      starost_zgrade: 'Nepoznato',
      crvene_zastavice: ['AI odgovor je bio nekompletan, pa su podaci ograničeni.'],
      preporučene_provere: [
        'Proveriti uknjiženost i terete.',
        'Potvrditi grejanje i godinu izgradnje.',
      ],
    },
    kontakt: {
      telefon: listing?.phone || null,
      ime_vlasnika: listing?.owner_name || null,
      agencija: listing?.agency_name || null,
    },
    strategija_pregovaranja: {
      ciljani_popust_procenat: 5,
      argumenti_za_spuštanje_cene: [
        'Zatražite dodatne dokaze o stanju i troškovima pre konačne ponude.',
      ],
      skripte_za_pregovor: [
        'Možete li potvrditi uknjiženost i eventualne terete?',
        'Kolike su prosečne mesečne režije i da li ima planiranih troškova?',
        'Da li je cena fleksibilna ako brzo zatvorimo dogovor?',
      ],
    },
    dinamička_pitanja: [
      {
        pitanje: 'Da li je nekretnina uknjižena?',
        odgovor: 'Proverite list nepokretnosti pre kupovine.',
      },
      {
        pitanje: 'Kolike su mesečne režije?',
        odgovor: 'Tražite potvrdu od vlasnika ili uprave zgrade.',
      },
      {
        pitanje: 'Da li je cena pregovaračka?',
        odgovor: 'Većina oglasa ostavlja prostor za korekciju od 5-10%.',
      },
    ],
  }
}

function stripMarkdownCodeFences(responseContent: string) {
  return responseContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim()
}

function extractJsonCandidate(text: string) {
  const start = text.indexOf('{')
  if (start < 0) return text

  const end = text.lastIndexOf('}')
  if (end > start) {
    return text.slice(start, end + 1)
  }

  return text.slice(start)
}

function repairTruncatedJson(raw: string) {
  let text = raw.trim()

  // Close an unfinished string if quotes are unbalanced.
  const quoteCount = (text.match(/(?<!\\)"/g) || []).length
  if (quoteCount % 2 === 1) {
    text += '"'
  }

  // Remove trailing incomplete key/value fragments.
  text = text
    .replace(/,\s*"[^"]*$/g, '')
    .replace(/,\s*[^,{}\[\]\s"]+$/g, '')
    .replace(/:\s*$/g, ': null')
    .replace(/,\s*$/g, '')

  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') stack.push('}')
    if (char === '[') stack.push(']')
    if ((char === '}' || char === ']') && stack.length > 0) {
      const expected = stack[stack.length - 1]
      if (char === expected) stack.pop()
    }
  }

  while (stack.length > 0) {
    text += stack.pop()
  }

  return text
}

function tryParseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false as const, value: null }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMergeFallback(
  fallback: SerbianPropertyAnalysis,
  partial: unknown,
): SerbianPropertyAnalysis {
  if (!isPlainObject(partial)) return fallback

  const merged: SerbianPropertyAnalysis = {
    ...fallback,
    ...partial,
    procena_vrednosti: {
      ...fallback.procena_vrednosti,
      ...(isPlainObject(partial.procena_vrednosti)
        ? partial.procena_vrednosti
        : {}),
    },
    troškovi: {
      ...fallback.troškovi,
      ...(isPlainObject(partial.troškovi) ? partial.troškovi : {}),
    },
    pravne_i_tehničke_provere: {
      ...fallback.pravne_i_tehničke_provere,
      ...(isPlainObject(partial.pravne_i_tehničke_provere)
        ? partial.pravne_i_tehničke_provere
        : {}),
    },
    kontakt: {
      ...fallback.kontakt,
      ...(isPlainObject(partial.kontakt) ? partial.kontakt : {}),
    },
    strategija_pregovaranja: {
      ...fallback.strategija_pregovaranja,
      ...(isPlainObject(partial.strategija_pregovaranja)
        ? partial.strategija_pregovaranja
        : {}),
    },
    dinamička_pitanja: Array.isArray(partial.dinamička_pitanja)
      ? (partial.dinamička_pitanja as SerbianPropertyAnalysis['dinamička_pitanja'])
      : fallback.dinamička_pitanja,
  }

  const parsed = SerbianPropertyAnalysisSchema.safeParse(merged)
  return parsed.success ? parsed.data : fallback
}

function parseClaudeJsonResponse(
  responseContent: string,
  listing?: PropertyScanRequest,
) {
  const withoutFence = stripMarkdownCodeFences(responseContent)
  const candidate = extractJsonCandidate(withoutFence)
  const fallback = getFallbackPropertyAnalysis(listing)

  const direct = tryParseJson(candidate)
  if (direct.ok) {
    return deepMergeFallback(fallback, direct.value)
  }

  const repaired = tryParseJson(repairTruncatedJson(candidate))
  if (repaired.ok) {
    console.error('CLAUDE_JSON_REPAIRED: truncated response was repaired.')
    return deepMergeFallback(fallback, repaired.value)
  }

  console.error(
    'CLAUDE_JSON_FALLBACK: response was truncated/invalid. Using safe fallback.',
  )
  return fallback
}

function maskAnthropicApiKey(apiKey: string | undefined) {
  const trimmed = apiKey?.trim()
  if (!trimmed) return 'not-loaded'

  return `${trimmed.slice(0, 7)}...`
}

async function readRawErrorPayload(response: Response) {
  const rawText = await response.text()

  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

function logRawAnthropicError(rawErrorPayload: unknown) {
  console.error('====== ANTHROPIC RAW ERROR START ======')
  console.error(
    'ANTHROPIC_API_KEY_MASKED:',
    maskAnthropicApiKey(process.env.ANTHROPIC_API_KEY),
  )
  console.error(JSON.stringify(rawErrorPayload, null, 2))
  console.error('====== ANTHROPIC RAW ERROR END ======')
}

function mapFetchError(error: unknown): ClaudeServiceError {
  if (error instanceof ClaudeServiceError) return error

  if (error instanceof ZodError) {
    return new ClaudeServiceError(
      'invalid_response',
      'Claude response did not match the required analysis schema.',
      error,
    )
  }

  return new ClaudeServiceError(
    'provider_error',
    'Claude analysis failed unexpectedly.',
    error,
  )
}

function mapAnthropicHttpError(status: number, body: unknown) {
  if (status === 401 || status === 403) {
    return new ClaudeServiceError(
      'configuration',
      'Anthropic API authentication is not configured correctly.',
      body,
    )
  }

  if (status === 429) {
    return new ClaudeServiceError(
      'rate_limited',
      'Anthropic API rate limit was reached.',
      body,
    )
  }

  if (status >= 500) {
    return new ClaudeServiceError(
      'provider_unavailable',
      'Anthropic API is currently unavailable.',
      body,
    )
  }

  return new ClaudeServiceError(
    'provider_error',
    'Anthropic API returned an error.',
    body,
  )
}

function getAnthropicErrorType(rawErrorPayload: unknown) {
  if (!rawErrorPayload || typeof rawErrorPayload !== 'object') return null

  const payload = rawErrorPayload as {
    type?: unknown
    error?: { type?: unknown }
  }
  const errorType = payload.error?.type ?? payload.type

  return typeof errorType === 'string' ? errorType : null
}

function isModelNotFoundError(status: number, rawErrorPayload: unknown) {
  return status === 404 && getAnthropicErrorType(rawErrorPayload) === 'not_found_error'
}

async function fetchAnthropicMessage(
  listing: PropertyScanRequest,
  model: string,
): Promise<AnthropicFetchResult> {
  console.log('USING_CLAUDE_MODEL:', model)

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': getAnthropicApiKey(),
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: DIRECT_FETCH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(listing),
        },
      ],
    }),
  })

  if (!response.ok) {
    const rawErrorPayload = await readRawErrorPayload(response)
    logRawAnthropicError(rawErrorPayload)

    return {
      ok: false,
      status: response.status,
      rawErrorPayload,
    }
  }

  return {
    ok: true,
    body: (await response.json()) as AnthropicDirectResponse,
  }
}

const DIRECT_FETCH_SYSTEM_PROMPT = `${PROPERTY_ANALYSIS_SYSTEM_PROMPT}

Respond ONLY with valid JSON. Do not write introductory text, markdown explanations, or comments.
Vrati isključivo jedan validan JSON objekat bez Markdown-a, code fence-a i dodatnog teksta.
Svi JSON ključevi, vrednosti, oznake, sažeci, crvene zastavice, pregovarački argumenti i FAQ moraju biti na srpskom jeziku, Latinica.
Ne koristi engleske ključeve kao summary, valuation, costs_breakdown, legal_and_technical_checks, negotiation_strategy ili dynamic_faq.
Ako u podacima postoji telefon, ime vlasnika ili naziv agencije, obavezno ih prepiši u objekat "kontakt"; ako ne postoji, koristi null.
Piši kratko i konkretno, bez filler teksta. Uvek zatvori sve zagrade i nizove da JSON bude kompletan.

JSON mora imati tačno sledeće srpske ključeve:
{
  "sažetak": string,
  "procena_vrednosti": {
    "tržišna_procena": "Precenjeno" | "Realno" | "Povoljno",
    "odstupanje_od_tržišta_procenat": number,
    "cena_po_m2": number,
    "obrazloženje": string
  },
  "troškovi": {
    "procena_režija": string,
    "mesečne_režije_eur": number | null,
    "procena_renoviranja": string,
    "trošak_renoviranja_eur": number | null,
    "napomene_o_održavanju": string[]
  },
  "pravne_i_tehničke_provere": {
    "uknjiženost": string,
    "grejanje": string,
    "starost_zgrade": string,
    "crvene_zastavice": string[],
    "preporučene_provere": string[]
  },
  "kontakt": {
    "telefon": string | null,
    "ime_vlasnika": string | null,
    "agencija": string | null
  },
  "strategija_pregovaranja": {
    "ciljani_popust_procenat": number,
    "argumenti_za_spuštanje_cene": string[],
    "skripte_za_pregovor": string[]
  },
  "dinamička_pitanja": [{ "pitanje": string, "odgovor": string }]
}`.trim()

export async function analyzePropertyListing(
  listing: PropertyScanRequest,
): Promise<SerbianPropertyAnalysis> {
  try {
    const primaryModel = getRequestedModel()
    let result = await fetchAnthropicMessage(listing, primaryModel)

    if (
      !result.ok &&
      primaryModel !== FALLBACK_MODEL &&
      isModelNotFoundError(result.status, result.rawErrorPayload)
    ) {
      console.error(
        'ANTHROPIC_MODEL_FALLBACK:',
        `${primaryModel} -> ${FALLBACK_MODEL}`,
      )
      result = await fetchAnthropicMessage(listing, FALLBACK_MODEL)
    }

    if (!result.ok) {
      throw mapAnthropicHttpError(result.status, result.rawErrorPayload)
    }

    const responseContent = extractResponseText(result.body.content ?? [])
    return parseClaudeJsonResponse(responseContent, listing)
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('CLAUDE_JSON_SYNTAX_FALLBACK:', err.message)
      return getFallbackPropertyAnalysis(listing)
    }

    console.error('DIRECT_FETCH_ERROR:', err)
    throw mapFetchError(err)
  }
}
