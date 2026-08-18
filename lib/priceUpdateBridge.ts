import { Card } from './types'

// Talks to the "Card Price Tracker - SNKRDUNK Auto Update" Chrome extension
// (browser-extension/ folder) via window CustomEvents. The extension's
// content script listens for 'cpt:update-request' and dispatches
// 'cpt:progress' / 'cpt:card-result' / 'cpt:done' back.

export interface PriceUpdateCardInput {
  id: string
  name: string
  url: string
  grade: string
  rawCondition: string | null
  itemType: string
  hasImage: boolean
}

export interface PriceUpdateProgress {
  jobId: string
  total: number
  completed: number
  currentId?: string
}

export interface PriceUpdateCardResult {
  jobId: string
  cardId: string
  ok: boolean
  price_jpy?: number
  error?: string
}

export interface PriceUpdateDone {
  jobId: string
  successCount: number
  failCount: number
  failures: { cardId: string; error: string }[]
}

export function isExtensionInstalled(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.cptExtension === '1'
}

export function cardToUpdateInput(card: Card): PriceUpdateCardInput | null {
  if (!card.snkrdunk_url) return null
  return {
    id: card.id,
    name: card.name,
    url: card.snkrdunk_url,
    grade: card.grade,
    rawCondition: card.raw_condition,
    itemType: card.item_type,
    hasImage: !!(card.image_url || card.custom_image_url),
  }
}

export function requestPriceUpdate(cards: PriceUpdateCardInput[]): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  window.dispatchEvent(
    new CustomEvent('cpt:update-request', {
      detail: {
        jobId,
        cards: cards.map(({ id, url, grade, rawCondition, itemType, hasImage }) => ({
          id,
          url,
          grade,
          rawCondition,
          itemType,
          hasImage,
        })),
      },
    })
  )
  return jobId
}

export const EXTENSION_STALE_HINT =
  'Extension เพิ่งอัปเดต/รีโหลดใหม่ ทำให้หน้านี้หลุดการเชื่อมต่อชั่วคราว\n\n' +
  'แค่รีเฟรชหน้านี้ (กด F5 หรือ Ctrl+R) แล้วลองกดปุ่มดึงราคาอีกครั้งครับ'

export function listenForExtensionStale(onStale: () => void): () => void {
  const handler = () => onStale()
  window.addEventListener('cpt:extension-stale', handler)
  return () => window.removeEventListener('cpt:extension-stale', handler)
}

export const EXTENSION_INSTALL_HINT =
  'ยังไม่ได้ติดตั้ง Extension สำหรับดึงราคา\n\n' +
  'วิธีติดตั้ง (ทำครั้งเดียว):\n' +
  '1. เปิด chrome://extensions ในเบราว์เซอร์\n' +
  '2. เปิดสวิตช์ "โหมดนักพัฒนา" (Developer mode) มุมขวาบน\n' +
  '3. กด "โหลดส่วนขยายที่ยังไม่ได้แพ็ก" (Load unpacked)\n' +
  '4. เลือกโฟลเดอร์ browser-extension ในโปรเจกต์ card-price-tracker\n' +
  '5. รีเฟรชหน้านี้แล้วลองใหม่'
