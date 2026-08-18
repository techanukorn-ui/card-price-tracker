'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PortfolioPoint } from '@/lib/portfolio'
import { formatDateTime, formatTHB } from '@/lib/format'

interface Props {
  data: PortfolioPoint[]
}

export default function PortfolioChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
        ยังไม่มีข้อมูลราคาพอสำหรับกราฟ
      </div>
    )
  }

  return (
    <div className="h-64 w-full rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => new Date(v).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <YAxis
            tickFormatter={(v) => new Intl.NumberFormat('th-TH', { notation: 'compact' }).format(v)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={44}
          />
          <Tooltip labelFormatter={(v) => formatDateTime(v as string)} formatter={(value: number) => formatTHB(value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="totalCost" name="ต้นทุนรวม" stroke="#94a3b8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="totalValue" name="มูลค่าตลาดรวม" stroke="#7c3aed" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
