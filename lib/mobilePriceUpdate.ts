import { supabase } from './supabaseClient'
import { PriceUpdateCardInput } from './priceUpdateBridge'
import { getFixedExchangeRate } from './appSettings'

// Drives the iOS-friendly "batch update via one tab that redirects itself"
// flow (see browser-extension/ios-userscript.user.js). Unlike the Chrome
// extension flow (lib/priceUpdateBridge.ts), there is no background page to
// hold job state between cards — every card is a full page navigation to
// SNKRDUNK. The queue itself is persisted server-side (mobile_price_jobs
// table, via /api/mobile-queue) rather than riding along in the URL — an
// earlier version base64-encoded the whole queue into every hop's URL, which
// SNKRDUNK/CloudFront started rejecting with 414 (URI Too Long) once a
// combined "การ์ดของฉัน + wishlist" batch got big enough. Now each hop's URL
// only carries a short token + index, so URL length no longer scales with
// batch size. Progress is observed by polling price_history instead of
// receiving postMessage/CustomEvent callbacks.

export interface MobileQueueItem {
  id: string
  url: string
  grade: string
  rawCondition: string | null
  itemType: string
  hasImage: boolean
}

export interface MobileBatchJob {
  token: string
  cardIds: string[]
  total: number
  startedAt: string // ISO timestamp, used as the "since" cursor when polling
}

// Reads the user's fixed JPY→THB rate (set via the "เรทค่าเงิน" button) —
// not a live lookup. See lib/appSettings.ts for the rationale.
export async function fetchExchangeRate(): Promise<number> {
  const setting = await getFixedExchangeRate()
  if (!setting) throw new Error('ยังไม่ได้ตั้งเรทค่าเงิน — กดปุ่ม "เรทค่าเงิน" ที่หัวเว็บเพื่อตั้งค่าก่อน')
  return setting.rate
}

function buildStepUrl(
  queue: MobileQueueItem[],
  index: number,
  token: string,
  apiUrl: string,
  queueApiUrl: string,
  rate: number
): string {
  const target = new URL(queue[index].url)
  target.searchParams.set('cpt_i', String(index))
  target.searchParams.set('cpt_t', token)
  target.searchParams.set('cpt_api', apiUrl)
  target.searchParams.set('cpt_qapi', queueApiUrl)
  target.searchParams.set('cpt_rate', String(rate))
  return target.toString()
}

// Builds the URL to open for card #0 of the batch, after persisting the full
// queue server-side. The userscript reads the same cpt_* params back out of
// location.href on every subsequent hop, so only the first URL needs to be
// built here — it fetches the queue itself via cpt_qapi.
export async function buildMobileBatchStartUrl(
  cards: PriceUpdateCardInput[],
  exchangeRate: number
): Promise<{ url: string; job: MobileBatchJob } | null> {
  const queue: MobileQueueItem[] = cards
    .filter((c) => !!c.url)
    .map((c) => ({
      id: c.id,
      url: c.url,
      grade: c.grade,
      rawCondition: c.rawCondition,
      itemType: c.itemType,
      hasImage: c.hasImage,
    }))

  if (queue.length === 0) return null

  const token = `mjob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const apiUrl = `${window.location.origin}/api/update-price-mobile`
  const queueApiUrl = `${window.location.origin}/api/mobile-queue`

  const res = await fetch(queueApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, queue }),
  })
  if (!res.ok) throw new Error('บันทึกคิวอัปเดตราคาไม่สำเร็จ')

  const url = buildStepUrl(queue, 0, token, apiUrl, queueApiUrl, exchangeRate)

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
