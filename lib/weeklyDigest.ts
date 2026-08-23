import { Card, PriceHistory } from './types'
import { calcProfit } from './format'

export interface WeeklyMover {
  name: string
  changeThb: number
  changePct: number
}

export interface WeeklyDigestData {
  cardCount: number
  pricedCardCount: number
  totalCost: number
  totalValue: number
  profit: number | null
  marginPct: number | null
  gainers: WeeklyMover[]
  losers: WeeklyMover[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type WeeklyDigestScope = 'mine' | 'wishlist'

// Pure, framework-agnostic — used by app/api/cron/weekly-digest so the
// digest math is testable independent of Supabase/Telegram. gainers/losers
// only include cards that have a price_history snapshot from ~7 days ago to
// compare against — a card that hasn't had two separate price pulls at
// least a week apart just doesn't have a "this week" change yet, so it's
// silently left out rather than guessed at.
//
// 'mine' scope matches Dashboard's owned-cards scope (not wishlist, not
// sold) and includes cost/profit. 'wishlist' cards never have a cost_thb
// (schema: null for wishlist rows) so profit/margin are meaningless there —
// profit/marginPct come back null unconditionally for that scope, and
// totalCost stays 0.
export function buildWeeklyDigest(
  cards: Card[],
  priceHistory: PriceHistory[],
  scope: WeeklyDigestScope,
  now: Date = new Date()
): WeeklyDigestData {
  const scopedCards = cards.filter((c) => (scope === 'wishlist' ? c.is_wishlist : !c.is_wishlist && !c.is_sold))

  const byCard = new Map<string, PriceHistory[]>()
  for (const c of scopedCards) byCard.set(c.id, [])
  for (const p of priceHistory) {
    byCard.get(p.card_id)?.push(p)
  }
  for (const arr of byCard.values()) {
    arr.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())
  }

  const weekAgoTime = now.getTime() - WEEK_MS

  let totalCost = 0
  let totalValue = 0
  let pricedCardCount = 0
  const movers: WeeklyMover[] = []

  for (const c of scopedCards) {
    const qty = c.quantity ?? 1
    if (scope === 'mine') totalCost += c.cost_thb ?? 0

    const history = byCard.get(c.id) || []
    const latest = history[0] || null
    if (!latest) continue
    pricedCardCount++
    totalValue += latest.market_price_thb * qty

    const weekAgoSnap = history.find((p) => new Date(p.fetched_at).getTime() <= weekAgoTime) || null
    if (weekAgoSnap && weekAgoSnap.id !== latest.id && weekAgoSnap.market_price_thb !== latest.market_price_thb) {
      const changeThb = (latest.market_price_thb - weekAgoSnap.market_price_thb) * qty
      const changePct =
        weekAgoSnap.market_price_thb === 0
          ? 0
          : ((latest.market_price_thb - weekAgoSnap.market_price_thb) / weekAgoSnap.market_price_thb) * 100
      movers.push({ name: c.name, changeThb, changePct })
    }
  }

  const profitInfo = scope === 'mine' && pricedCardCount > 0 ? calcProfit(totalCost, totalValue) : null

  return {
    cardCount: scopedCards.length,
    pricedCardCount,
    totalCost,
    totalValue,
    profit: profitInfo?.profit ?? null,
    marginPct: profitInfo?.marginPct ?? null,
    gainers: movers
      .filter((m) => m.changeThb > 0)
      .sort((a, b) => b.changeThb - a.changeThb)
      .slice(0, 3),
    losers: movers
      .filter((m) => m.changeThb < 0)
      .sort((a, b) => a.changeThb - b.changeThb)
      .slice(0, 3),
  }
}
