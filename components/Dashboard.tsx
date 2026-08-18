'use client'

import { useMemo } from 'react'
import { Card, PriceHistory } from '@/lib/types'
import { formatPct, formatSigned, formatTHB } from '@/lib/format'
import { buildPortfolioSeries } from '@/lib/portfolio'
import PortfolioChart from './PortfolioChart'
import TopMovers from './TopMovers'
import CategoryBreakdown from './CategoryBreakdown'

interface Props {
  cards: Card[]
  priceHistory: PriceHistory[]
  latestPriceByCard: Map<string, PriceHistory>
}

export default function Dashboard({ cards, priceHistory, latestPriceByCard }: Props) {
  const myCards = useMemo(() => cards.filter((c) => !c.is_wishlist && !c.is_sold), [cards])

  const stats = useMemo(() => {
    let totalCost = 0
    let totalValue = 0
    let pricedCount = 0
    for (const c of myCards) {
      totalCost += c.cost_thb ?? 0
      const p = latestPriceByCard.get(c.id)
      if (p) {
        totalValue += p.market_price_thb * (c.quantity ?? 1)
        pricedCount += 1
      }
    }
    const profit = totalValue - totalCost
    const marginPct = totalCost === 0 ? 0 : (profit / totalCost) * 100
    return { totalCost, totalValue, profit, marginPct, pricedCount, total: myCards.length }
  }, [myCards, latestPriceByCard])

  const series = useMemo(() => buildPortfolioSeries(cards, priceHistory), [cards, priceHistory])

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ต้นทุนรวม" value={formatTHB(stats.totalCost)} />
        <StatTile
          label="มูลค่าตลาดรวม"
          value={stats.pricedCount > 0 ? formatTHB(stats.totalValue) : 'ยังไม่มีราคา'}
          hint={stats.pricedCount < stats.total ? `มีราคา ${stats.pricedCount}/${stats.total} ใบ` : undefined}
        />
        <StatTile
          label="กำไร/ขาดทุนรวม"
          value={stats.pricedCount > 0 ? formatSigned(stats.profit, formatTHB) : '-'}
          tone={stats.pricedCount > 0 ? (stats.profit >= 0 ? 'positive' : 'negative') : 'neutral'}
        />
        <StatTile
          label="Margin รวม"
          value={stats.pricedCount > 0 ? formatPct(stats.marginPct) : '-'}
          tone={stats.pricedCount > 0 ? (stats.marginPct >= 0 ? 'positive' : 'negative') : 'neutral'}
        />
      </div>

      <div className="mt-4">
        <PortfolioChart data={series} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TopMovers cards={myCards} latestPriceByCard={latestPriceByCard} />
        <CategoryBreakdown cards={myCards} />
      </div>
    </section>
  )
}

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-red-500 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`num mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}
