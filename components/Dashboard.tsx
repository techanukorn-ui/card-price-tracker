'use client'

import { useMemo } from 'react'
import { Card, PriceHistory } from '@/lib/types'
import { formatPct, formatSigned, formatTHB } from '@/lib/format'
import { buildPortfolioSeries } from '@/lib/portfolio'
import PortfolioChart from './PortfolioChart'

interface Props {
  cards: Card[]
  priceHistory: PriceHistory[]
  latestPriceByCard: Map<string, PriceHistory>
}

export default function Dashboard({ cards, priceHistory, latestPriceByCard }: Props) {
  const myCards = useMemo(() => cards.filter((c) => !c.is_wishlist), [cards])

  const stats = useMemo(() => {
    let totalCost = 0
    let totalValue = 0
    let pricedCount = 0
    for (const c of myCards) {
      totalCost += c.cost_thb ?? 0
      const p = latestPriceByCard.get(c.id)
      if (p) {
        totalValue += p.market_price_thb
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
    tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-500' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-bold sm:text-lg ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}
