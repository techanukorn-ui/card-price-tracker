'use client'

import { Card, PriceHistory } from '@/lib/types'
import { calcProfit, formatPct, formatSigned, formatTHB } from '@/lib/format'

interface Props {
  cards: Card[]
  latestPriceByCard: Map<string, PriceHistory>
}

interface Ranked {
  card: Card
  profit: number
  marginPct: number
}

export default function TopMovers({ cards, latestPriceByCard }: Props) {
  const ranked: Ranked[] = []
  for (const c of cards) {
    const p = latestPriceByCard.get(c.id)
    if (!p) continue
    const qty = c.quantity ?? 1
    const totalCost = c.cost_thb !== null && c.cost_thb !== undefined ? c.cost_thb * qty : null
    const info = calcProfit(totalCost, p.market_price_thb * qty)
    if (!info) continue
    ranked.push({ card: c, profit: info.profit, marginPct: info.marginPct })
  }

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">กำไร/ขาดทุนสูงสุด</p>
        <p className="mt-3 text-center text-xs text-slate-400">ยังไม่มีข้อมูลราคาเพียงพอ</p>
      </div>
    )
  }

  const gainers = ranked
    .filter((r) => r.profit >= 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3)
  const losers = ranked
    .filter((r) => r.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 3)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">กำไร/ขาดทุนสูงสุด</p>

      {gainers.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">กำไรสูงสุด</p>
          <div className="space-y-1.5">
            {gainers.map(({ card, profit, marginPct }) => (
              <MoverRow key={card.id} name={card.name} profit={profit} marginPct={marginPct} />
            ))}
          </div>
        </div>
      )}

      {losers.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">ขาดทุนสูงสุด</p>
          <div className="space-y-1.5">
            {losers.map(({ card, profit, marginPct }) => (
              <MoverRow key={card.id} name={card.name} profit={profit} marginPct={marginPct} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MoverRow({ name, profit, marginPct }: { name: string; profit: number; marginPct: number }) {
  const positive = profit >= 0
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="line-clamp-1 flex-1 text-slate-600">{name}</span>
      <span className={`shrink-0 font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
        {formatSigned(profit, formatTHB)} ({formatPct(marginPct)})
      </span>
    </div>
  )
}
