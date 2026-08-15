'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/lib/types'
import { formatTHB } from '@/lib/format'

interface Props {
  cards: Card[]
}

const COLORS = ['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']

export default function CategoryBreakdown({ cards }: Props) {
  const totals = new Map<string, number>()
  for (const c of cards) {
    const key = c.category || 'อื่นๆ'
    totals.set(key, (totals.get(key) || 0) + (c.cost_thb ?? 0) * (c.quantity ?? 1))
  }
  const data = Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const grandTotal = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">สัดส่วนต้นทุนตามหมวดหมู่</p>
        <p className="mt-3 text-center text-xs text-slate-400">ยังไม่มีข้อมูลเพียงพอ</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">สัดส่วนต้นทุนตามหมวดหมู่</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={28} outerRadius={54} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatTHB(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {d.name}
              </span>
              <span className="font-semibold text-slate-800">
                {grandTotal === 0 ? 0 : Math.round((d.value / grandTotal) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
