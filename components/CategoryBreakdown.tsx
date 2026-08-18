'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/lib/types'
import { formatTHB } from '@/lib/format'
import { useTheme } from '@/lib/useTheme'

interface Props {
  cards: Card[]
}

const COLORS = ['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']

export default function CategoryBreakdown({ cards }: Props) {
  const { isDark } = useTheme()
  const totals = new Map<string, number>()
  for (const c of cards) {
    const key = c.category || 'อื่นๆ'
    totals.set(key, (totals.get(key) || 0) + (c.cost_thb ?? 0))
  }
  const data = Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const grandTotal = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="font-display text-base font-medium text-slate-800 dark:text-slate-200">สัดส่วนต้นทุนตามหมวดหมู่</p>
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูลเพียงพอ</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="font-display text-base font-medium text-slate-800 dark:text-slate-200">สัดส่วนต้นทุนตามหมวดหมู่</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={54} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatTHB(value)}
                contentStyle={
                  isDark
                    ? { backgroundColor: '#0f0d17', borderColor: '#292433', color: '#f1eef7' }
                    : undefined
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div
              key={d.name}
              className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-xs first:border-t-0 first:pt-0 dark:border-slate-800"
            >
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {d.name}
              </span>
              <span className="num font-display font-semibold text-slate-800 dark:text-slate-200">
                {grandTotal === 0 ? 0 : Math.round((d.value / grandTotal) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
