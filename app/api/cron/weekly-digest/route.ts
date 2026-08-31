import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildWeeklyDigest } from '@/lib/weeklyDigest'
import { escapeHtml, sendTelegramMessage } from '@/lib/telegram'
import { formatPct, formatSigned, formatTHB } from '@/lib/format'
import { fetchAllRows } from '@/lib/fetchAll'
import { PriceHistory } from '@/lib/types'

// GET /api/cron/weekly-digest — triggered by the Vercel Cron schedule in
// vercel.json (see there for the day/time). Sends a portfolio summary +
// this week's biggest movers to Telegram. Safe to hit manually too (e.g. to
// test): it just re-sends the current digest, no state is consumed.
//
// If a CRON_SECRET env var is set, requests must carry a matching
// `Authorization: Bearer <CRON_SECRET>` header — Vercel Cron adds this
// automatically once the env var exists. Left unenforced if the env var
// isn't set yet, so this works before that's configured.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  let cardsResult, priceHistory, settingsResult
  try {
    ;[cardsResult, priceHistory, settingsResult] = await Promise.all([
      supabaseAdmin.from('cards').select('*'),
      fetchAllRows<PriceHistory>(supabaseAdmin, 'price_history', '*'),
      supabaseAdmin.from('app_settings').select('telegram_bot_token, telegram_chat_id, jpy_thb_rate').eq('id', 1).maybeSingle(),
    ])
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
  if (cardsResult.error) {
    return NextResponse.json({ success: false, error: cardsResult.error.message }, { status: 500 })
  }
  const settings = settingsResult.data
  if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
    return NextResponse.json({ success: false, error: 'ยังไม่ได้ตั้งค่า Telegram' }, { status: 200 })
  }

  const cards = cardsResult.data || []
  const mineDigest = buildWeeklyDigest(cards, priceHistory, 'mine')
  const wishlistDigest = buildWeeklyDigest(cards, priceHistory, 'wishlist')
  const text = formatDigestMessage(mineDigest, wishlistDigest, settings.jpy_thb_rate ?? null, req.nextUrl.origin)

  await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, text)

  return NextResponse.json({ success: true, mineDigest, wishlistDigest })
}

function formatDigestMessage(
  mine: ReturnType<typeof buildWeeklyDigest>,
  wishlist: ReturnType<typeof buildWeeklyDigest>,
  jpyThbRate: number | null,
  siteOrigin: string
): string {
  const lines = ['📊 <b>สรุปพอร์ตประจำสัปดาห์</b>']

  if (jpyThbRate !== null) {
    lines.push(`เรทค่าเงินที่ใช้อยู่: 1 เยน = ${jpyThbRate} บาท`)
  }

  lines.push(
    '',
    '🗂 <b>การ์ดของฉัน</b>',
    `มูลค่าตลาดรวม: ${formatTHB(mine.totalValue)} (มีราคาแล้ว ${mine.pricedCardCount}/${mine.cardCount} ใบ)`,
    `ต้นทุนรวม: ${formatTHB(mine.totalCost)}`
  )

  if (mine.profit !== null && mine.marginPct !== null) {
    lines.push(`กำไร/ขาดทุนรวม: ${formatSigned(mine.profit, formatTHB)} (${formatPct(mine.marginPct)})`)
  }

  appendMovers(lines, mine, 'ขึ้นแรงสุดรอบสัปดาห์', 'ลงแรงสุดรอบสัปดาห์')

  if (wishlist.cardCount > 0) {
    lines.push(
      '',
      '⭐ <b>Wishlist</b>',
      `มูลค่าตลาดรวม: ${formatTHB(wishlist.totalValue)} (มีราคาแล้ว ${wishlist.pricedCardCount}/${wishlist.cardCount} ใบ)`
    )
    appendMovers(lines, wishlist, 'ขึ้นแรงสุดรอบสัปดาห์ (Wishlist)', 'ลงแรงสุดรอบสัปดาห์ (Wishlist)')
  }

  lines.push('', siteOrigin)
  return lines.join('\n')
}

function appendMovers(lines: string[], digest: ReturnType<typeof buildWeeklyDigest>, gainersLabel: string, losersLabel: string) {
  if (digest.gainers.length > 0) {
    lines.push('', `📈 <b>${gainersLabel}</b>`)
    digest.gainers.forEach((m, i) => {
      lines.push(`${i + 1}. ${escapeHtml(m.name)} ${formatSigned(m.changeThb, formatTHB)} (${formatPct(m.changePct)})`)
    })
  }

  if (digest.losers.length > 0) {
    lines.push('', `📉 <b>${losersLabel}</b>`)
    digest.losers.forEach((m, i) => {
      lines.push(`${i + 1}. ${escapeHtml(m.name)} ${formatSigned(m.changeThb, formatTHB)} (${formatPct(m.changePct)})`)
    })
  }

  if (digest.gainers.length === 0 && digest.losers.length === 0) {
    lines.push('', 'ยังไม่มีข้อมูลราคาย้อนหลัง 7 วันพอเทียบ — ต้องกดอัปเดตราคาซ้ำในช่วงนี้ก่อนถึงจะเห็นการเปลี่ยนแปลงรายสัปดาห์')
  }
}
