import 'server-only'

import { z, ZodError } from 'zod/v4'

import { type PropertyScanRequest } from './propertyAnalysisSchema'
import {
  buildPropertyAnalysisUserPrompt,
  PROPERTY_ANALYSIS_SYSTEM_PROMPT,
} from './propertyAnalysisPrompt'

const FORBIDDEN_UNKNOWN_PATTERN =
  /\b(nije\s+poznato|nije\s+navedeno|nepoznato|podatak\s+nije\s+naveden|n\/a)\b/i

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

function computePricePerM2(listing?: PropertyScanRequest) {
  if (!listing || !(listing.m2 > 0) || !(listing.price > 0)) return 0
  return Math.round(listing.price / listing.m2)
}

function classifySellerType(listing?: PropertyScanRequest) {
  const haystack = [
    listing?.advertiser_type,
    listing?.agency_name,
    listing?.owner_name,
    listing?.description,
    listing?.title,
    ...(listing?.features ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (
    /agencijsk|agencija|provizij|posrednik|broker|agency/.test(haystack)
  ) {
    return 'Agencijska prodaja'
  }

  if (
    /direktno\s+od\s+vlasnika|direktna\s+prodaja|bez\s+provizije|privatni\s+oglas|vlasnik/.test(
      haystack,
    )
  ) {
    return 'Direktna prodaja'
  }

  if (listing?.agency_name?.trim()) return 'Agencijska prodaja'
  if (listing?.owner_name?.trim()) return 'Direktna prodaja'

  return 'Agencijska prodaja'
}

function replaceForbiddenUnknown(value: string, fallback: string) {
  const trimmed = value.trim()
  if (!trimmed || FORBIDDEN_UNKNOWN_PATTERN.test(trimmed)) {
    return fallback
  }

  return trimmed
}

function getFallbackPropertyAnalysis(
  listing?: PropertyScanRequest,
): SerbianPropertyAnalysis {
  const pricePerM2 = computePricePerM2(listing)
  const location = listing?.location?.trim() || 'navedenoj lokaciji'
  const sellerType = classifySellerType(listing)

  return {
    sažetak: `Procena za oglas na lokaciji ${location}: fokusirajte cenu po m², pravni status i stanje instalacija pre konačne odluke.`,
    procena_vrednosti: {
      tržišna_procena: 'Realno',
      odstupanje_od_tržišta_procenat: 0,
      cena_po_m2: pricePerM2,
      obrazloženje:
        pricePerM2 > 0
          ? `Cena od ${pricePerM2} EUR/m² služi kao orijentir; uporedite sa sličnim oglasima u istoj zoni i stanju objekta.`
          : 'Koristite dostupnu cenu i kvadraturu kao orijentir i uporedite sa lokalnim tržištem.',
    },
    troškovi: {
      procena_režija:
        'Očekujte tipične režije za ovu lokaciju i tip objekta; potvrdite poslednje račune pre ugovora.',
      mesečne_režije_eur: null,
      procena_renoviranja:
        'Računajte na standardno osvežavanje (krečenje, instalacije) osim ako opis ne potvrdi nedavno renoviranje.',
      trošak_renoviranja_eur: null,
      napomene_o_održavanju: [
        'Tražite potvrdu mesečnih režija i stanja instalacija od oglašivača.',
        'Proverite troškove održavanja zgrade i eventualne fondove za investicije.',
      ],
    },
    pravne_i_tehničke_provere: {
      uknjiženost:
        'Potrebna provera uknjiženosti i tereta preko lista nepokretnosti pre avansa.',
      grejanje:
        listing?.heating?.trim() ||
        'Proveriti tip grejanja na licu mesta i prosečnu potrošnju u sezoni.',
      starost_zgrade:
        listing?.building_state?.trim() ||
        'Starost proceniti po lokaciji i tipu gradnje; tražiti godinu izgradnje od oglašivača.',
      crvene_zastavice: [
        'Potrebna provera uknjiženosti, tereta i stanja instalacija pre kupovine.',
      ],
      preporučene_provere: [
        'Proveriti uknjiženost i terete u katastru.',
        'Potvrditi grejanje, godinu izgradnje i stanje instalacija.',
        'Uporediti cenu po m² sa sličnim oglasima u istoj zoni.',
      ],
    },
    kontakt: {
      telefon: listing?.phone?.trim() || null,
      ime_vlasnika: listing?.owner_name?.trim() || sellerType,
      agencija: listing?.agency_name?.trim() || null,
    },
    strategija_pregovaranja: {
      ciljani_popust_procenat: 7,
      argumenti_za_spuštanje_cene: [
        pricePerM2 > 0
          ? `Cena od ${pricePerM2} EUR/m² ostavlja prostor za korekciju nakon provere stanja i pravnog statusa.`
          : 'Tražite korekciju cene nakon provere stanja, režija i pravnog statusa.',
        'Nedostajući ili nepotvrđeni podaci (uknjiženost, režije, renoviranje) su legitimna poluga za popust.',
        'Ponudite brzo zatvaranje uz uslovnu proveru dokumentacije.',
      ],
      skripte_za_pregovor: [
        'Možete li potvrditi uknjiženost i eventualne terete pre dogovora o ceni?',
        'Kolike su prosečne mesečne režije i da li ima planiranih troškova zgrade?',
        'Ako brzo zatvorimo uz čistu dokumentaciju, da li je cena fleksibilna za 5-10%?',
      ],
    },
    dinamička_pitanja: [
      {
        pitanje: `Kakav je pravni status nekretnine na lokaciji ${location}?`,
        odgovor:
          'Tražite list nepokretnosti i proveru tereta pre avansa; bez toga ne zatvarajte cenu.',
      },
      {
        pitanje: 'Kolike su realne mesečne režije za ovaj tip objekta?',
        odgovor:
          'Tražite poslednja 3-6 računa; za slične stanove računajte tipičan raspon po lokaciji i tipu grejanja.',
      },
      {
        pitanje: 'Koliko prostora ima za pregovor oko cene?',
        odgovor:
          pricePerM2 > 0
            ? `Uz ${pricePerM2} EUR/m² i otvorena pitanja o stanju, realan cilj je korekcija od 5-10%.`
            : 'Većina oglasa ostavlja prostor za korekciju od 5-10% uz brzo zatvaranje i čistu dokumentaciju.',
      },
    ],
  }
}

function ensureSellerContact(
  analysis: SerbianPropertyAnalysis,
  listing: PropertyScanRequest,
): SerbianPropertyAnalysis {
  const sellerType = classifySellerType(listing)
  const ownerName = analysis.kontakt.ime_vlasnika?.trim() || listing.owner_name?.trim()
  const agency = analysis.kontakt.agencija?.trim() || listing.agency_name?.trim() || null
  const phone = analysis.kontakt.telefon?.trim() || listing.phone?.trim() || null

  const resolvedOwner =
    ownerName && !FORBIDDEN_UNKNOWN_PATTERN.test(ownerName)
      ? ownerName
      : sellerType

  return {
    ...analysis,
    kontakt: {
      telefon: phone,
      ime_vlasnika: resolvedOwner,
      agencija: agency && !FORBIDDEN_UNKNOWN_PATTERN.test(agency) ? agency : null,
    },
  }
}

function sanitizeAnalysisStrings(
  analysis: SerbianPropertyAnalysis,
  listing: PropertyScanRequest,
): SerbianPropertyAnalysis {
  const fallback = getFallbackPropertyAnalysis(listing)

  return {
    ...analysis,
    sažetak: replaceForbiddenUnknown(analysis.sažetak, fallback.sažetak),
    procena_vrednosti: {
      ...analysis.procena_vrednosti,
      obrazloženje: replaceForbiddenUnknown(
        analysis.procena_vrednosti.obrazloženje,
        fallback.procena_vrednosti.obrazloženje,
      ),
    },
    troškovi: {
      ...analysis.troškovi,
      procena_režija: replaceForbiddenUnknown(
        analysis.troškovi.procena_režija,
        fallback.troškovi.procena_režija,
      ),
      procena_renoviranja: replaceForbiddenUnknown(
        analysis.troškovi.procena_renoviranja,
        fallback.troškovi.procena_renoviranja,
      ),
      napomene_o_održavanju: (() => {
        const notes = analysis.troškovi.napomene_o_održavanju
          .map((note) =>
            replaceForbiddenUnknown(note, fallback.troškovi.napomene_o_održavanju[0]),
          )
          .filter(Boolean)
          .slice(0, 6)

        return notes.length > 0 ? notes : fallback.troškovi.napomene_o_održavanju
      })(),
    },
    pravne_i_tehničke_provere: {
      ...analysis.pravne_i_tehničke_provere,
      uknjiženost: replaceForbiddenUnknown(
        analysis.pravne_i_tehničke_provere.uknjiženost,
        fallback.pravne_i_tehničke_provere.uknjiženost,
      ),
      grejanje: replaceForbiddenUnknown(
        analysis.pravne_i_tehničke_provere.grejanje,
        fallback.pravne_i_tehničke_provere.grejanje,
      ),
      starost_zgrade: replaceForbiddenUnknown(
        analysis.pravne_i_tehničke_provere.starost_zgrade,
        fallback.pravne_i_tehničke_provere.starost_zgrade,
      ),
      crvene_zastavice: analysis.pravne_i_tehničke_provere.crvene_zastavice
        .map((flag) =>
          replaceForbiddenUnknown(
            flag,
            fallback.pravne_i_tehničke_provere.crvene_zastavice[0],
          ),
        )
        .filter(Boolean),
      preporučene_provere: analysis.pravne_i_tehničke_provere.preporučene_provere
        .map((item, index) =>
          replaceForbiddenUnknown(
            item,
            fallback.pravne_i_tehničke_provere.preporučene_provere[
              Math.min(
                index,
                fallback.pravne_i_tehničke_provere.preporučene_provere.length - 1,
              )
            ],
          ),
        )
        .filter(Boolean),
    },
    strategija_pregovaranja: {
      ...analysis.strategija_pregovaranja,
      argumenti_za_spuštanje_cene:
        analysis.strategija_pregovaranja.argumenti_za_spuštanje_cene
          .map((item, index) =>
            replaceForbiddenUnknown(
              item,
              fallback.strategija_pregovaranja.argumenti_za_spuštanje_cene[
                Math.min(
                  index,
                  fallback.strategija_pregovaranja.argumenti_za_spuštanje_cene
                    .length - 1,
                )
              ],
            ),
          )
          .filter(Boolean),
      skripte_za_pregovor:
        analysis.strategija_pregovaranja.skripte_za_pregovor
          .map((item, index) =>
            replaceForbiddenUnknown(
              item,
              fallback.strategija_pregovaranja.skripte_za_pregovor[
                Math.min(
                  index,
                  fallback.strategija_pregovaranja.skripte_za_pregovor.length - 1,
                )
              ],
            ),
          )
          .filter(Boolean),
    },
    dinamička_pitanja: analysis.dinamička_pitanja.map((qa, index) => {
      const fallbackQa =
        fallback.dinamička_pitanja[
          Math.min(index, fallback.dinamička_pitanja.length - 1)
        ]

      return {
        pitanje: replaceForbiddenUnknown(qa.pitanje, fallbackQa.pitanje),
        odgovor: replaceForbiddenUnknown(qa.odgovor, fallbackQa.odgovor),
      }
    }),
  }
}

function ensureNegotiationAndFaq(
  analysis: SerbianPropertyAnalysis,
  listing: PropertyScanRequest,
): SerbianPropertyAnalysis {
  const fallback = getFallbackPropertyAnalysis(listing)

  const argumentsList =
    analysis.strategija_pregovaranja.argumenti_za_spuštanje_cene.length >= 2
      ? analysis.strategija_pregovaranja.argumenti_za_spuštanje_cene.slice(0, 5)
      : fallback.strategija_pregovaranja.argumenti_za_spuštanje_cene

  const scripts =
    analysis.strategija_pregovaranja.skripte_za_pregovor.length >= 3
      ? analysis.strategija_pregovaranja.skripte_za_pregovor.slice(0, 4)
      : fallback.strategija_pregovaranja.skripte_za_pregovor

  const faqs =
    analysis.dinamička_pitanja.length >= 3
      ? analysis.dinamička_pitanja.slice(0, 5)
      : fallback.dinamička_pitanja

  return {
    ...analysis,
    strategija_pregovaranja: {
      ...analysis.strategija_pregovaranja,
      argumenti_za_spuštanje_cene: argumentsList,
      skripte_za_pregovor: scripts,
    },
    dinamička_pitanja: faqs,
  }
}

/** Ensures cena_po_m2 and seller fields before the client response. */
export function enrichPropertyAnalysis(
  analysis: SerbianPropertyAnalysis,
  listing: PropertyScanRequest,
): SerbianPropertyAnalysis {
  const pricePerM2 = computePricePerM2(listing)
  const withPrice: SerbianPropertyAnalysis = {
    ...analysis,
    procena_vrednosti: {
      ...analysis.procena_vrednosti,
      cena_po_m2:
        analysis.procena_vrednosti.cena_po_m2 > 0
          ? analysis.procena_vrednosti.cena_po_m2
          : pricePerM2 > 0
            ? pricePerM2
            : analysis.procena_vrednosti.cena_po_m2,
    },
  }

  // Prefer deterministic price/m² whenever listing numbers are valid.
  if (pricePerM2 > 0) {
    withPrice.procena_vrednosti.cena_po_m2 = pricePerM2
  }

  const withSeller = ensureSellerContact(withPrice, listing)
  const sanitized = sanitizeAnalysisStrings(withSeller, listing)
  const complete = ensureNegotiationAndFaq(sanitized, listing)
  const fallback = getFallbackPropertyAnalysis(listing)

  if (complete.pravne_i_tehničke_provere.preporučene_provere.length < 1) {
    complete.pravne_i_tehničke_provere.preporučene_provere =
      fallback.pravne_i_tehničke_provere.preporučene_provere
  }

  if (complete.troškovi.napomene_o_održavanju.length < 1) {
    complete.troškovi.napomene_o_održavanju =
      fallback.troškovi.napomene_o_održavanju
  }

  const parsed = SerbianPropertyAnalysisSchema.safeParse(complete)
  if (parsed.success) return parsed.data

  const fallbackParsed = SerbianPropertyAnalysisSchema.safeParse(fallback)
  return fallbackParsed.success ? fallbackParsed.data : fallback
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
          content: buildPropertyAnalysisUserPrompt(listing),
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
ZABRANJENO: "Nije poznato", "Nije navedeno", "Nepoznato", "Podatak nije naveden", "N/A", prazni stringovi i cena_po_m2 = 0 kada postoje price i m2.
Ako u podacima postoji telefon, ime vlasnika ili naziv agencije, obavezno ih prepiši u objekat "kontakt".
Ako ime vlasnika nedostaje, u "ime_vlasnika" stavi klasifikaciju tipa prodavca: "Agencijska prodaja" ili "Direktna prodaja" (na osnovu opisa/provizije).
Za strategija_pregovaranja.argumenti_za_spuštanje_cene daj 2-3 konkretne taktike vezane za ovu cenu/m² i opis.
Za dinamička_pitanja daj 3-5 realističnih Q&A parova specifičnih za tip i lokaciju nekretnine.
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
    const parsed = parseClaudeJsonResponse(responseContent, listing)
    return enrichPropertyAnalysis(parsed, listing)
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('CLAUDE_JSON_SYNTAX_FALLBACK:', err.message)
      return enrichPropertyAnalysis(getFallbackPropertyAnalysis(listing), listing)
    }

    console.error('DIRECT_FETCH_ERROR:', err)
    throw mapFetchError(err)
  }
}
