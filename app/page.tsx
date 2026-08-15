'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardWithLatestPrice, PriceHistory } from '@/lib/types'
import CardTile from '@/components/CardTile'
import CardFormModal from '@/components/CardFormModal'
import MoveToCollectionModal from '@/components/MoveToCollectionModal'
import Dashboard from '@/components/Dashboard'

type Tab = 'mine' | 'wishlist'

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('mine')
  const [cards, setCards] = useState<Card[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [formMode, setFormMode] = useState<'mine' | 'wishlist'>('mine')

  const [movingCard, setMovingCard] = useState<Card | null>(null)

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
    const { error: delErr } = await supabase.from('cards').delete().eq('id', card.id)
    if (delErr) {
      alert('ลบไม่สำเร็จ: ' + delErr.message)
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

      {loading ? (
        <div className="py-20 text-center text-slate-400">กำลังโหลด...</div>
      ) : tab === 'mine' ? (
        <>
          <Dashboard cards={cards} priceHistory={priceHistory} latestPriceByCard={latestPriceByCard} />

          <div className="mb-4 mt-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">การ์ดของฉัน</h2>
            <button
              onClick={() => openAddForm('mine')}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + เพิ่มการ์ด
            </button>
          </div>

          {myCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดในคอลเลกชัน" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {myCards.map((c) => (
                <CardTile
                  key={c.id}
                  card={c}
                  mode="mine"
                  onEdit={() => openEditForm(c)}
                  onDelete={() => handleDelete(c)}
                  linkHref={`/card/${c.id}`}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Wishlist</h2>
            <button
              onClick={() => openAddForm('wishlist')}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + เพิ่ม Wishlist
            </button>
          </div>

          {wishlistCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดใน Wishlist" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {wishlistCards.map((c) => (
                <CardTile
                  key={c.id}
                  card={c}
                  mode="wishlist"
                  onEdit={() => openEditForm(c)}
                  onDelete={() => handleDelete(c)}
                  onMove={() => setMovingCard(c)}
                  linkHref={`/card/${c.id}`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {formOpen && (
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

      {movingCard && (
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
