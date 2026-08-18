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
    const info = calcProfit(c.cost_thb, p.market_price_thb * qty)
    if (!info) continue
    ranked.push({ card: c, profit: info.profit, marginPct: info.marginPct })
  }

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="font-display text-base font-medium text-slate-800 dark:text-slate-200">กำไร/ขาดทุนสูงสุด</p>
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูลราคาเพียงพอ</p>
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
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="font-display text-base font-medium text-slate-800 dark:text-slate-200">กำไร/ขาดทุนสูงสุด</p>

      {gainers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">กำไรสูงสุด</p>
          <div>
            {gainers.map(({ card, profit, marginPct }) => (
              <MoverRow key={card.id} name={card.name} profit={profit} marginPct={marginPct} />
            ))}
          </div>
        </div>
      )}

      {losers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">ขาดทุนสูงสุด</p>
          <div>
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
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 py-2 text-xs first:border-t-0 dark:border-slate-800">
      <span className="line-clamp-1 flex-1 text-slate-600 dark:text-slate-300">{name}</span>
      <span
        className={`num flex shrink-0 items-center gap-1 font-semibold ${
          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
        }`}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" className="shrink-0">
          {positive ? (
            <path d="M5 1 L9 8 L1 8 Z" fill="currentColor" />
          ) : (
            <path d="M5 9 L9 2 L1 2 Z" fill="currentColor" />
          )}
        </svg>
        {formatSigned(profit, formatTHB)} ({formatPct(marginPct)})
      </span>
    </div>
  )
}
