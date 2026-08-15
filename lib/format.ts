export function formatTHB(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('th-TH', {
          style: 'currency',
          currency: 'THB',
          maximumFractionDigits: 0,
    }).format(value)
}

export function formatJPY(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency: 'JPY',
          maximumFractionDigits: 0,
    }).format(value)
}

export function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('th-TH').format(value)
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
    })
}

export function formatRelative(iso: string | null | undefined): string {
    if (!iso) return '-'
    const then = new Date(iso).getTime()
    const now = Date.now()
    const diffMs = now - then
    const diffMin = Math.round(diffMs / 60000)
    if (diffMin < 1) return 'เมื่อสักครู่'
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `${diffHr} ชม. ที่แล้ว`
    const diffDay = Math.round(diffHr / 24)
    if (diffDay < 30) return `${diffDay} วันที่แล้ว`
    return formatDateTime(iso)
}

export interface ProfitInfo {
    profit: number
    marginPct: number
}

export function calcProfit(costThb: number | null, marketThb: number | null): ProfitInfo | null {
    if (costThb === null || costThb === undefined) return null
    if (marketThb === null || marketThb === undefined) return null
    const profit = marketThb - costThb
    const marginPct = costThb === 0 ? 0 : (profit / costThb) * 100
    return { profit, marginPct }
}

export function formatSigned(value: number, formatter: (v: number) => string): string {
    const sign = value > 0 ? '+' : ''
    return `${sign}${formatter(value)}`
}

export function formatPct(value: number): string {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
}
