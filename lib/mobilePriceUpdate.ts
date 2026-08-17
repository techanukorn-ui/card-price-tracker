import { supabase } from './supabaseClient'
import { PriceUpdateCardInput } from './priceUpdateBridge'

// Drives the iOS-friendly "batch update via one tab that redirects itself"
// flow (see browser-extension/ios-userscript.user.js). Unlike the Chrome
// extension flow (lib/priceUpdateBridge.ts), there is no background page to
// hold job state between cards — every card is a full page navigation to
// SNKRDUNK — so the whole remaining queue travels along as URL query params,
// and progress is observed by polling price_history instead of receiving
// postMessage/CustomEvent callbacks.

export interface MobileQueueItem {
  id: string
  url: string
  grade: string
  rawCondition: string | null
  itemType: string
}

export interface MobileBatchJob {
  token: string
  cardIds: string[]
  total: number
  startedAt: string // ISO timestamp, used as the "since" cursor when polling
}

const EXCHANGE_RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=THB'

export async function fetchExchangeRate(): Promise<number> {
  const res = await fetch(EXCHANGE_RATE_URL)
  const json = await res.json()
  const rate = json && json.rates && json.rates.THB
  if (typeof rate !== 'number') throw new Error('ดึงอัตราแลกเปลี่ยน JPY→THB ไม่สำเร็จ')
  return rate
}

// Plain base64 (not further URI-encoded) — URLSearchParams.set/toString()
// handles percent-encoding the +/=/ characters itself when it serializes the
// URL, so pre-encoding here would double-encode and corrupt the value.
function encodeQueue(queue: MobileQueueItem[]): string {
  const json = JSON.stringify(queue)
  return btoa(unescape(encodeURIComponent(json)))
}

function buildStepUrl(queue: MobileQueueItem[], index: number, token: string, apiUrl: string, rate: number): string {
  const target = new URL(queue[index].url)
  target.searchParams.set('cpt_q', encodeQueue(queue))
  target.searchParams.set('cpt_i', String(index))
  target.searchParams.set('cpt_t', token)
  target.searchParams.set('cpt_api', apiUrl)
  target.searchParams.set('cpt_rate', String(rate))
  return target.toString()
}

// Builds the URL to open for card #0 of the batch. The userscript reads the
// same cpt_* params back out of location.href on every subsequent hop, so
// only the first URL needs to be built here.
export function buildMobileBatchStartUrl(
  cards: PriceUpdateCardInput[],
  exchangeRate: number
): { url: string; job: MobileBatchJob } | null {
  const queue: MobileQueueItem[] = cards
    .filter((c) => !!c.url)
    .map((c) => ({ id: c.id, url: c.url, grade: c.grade, rawCondition: c.rawCondition, itemType: c.itemType }))

  if (queue.length === 0) return null

  const token = `mjob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const apiUrl = `${window.location.origin}/api/update-price-mobile`
  const url = buildStepUrl(queue, 0, token, apiUrl, exchangeRate)

  return {
    url,
    job: {
      token,
      cardIds: queue.map((c) => c.id),
      total: queue.length,
      startedAt: new Date().toISOString(),
    },
  }
}

// Returns how many of cardIds have gotten a fresh price_history row since
// job.startedAt — the only signal we have of progress, since the userscript
// can't call back into this page directly.
export async function countCompleted(job: MobileBatchJob): Promise<number> {
  const { data, error } = await supabase
    .from('price_history')
    .select('card_id')
    .in('card_id', job.cardIds)
    .gte('fetched_at', job.startedAt)

  if (error || !data) return 0
  return new Set(data.map((r: { card_id: string }) => r.card_id)).size
}

const STORAGE_KEY = 'cpt_mobile_job'

export function saveMobileJob(job: MobileBatchJob | null) {
  if (typeof window === 'undefined') return
  if (job) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
  else window.localStorage.removeItem(STORAGE_KEY)
}

export function loadMobileJob(): MobileBatchJob | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MobileBatchJob) : null
  } catch {
    return null
  }
}
