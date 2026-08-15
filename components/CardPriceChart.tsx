'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PriceHistory } from '@/lib/types'
import { formatDateTime, formatTHB } from '@/lib/format'

interface Props {
  history: PriceHistory[]
}

export default function CardPriceChart({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        ยังไม่มีประวัติราคา
      </div>
    )
  }

  const data = [...history]
    .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())
    .map((p) => ({
      fetched_at: p.fetched_at,
      thb: p.market_price_thb,
      jpy: p.market_price_jpy,
    }))

  return (
    <div className="h-56 w-full rounded-xl border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="fetched_at"
            tickFormatter={(v) => new Date(v).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <YAxis
            tickFormatter={(v) => new Intl.NumberFormat('th-TH', { notation: 'compact' }).format(v)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={44}
          />
          <Tooltip
            labelFormatter={(v) => formatDateTime(v as string)}
            formatter={(value: number) => [formatTHB(value), 'ราคาตลาด']}
          />
          <Line type="monotone" dataKey="thb" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
