'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PriceHistory } from '@/lib/types'
import { formatDateTime, formatTHB } from '@/lib/format'
import { useTheme } from '@/lib/useTheme'

interface Props {
  history: PriceHistory[]
}

export default function CardPriceChart({ history }: Props) {
  const { isDark } = useTheme()

  if (history.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        ยังไม่มีประวัติราคา
      </div>
    )
  }

  // Collapse same-day snapshots down to the latest one per day, so the trend
  // stays readable even when prices are pulled multiple times in one day.
  const lastByDay = new Map<string, PriceHistory>()
  for (const p of history) {
    const day = p.fetched_at.slice(0, 10)
    const existing = lastByDay.get(day)
    if (!existing || new Date(p.fetched_at).getTime() > new Date(existing.fetched_at).getTime()) {
      lastByDay.set(day, p)
    }
  }

  const data = [...lastByDay.values()]
    .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())
    .map((p) => ({
      fetched_at: p.fetched_at,
      thb: p.market_price_thb,
      jpy: p.market_price_jpy,
    }))

  const gridStroke = isDark ? '#292433' : '#e2e8f0'
  const tickFill = isDark ? '#94a3b8' : '#64748b'
  const lineStroke = isDark ? '#a78bfa' : '#7c3aed'

  return (
    <div className="h-56 w-full rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="fetched_at"
            tickFormatter={(v) => new Date(v).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
            tick={{ fontSize: 11, fill: tickFill }}
          />
          <YAxis
            tickFormatter={(v) => new Intl.NumberFormat('th-TH', { notation: 'compact' }).format(v)}
            tick={{ fontSize: 11, fill: tickFill }}
            width={44}
          />
          <Tooltip
            labelFormatter={(v) => formatDateTime(v as string)}
            formatter={(value: number) => [formatTHB(value), 'ราคาตลาด']}
            contentStyle={isDark ? { backgroundColor: '#0f0d17', borderColor: '#292433', color: '#f1eef7' } : undefined}
          />
          <Line type="monotone" dataKey="thb" stroke={lineStroke} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
