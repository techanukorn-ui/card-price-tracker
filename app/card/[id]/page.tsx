'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, PriceHistory } from '@/lib/types'
import { calcProfit, formatDateTime, formatPct, formatRelative, formatSigned, formatTHB, formatJPY } from '@/lib/format'
import CardPriceChart from '@/components/CardPriceChart'
import CardFormModal from '@/components/CardFormModal'

export default function CardDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [card, setCard] = useState<Card | null>(null)
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    const { data: cardData } = await supabase.from('cards').select('*').eq('id', params.id).maybeSingle()
    if (!cardData) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setCard(cardData)
    const { data: historyData } = await supabase
      .from('price_history')
      .select('*')
      .eq('card_id', params.id)
      .order('fetched_at', { ascending: false })
    setHistory(historyData || [])
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!card) return
    const ok = window.confirm(`ลบ "${card.name}" ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้`)
    if (!ok) return
    const { error } = await supabase.from('cards').delete().eq('id', card.id)
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message)
      return
    }
    router.push('/')
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-400">กำลังโหลด...</main>
  }

  if (notFound || !card) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-slate-500">ไม่พบการ์ดนี้</p>
        <Link href="/" className="mt-4 inline-block text-brand-600 underline">
          กลับหน้าแรก
        </Link>
      </main>
    )
  }

  const image = card.custom_image_url || card.image_url
  const latest = history[0] || null
  const qty = card.quantity ?? 1
  const marketTotal = latest ? latest.market_price_thb * qty : null
  const marketTotalJpy = latest ? latest.market_price_jpy * qty : null
  const totalCostThb = card.cost_thb !== null && card.cost_thb !== undefined ? card.cost_thb * qty : null
  const profitInfo = !card.is_wishlist ? calcProfit(totalCostThb, marketTotal) : null

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-6">
      <Link href="/" className="mb-4 inline-block text-sm text-brand-600">
        ← กลับ
      </Link>

      <div className="flex gap-4">
        <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">🃏</div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              {card.grade}
            </span>
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {card.category}
            </span>
            {qty > 1 && (
              <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                ×{qty} ใบ
              </span>
            )}
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900">{card.name}</h1>
          {card.snkrdunk_url && (
            <a
              href={card.snkrdunk_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-brand-600 underline"
            >
              เปิดใน SNKRDUNK
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {!card.is_wishlist && (
          <InfoTile
            label="ราคาซื้อ"
            value={formatTHB(totalCostThb)}
            hint={qty > 1 ? `${formatTHB(card.cost_thb)} ต่อใบ × ${qty}` : undefined}
          />
        )}
        <InfoTile
          label="ราคาตลาดล่าสุด"
          value={latest ? `${formatTHB(marketTotal)} (${formatJPY(marketTotalJpy)})` : 'ยังไม่มีราคา'}
          hint={
            latest
              ? [
                  qty > 1
                    ? `${formatTHB(latest.market_price_thb)} (${formatJPY(latest.market_price_jpy)}) ต่อใบ × ${qty}`
                    : null,
                  `อัปเดต ${formatRelative(latest.fetched_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
        />
        {!card.is_wishlist && profitInfo && (
          <>
            <InfoTile
              label="กำไร/ขาดทุน"
              value={formatSigned(profitInfo.profit, formatTHB)}
              tone={profitInfo.profit >= 0 ? 'positive' : 'negative'}
            />
            <InfoTile
              label="Margin"
              value={formatPct(profitInfo.marginPct)}
              tone={profitInfo.marginPct >= 0 ? 'positive' : 'negative'}
            />
          </>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700">ราคาย้อนหลัง</h2>
      <CardPriceChart history={history} />

      {history.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
            >
              <span className="text-slate-500">{formatDateTime(h.fetched_at)}</span>
              <span className="font-semibold text-slate-800">
                {formatTHB(h.market_price_thb)} <span className="font-normal text-slate-400">({formatJPY(h.market_price_jpy)})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          แก้ไข
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          ลบการ์ด
        </button>
      </div>

      {editOpen && (
        <CardFormModal
          mode={card.is_wishlist ? 'wishlist' : 'mine'}
          card={card}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            load()
          }}
        />
      )}
    </main>
  )
}

function InfoTile({
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
      <p className={`mt-1 text-base font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}
