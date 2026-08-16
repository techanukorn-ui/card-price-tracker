import { Card, PriceHistory } from './types'

export interface PortfolioPoint {
  date: string
  totalCost: number
  totalValue: number
}

// Reconstructs a "total cost vs total market value" time series for all
// owned (non-wishlist) cards, using every price_history snapshot as a point
// in time. At each timestamp, a card contributes its most recent known
// price at-or-before that time (and is skipped from the value sum until it
// has at least one snapshot).
export function buildPortfolioSeries(cards: Card[], priceHistory: PriceHistory[]): PortfolioPoint[] {
  const myCards = cards.filter((c) => !c.is_wishlist)
  if (myCards.length === 0) return []

  const byCard = new Map<string, PriceHistory[]>()
  for (const c of myCards) byCard.set(c.id, [])
  for (const p of priceHistory) {
    const arr = byCard.get(p.card_id)
    if (arr) arr.push(p)
  }
  for (const arr of byCard.values()) {
    arr.sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())
  }

  const timestamps = Array.from(
    new Set(myCards.flatMap((c) => byCard.get(c.id) || []).map((p) => p.fetched_at))
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  if (timestamps.length === 0) return []

  const points = timestamps.map((ts) => {
    const t = new Date(ts).getTime()
    let totalCost = 0
    let totalValue = 0
    for (const c of myCards) {
      const created = new Date(c.created_at).getTime()
      if (created > t) continue
      totalCost += c.cost_thb ?? 0
      const history = byCard.get(c.id) || []
      let latest: PriceHistory | null = null
      for (const p of history) {
        if (new Date(p.fetched_at).getTime() <= t) latest = p
        else break
      }
      if (latest) totalValue += latest.market_price_thb * (c.quantity ?? 1)
    }
    return { date: ts, totalCost, totalValue }
  })

  // Collapse same-day points down to the last one per day, so the trend
  // stays readable even when prices are pulled multiple times in one day.
  const lastByDay = new Map<string, PortfolioPoint>()
  for (const p of points) {
    lastByDay.set(p.date.slice(0, 10), p)
  }
  return Array.from(lastByDay.values())
}
