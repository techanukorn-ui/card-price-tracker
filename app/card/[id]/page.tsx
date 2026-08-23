'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, PriceHistory, SEALED_BOX_ITEM_TYPE } from '@/lib/types'
import { calcProfit, formatDateTime, formatPct, formatRelative, formatSigned, formatTHB, formatJPY } from '@/lib/format'
import {
  EXTENSION_INSTALL_HINT,
  cardToUpdateInput,
  isExtensionInstalled,
  requestPriceUpdate,
} from '@/lib/priceUpdateBridge'
import { buildMobileBatchStartUrl, fetchExchangeRate, loadMobileJob, MobileBatchJob, saveMobileJob } from '@/lib/mobilePriceUpdate'
import { useRefetchOnResume } from '@/lib/useRefetchOnResume'
import CardPriceChart from '@/components/CardPriceChart'
import PriceAlertsPanel from '@/components/PriceAlertsPanel'
import CardFormModal from '@/components/CardFormModal'
import PriceUpdateBar from '@/components/PriceUpdateBar'
import MobilePriceUpdateBar from '@/components/MobilePriceUpdateBar'

export default function CardDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-400">กำลังโหลด...</main>}>
      <CardDetailPageInner params={params} />
    </Suspense>
  )
}

function CardDetailPageInner({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const readOnly = searchParams.get('readonly') === '1'
  const [card, setCard] = useState<Card | null>(null)
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [mobileJob, setMobileJob] = useState<MobileBatchJob | null>(null)
  useEffect(() => {
    setMobileJob(loadMobileJob())
  }, [])

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
  useRefetchOnResume(load)

  async function handleDelete() {
    if (!card) return
    const ok = window.confirm(`ลบ "${card.name}" ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้`)
    if (!ok) return
    const res = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || !data.success) {
      alert('ลบไม่สำเร็จ: ' + (data.error || res.statusText))
      return
    }
    router.push('/')
  }

  function handleUpdatePrice() {
    if (!card) return
    if (!isExtensionInstalled()) {
      alert(EXTENSION_INSTALL_HINT)
      return
    }
    const input = cardToUpdateInput(card)
    if (!input) {
      alert('การ์ดใบนี้ไม่มีลิงก์ SNKRDUNK')
      return
    }
    requestPriceUpdate([input])
  }

  function handleUpdatePriceMobile() {
    if (!card) return
    const input = cardToUpdateInput(card)
    if (!input) {
      alert('การ์ดใบนี้ไม่มีลิงก์ SNKRDUNK')
      return
    }

    const win = window.open('about:blank', '_blank')
    if (!win) {
      alert('เบราว์เซอร์บล็อก popup — กรุณาอนุญาต popup สำหรับเว็บนี้แล้วลองใหม่')
      return
    }

    ;(async () => {
      let rate: number
      try {
        rate = await fetchExchangeRate()
      } catch {
        win.close()
        alert('ดึงอัตราแลกเปลี่ยนไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }

      const batch = buildMobileBatchStartUrl([input], rate)
      if (!batch) {
        win.close()
        return
      }

      win.location.href = batch.url
      setMobileJob(batch.job)
      saveMobileJob(batch.job)
    })()
  }

  function handleMobileJobDone() {
    load()
    setTimeout(() => {
      setMobileJob(null)
      saveMobileJob(null)
    }, 6000)
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-400">กำลังโหลด...</main>
  }

  if (notFound || !card) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-slate-500 dark:text-slate-400">ไม่พบการ์ดนี้</p>
        <Link href={readOnly ? '/?readonly=1' : '/'} className="mt-4 inline-block text-brand-600 underline dark:text-brand-400">
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
  const totalCostThb = card.cost_thb ?? null
  const profitInfo = !card.is_wishlist && !card.is_sold ? calcProfit(totalCostThb, marketTotal) : null
  const soldProfitInfo = card.is_sold ? calcProfit(totalCostThb, card.sold_price_thb) : null

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-6">
      <Link href={readOnly ? '/?readonly=1' : '/'} className="mb-4 inline-block text-sm text-brand-600 dark:text-brand-400">
        ← กลับ
      </Link>

      <div className="flex gap-4">
        <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-brand-50 dark:from-slate-800 dark:to-brand-500/10">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300 dark:text-slate-600">🃏</div>
          )}
          <span className="pointer-events-none absolute left-1 top-1 h-3 w-3 border-l border-t border-brand-300/70" />
          <span className="pointer-events-none absolute right-1 top-1 h-3 w-3 border-r border-t border-brand-300/70" />
          <span className="pointer-events-none absolute bottom-1 left-1 h-3 w-3 border-b border-l border-brand-300/70" />
          <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 border-b border-r border-brand-300/70" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {card.item_type !== SEALED_BOX_ITEM_TYPE && (
              <span className="inline-block rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-gold-700 dark:bg-gold-500/15 dark:text-gold-300">
                {card.grade === 'Raw' && card.raw_condition ? `Raw (${card.raw_condition})` : card.grade}
              </span>
            )}
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {card.category}
            </span>
            {card.item_type === SEALED_BOX_ITEM_TYPE && (
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {SEALED_BOX_ITEM_TYPE}
              </span>
            )}
            {qty > 1 && (
              <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                ×{qty} ใบ
              </span>
            )}
          </div>
          <h1 className="font-display mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{card.name}</h1>
          {card.snkrdunk_url && (
            <a
              href={card.snkrdunk_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-brand-600 underline dark:text-brand-400"
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
            hint={
              qty > 1 && card.costs_thb && card.costs_thb.length > 1
                ? card.costs_thb.map((c) => formatTHB(c)).join(' + ')
                : undefined
            }
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
        {card.is_sold && (
          <>
            <InfoTile
              label="ขายได้"
              value={formatTHB(card.sold_price_thb)}
              hint={card.sold_at ? `ขายเมื่อ ${formatRelative(card.sold_at)}` : undefined}
            />
            {soldProfitInfo && (
              <InfoTile
                label="กำไรที่รับรู้แล้ว"
                value={formatSigned(soldProfitInfo.profit, formatTHB)}
                hint={formatPct(soldProfitInfo.marginPct)}
                tone={soldProfitInfo.profit >= 0 ? 'positive' : 'negative'}
              />
            )}
          </>
        )}
      </div>

      <PriceAlertsPanel cardId={card.id} isWishlist={card.is_wishlist} readOnly={readOnly} />

      <h2 className="font-display mb-2 mt-6 text-base font-medium text-slate-800 dark:text-slate-200">ราคาย้อนหลัง</h2>
      <CardPriceChart history={history} />

      {history.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="text-slate-500 dark:text-slate-400">{formatDateTime(h.fetched_at)}</span>
              <span className="num font-semibold text-slate-800 dark:text-slate-200">
                {formatTHB(h.market_price_thb)} <span className="font-normal text-slate-400 dark:text-slate-500">({formatJPY(h.market_price_jpy)})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="mt-6 flex flex-wrap gap-2">
          {!card.is_sold && (
            <button
              onClick={handleUpdatePrice}
              disabled={!card.snkrdunk_url}
              className="flex-1 rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            >
              อัปเดตราคา (คอม)
            </button>
          )}
          {!card.is_sold && (
            <button
              onClick={handleUpdatePriceMobile}
              disabled={!card.snkrdunk_url}
              className="flex-1 rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            >
              อัปเดตราคา (มือถือ)
            </button>
          )}
          <button
            onClick={() => setEditOpen(true)}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            แก้ไข
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
          >
            ลบการ์ด
          </button>
        </div>
      )}

      <PriceUpdateBar onDone={load} />
      <MobilePriceUpdateBar job={mobileJob} onDone={handleMobileJobDone} />

      {!readOnly && editOpen && (
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
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-red-500 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`num font-display mt-1 text-base font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="num mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}
