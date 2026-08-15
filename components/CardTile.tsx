'use client'

import Link from 'next/link'
import { CardWithLatestPrice } from '@/lib/types'
import { calcProfit, formatPct, formatRelative, formatSigned, formatTHB } from '@/lib/format'

interface Props {
  card: CardWithLatestPrice
  mode: 'mine' | 'wishlist'
  onEdit: () => void
  onDelete: () => void
  onMove?: () => void
  linkHref?: string
}

export default function CardTile({ card, mode, onEdit, onDelete, onMove, linkHref }: Props) {
  const image = card.custom_image_url || card.image_url
  const marketThb = card.latestPrice?.market_price_thb ?? null
  const profitInfo = mode === 'mine' ? calcProfit(card.cost_thb, marketThb) : null

  const body = (
    <>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={card.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-300">🃏</div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
          {card.grade}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800">{card.name}</p>

        {mode === 'mine' && (
          <p className="text-xs text-slate-500">ต้นทุน {formatTHB(card.cost_thb)}</p>
        )}

        {card.latestPrice ? (
          <>
            <p className="text-sm font-bold text-slate-900">{formatTHB(marketThb)}</p>
            <p className="text-[11px] text-slate-400">อัปเดตล่าสุดเมื่อ {formatRelative(card.latestPrice.fetched_at)}</p>
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-400">ยังไม่มีราคา</p>
        )}

        {mode === 'mine' && profitInfo && (
          <p className={`text-xs font-semibold ${profitInfo.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatSigned(profitInfo.profit, formatTHB)} ({formatPct(profitInfo.marginPct)})
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      {linkHref ? (
        <Link href={linkHref} className="block">
          {body}
        </Link>
      ) : (
        body
      )}

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onEdit}
          className="flex-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          แก้ไข
        </button>
        {mode === 'wishlist' && onMove && (
          <button
            onClick={onMove}
            className="flex-1 rounded-md bg-brand-100 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-200"
          >
            ย้ายเข้าคอลเลกชัน
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
        >
          ลบ
        </button>
      </div>
    </div>
  )
}
