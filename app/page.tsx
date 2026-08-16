'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_OPTIONS, Card, CardWithLatestPrice, PriceHistory } from '@/lib/types'
import { calcProfit } from '@/lib/format'
import CardTile from '@/components/CardTile'
import CardFormModal from '@/components/CardFormModal'
import MoveToCollectionModal from '@/components/MoveToCollectionModal'
import Dashboard from '@/components/Dashboard'

type Tab = 'mine' | 'wishlist'
type SortOption =
  | 'newest'
  | 'profit_amount_desc'
  | 'profit_amount_asc'
  | 'profit_margin_desc'
  | 'profit_margin_asc'
  | 'market_desc'
  | 'name_asc'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'ล่าสุด',
  profit_amount_desc: 'กำไรมากสุด (จำนวนเงิน)',
  profit_amount_asc: 'ขาดทุนมากสุด (จำนวนเงิน)',
  profit_margin_desc: 'กำไรมากสุด (Margin %)',
  profit_margin_asc: 'ขาดทุนมากสุด (Margin %)',
  market_desc: 'ราคาตลาดสูงสุด',
  name_asc: 'ชื่อ (ก-ฮ)',
}

function getProfitInfo(c: CardWithLatestPrice) {
  if (!c.latestPrice) return null
  const marketTotal = c.latestPrice.market_price_thb * (c.quantity ?? 1)
  return calcProfit(c.cost_thb, marketTotal)
}

function applyFilters(
  list: CardWithLatestPrice[],
  search: string,
  category: string,
  grade: string
): CardWithLatestPrice[] {
  return list.filter((c) => {
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (category !== 'all' && c.category !== category) return false
    if (grade !== 'all' && c.grade !== grade) return false
    return true
  })
}

function applySort(list: CardWithLatestPrice[], sort: SortOption): CardWithLatestPrice[] {
  const arr = [...list]
  switch (sort) {
    case 'profit_amount_desc':
      arr.sort((a, b) => {
        const pa = getProfitInfo(a)?.profit ?? -Infinity
        const pb = getProfitInfo(b)?.profit ?? -Infinity
        return pb - pa
      })
      return arr
    case 'profit_amount_asc':
      arr.sort((a, b) => {
        const pa = getProfitInfo(a)?.profit ?? Infinity
        const pb = getProfitInfo(b)?.profit ?? Infinity
        return pa - pb
      })
      return arr
    case 'profit_margin_desc':
      arr.sort((a, b) => {
        const pa = getProfitInfo(a)?.marginPct ?? -Infinity
        const pb = getProfitInfo(b)?.marginPct ?? -Infinity
        return pb - pa
      })
      return arr
    case 'profit_margin_asc':
      arr.sort((a, b) => {
        const pa = getProfitInfo(a)?.marginPct ?? Infinity
        const pb = getProfitInfo(b)?.marginPct ?? Infinity
        return pa - pb
      })
      return arr
    case 'market_desc':
      arr.sort((a, b) => {
        const va = a.latestPrice ? a.latestPrice.market_price_thb * (a.quantity ?? 1) : -1
        const vb = b.latestPrice ? b.latestPrice.market_price_thb * (b.quantity ?? 1) : -1
        return vb - va
      })
      return arr
    case 'name_asc':
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'))
      return arr
    case 'newest':
    default:
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return arr
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">กำลังโหลด...</div>}>
      <HomePageInner />
    </Suspense>
  )
}

