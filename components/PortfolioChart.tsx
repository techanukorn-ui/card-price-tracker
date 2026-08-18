'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PortfolioPoint } from '@/lib/portfolio'
import { formatDateTime, formatTHB } from '@/lib/format'
import { useTheme } from '@/lib/useTheme'

interface Props {
  data: PortfolioPoint[]
}

export default function PortfolioChart({ data }: Props) {
  const { isDark } = useTheme()

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        ยังไม่มีข้อมูลราคาพอสำหรับกราฟ
      </div>
    )
  }

  const gridStroke = isDark ? '#292433' : '#e2e8f0'
  const tickFill = isDark ? '#94a3b8' : '#64748b'
  const costStroke = isDark ? '#64748b' : '#94a3b8'
  const valueStroke = isDark ? '#a78bfa' : '#7c3aed'

  return (
    <div className="h-64 w-full rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="date"
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
            formatter={(value: number) => formatTHB(value)}
            contentStyle={isDark ? { backgroundColor: '#0f0d17', borderColor: '#292433', color: '#f1eef7' } : undefined}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: tickFill }} />
          <Line type="monotone" dataKey="totalCost" name="ต้นทุนรวม" stroke={costStroke} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="totalValue" name="มูลค่าตลาดรวม" stroke={valueStroke} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
