'use client'

import Link from 'next/link'
import { CardWithLatestPrice, SEALED_BOX_ITEM_TYPE } from '@/lib/types'
import { calcProfit, formatJPY, formatPct, formatRelative, formatSigned, formatTHB } from '@/lib/format'

interface Props {
  card: CardWithLatestPrice
  mode: 'mine' | 'wishlist' | 'sold'
  onEdit: () => void
  onDelete: () => void
  onMove?: () => void
  onSell?: () => void
  onUnsell?: () => void
  onUpdatePrice?: () => void
  onUpdatePriceMobile?: () => void
  linkHref?: string
  readOnly?: boolean
}

export default function CardTile({
  card,
  mode,
  onEdit,
  onDelete,
  onMove,
  onSell,
  onUnsell,
  onUpdatePrice,
  onUpdatePriceMobile,
  linkHref,
  readOnly,
}: Props) {
  const image = card.custom_image_url || card.image_url
  const qty = card.quantity ?? 1
  const unitMarketThb = card.latestPrice?.market_price_thb ?? null
  const unitMarketJpy = card.latestPrice?.market_price_jpy ?? null
  const marketThb = unitMarketThb !== null ? unitMarketThb * qty : null
  const marketJpy = unitMarketJpy !== null ? unitMarketJpy * qty : null
  const totalCostThb = card.cost_thb ?? null
  const profitInfo = mode === 'mine' ? calcProfit(totalCostThb, marketThb) : null
  const soldProfitInfo = mode === 'sold' ? calcProfit(totalCostThb, card.sold_price_thb) : null

  const body = (
    <>
      {card.item_type !== SEALED_BOX_ITEM_TYPE && (
        <p className="mb-1.5 text-center text-sm font-bold tracking-wide text-gold-600 dark:text-gold-300">
          {card.grade === 'Raw' && card.raw_condition ? `Raw (${card.raw_condition})` : card.grade}
        </p>
      )}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-brand-50 dark:from-slate-800 dark:to-brand-500/10">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={card.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-300 dark:text-slate-600">🃏</div>
        )}
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 border-l border-t border-brand-300/70 dark:border-brand-400/50" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 border-r border-t border-brand-300/70 dark:border-brand-400/50" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-3 w-3 border-b border-l border-brand-300/70 dark:border-brand-400/50" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3 w-3 border-b border-r border-brand-300/70 dark:border-brand-400/50" />
        {qty > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            ×{qty}
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-300">
          {card.category}
          {card.item_type === SEALED_BOX_ITEM_TYPE ? ` · ${SEALED_BOX_ITEM_TYPE}` : ''}
        </p>
        <p className="font-display line-clamp-2 text-[15px] font-medium leading-snug text-slate-900 dark:text-slate-100">{card.name}</p>

        {(mode === 'mine' || mode === 'sold') && (
          <>
            <p className="num text-xs text-slate-500 dark:text-slate-400">ต้นทุน {formatTHB(totalCostThb)}</p>
            {qty > 1 && card.costs_thb && card.costs_thb.length > 1 && (
              <p className="num text-[11px] text-slate-400 dark:text-slate-500">
                {card.costs_thb.map((c) => formatTHB(c)).join(' + ')}
              </p>
            )}
          </>
        )}

        {mode === 'sold' ? (
          <>
            <p className="font-display num text-base font-semibold text-slate-900 dark:text-slate-100">
              ขายได้ {formatTHB(card.sold_price_thb)}
            </p>
            {card.sold_at && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">ขายเมื่อ {formatRelative(card.sold_at)}</p>
            )}
          </>
        ) : card.latestPrice ? (
          <>
            <p className="font-display num text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatTHB(marketThb)}{' '}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({formatJPY(marketJpy)})</span>
            </p>
            {qty > 1 && (
              <p className="num text-[11px] text-slate-500 dark:text-slate-400">
                {formatTHB(unitMarketThb)} ({formatJPY(unitMarketJpy)}) ต่อใบ × {qty}
              </p>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              อัปเดตล่าสุดเมื่อ {formatRelative(card.latestPrice.fetched_at)}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">ยังไม่มีราคา</p>
        )}

        {mode === 'mine' && profitInfo && (
          <p
            className={`num inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              profitInfo.profit >= 0
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400'
            }`}
          >
            {formatSigned(profitInfo.profit, formatTHB)} ({formatPct(profitInfo.marginPct)})
          </p>
        )}

        {mode === 'sold' && soldProfitInfo && (
          <p
            className={`num inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              soldProfitInfo.profit >= 0
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400'
            }`}
          >
            กำไร {formatSigned(soldProfitInfo.profit, formatTHB)} ({formatPct(soldProfitInfo.marginPct)})
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-[0_16px_40px_-30px_rgba(30,20,60,0.4)] transition hover:shadow-[0_20px_44px_-26px_rgba(30,20,60,0.45)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      {linkHref ? (
        <Link href={linkHref} className="block">
          {body}
        </Link>
      ) : (
        body
      )}

      {!readOnly && mode !== 'sold' && (onUpdatePrice || onUpdatePriceMobile) && (
        <div className="mt-2 flex gap-1.5">
          {onUpdatePrice && (
            <button
              onClick={onUpdatePrice}
              disabled={!card.snkrdunk_url}
              title={card.snkrdunk_url ? undefined : 'การ์ดใบนี้ไม่มีลิงก์ SNKRDUNK'}
              className="flex-1 rounded-md bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            >
              อัปเดตราคา (คอม)
            </button>
          )}
          {onUpdatePriceMobile && (
            <button
              onClick={onUpdatePriceMobile}
              disabled={!card.snkrdunk_url}
              title={card.snkrdunk_url ? undefined : 'การ์ดใบนี้ไม่มีลิงก์ SNKRDUNK'}
              className="flex-1 rounded-md bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            >
              อัปเดตราคา (มือถือ)
            </button>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={onEdit}
            className="flex-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            แก้ไข
          </button>
          {mode === 'wishlist' && onMove && (
            <button
              onClick={onMove}
              className="flex-1 rounded-md bg-brand-100 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
            >
              ย้ายเข้าคอลเลกชัน
            </button>
          )}
          {mode === 'mine' && onSell && (
            <button
              onClick={onSell}
              className="flex-1 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25"
            >
              ขายแล้ว
            </button>
          )}
          {mode === 'sold' && onUnsell && (
            <button
              onClick={onUnsell}
              className="flex-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ยกเลิกการขาย
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
          >
            ลบ
          </button>
        </div>
      )}
    </div>
  )
}