function HomePageInner() {
  const searchParams = useSearchParams()
  const readOnly = searchParams.get('readonly') === '1'

  const [tab, setTab] = useState<Tab>('mine')
  const [cards, setCards] = useState<Card[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [formMode, setFormMode] = useState<'mine' | 'wishlist'>('mine')

  const [movingCard, setMovingCard] = useState<Card | null>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')

  const loadData = useCallback(async () => {
    setError(null)
    const [{ data: cardsData, error: cardsErr }, { data: priceData, error: priceErr }] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('price_history').select('*').order('fetched_at', { ascending: false }),
    ])
    if (cardsErr) setError(cardsErr.message)
    else if (priceErr) setError(priceErr.message)
    setCards(cardsData || [])
    setPriceHistory(priceData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const latestPriceByCard = useMemo(() => {
    const map = new Map<string, PriceHistory>()
    // priceHistory is sorted fetched_at desc, so first occurrence per card is the latest.
    for (const p of priceHistory) {
      if (!map.has(p.card_id)) map.set(p.card_id, p)
    }
    return map
  }, [priceHistory])

  const withLatest = (list: Card[]): CardWithLatestPrice[] =>
    list.map((c) => ({ ...c, latestPrice: latestPriceByCard.get(c.id) || null }))

  const myCards = useMemo(() => withLatest(cards.filter((c) => !c.is_wishlist)), [cards, latestPriceByCard])
  const wishlistCards = useMemo(() => withLatest(cards.filter((c) => c.is_wishlist)), [cards, latestPriceByCard])

  const gradeOptions = useMemo(() => {
    const set = new Set(cards.map((c) => c.grade).filter(Boolean))
    return Array.from(set).sort()
  }, [cards])

  const visibleMyCards = useMemo(
    () => applySort(applyFilters(myCards, search, filterCategory, filterGrade), sortBy),
    [myCards, search, filterCategory, filterGrade, sortBy]
  )
  const visibleWishlistCards = useMemo(
    () => applySort(applyFilters(wishlistCards, search, filterCategory, filterGrade), sortBy),
    [wishlistCards, search, filterCategory, filterGrade, sortBy]
  )

  function openAddForm(mode: 'mine' | 'wishlist') {
    setFormMode(mode)
    setEditingCard(null)
    setFormOpen(true)
  }

  function openEditForm(card: Card) {
    setFormMode(card.is_wishlist ? 'wishlist' : 'mine')
    setEditingCard(card)
    setFormOpen(true)
  }

  async function handleDelete(card: Card) {
    const ok = window.confirm(`ลบ "${card.name}" ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้`)
    if (!ok) return
    const res = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || !data.success) {
      alert('ลบไม่สำเร็จ: ' + (data.error || res.statusText))
      return
    }
    loadData()
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">🃏 Card Price Tracker</h1>
      </header>

      <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setTab('mine')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'mine' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'
          }`}
        >
          การ์ดของฉัน ({cards.filter((c) => !c.is_wishlist).length})
        </button>
        <button
          onClick={() => setTab('wishlist')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'wishlist' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'
          }`}
        >
          Wishlist ({cards.filter((c) => c.is_wishlist).length})
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          โหลดข้อมูลผิดพลาด: {error}
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อการ์ด..."
            className="input min-w-[140px] flex-1"
          />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input !w-auto">
            <option value="all">ทุกหมวดหมู่</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="input !w-auto">
            <option value="all">ทุกเกรด</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="input !w-auto">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
              <option key={s} value={s}>
                เรียงตาม: {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400">กำลังโหลด...</div>
      ) : tab === 'mine' ? (
        <>
          <Dashboard cards={cards} priceHistory={priceHistory} latestPriceByCard={latestPriceByCard} />

          <div className="mb-4 mt-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">การ์ดของฉัน</h2>
            {!readOnly && (
              <button
                onClick={() => openAddForm('mine')}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                + เพิ่มการ์ด
              </button>
            )}
          </div>

          {myCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดในคอลเลกชัน" />
          ) : visibleMyCards.length === 0 ? (
            <EmptyState text="ไม่พบการ์ดที่ตรงกับตัวกรอง" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleMyCards.map((c) => (
                <CardTile
                  key={c.id}
                  card={c}
                  mode="mine"
                  onEdit={() => openEditForm(c)}
                  onDelete={() => handleDelete(c)}
                  linkHref={readOnly ? `/card/${c.id}?readonly=1` : `/card/${c.id}`}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Wishlist</h2>
            {!readOnly && (
              <button
                onClick={() => openAddForm('wishlist')}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                + เพิ่ม Wishlist
              </button>
            )}
          </div>

          {wishlistCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดใน Wishlist" />
          ) : visibleWishlistCards.length === 0 ? (
            <EmptyState text="ไม่พบการ์ดที่ตรงกับตัวกรอง" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleWishlistCards.map((c) => (
                <CardTile
                  key={c.id}
                  card={c}
                  mode="wishlist"
                  onEdit={() => openEditForm(c)}
                  onDelete={() => handleDelete(c)}
                  onMove={() => setMovingCard(c)}
                  linkHref={readOnly ? `/card/${c.id}?readonly=1` : `/card/${c.id}`}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!readOnly && formOpen && (
        <CardFormModal
          mode={formMode}
          card={editingCard}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            loadData()
          }}
        />
      )}

      {!readOnly && movingCard && (
        <MoveToCollectionModal
          card={movingCard}
          onClose={() => setMovingCard(null)}
          onMoved={() => {
            setMovingCard(null)
            loadData()
          }}
        />
      )}
    </main>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400">
      {text}
    </div>
  )
}
