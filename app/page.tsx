'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_OPTIONS, Card, CardWithLatestPrice, ITEM_TYPE_OPTIONS, PriceHistory, SEALED_BOX_ITEM_TYPE } from '@/lib/types'
import { calcProfit, formatPct, formatRelative, formatSigned, formatTHB } from '@/lib/format'
import { ExchangeRateSetting, getFixedExchangeRate, getSiteBranding, SiteBranding } from '@/lib/appSettings'
import {
  EXTENSION_INSTALL_HINT,
  cardToUpdateInput,
  isExtensionInstalled,
  requestPriceUpdate,
} from '@/lib/priceUpdateBridge'
import { buildMobileBatchStartUrl, fetchExchangeRate, loadMobileJob, MobileBatchJob, saveMobileJob } from '@/lib/mobilePriceUpdate'
import { useRefetchOnResume } from '@/lib/useRefetchOnResume'
import CardTile from '@/components/CardTile'
import PriceUpdateBar from '@/components/PriceUpdateBar'
import MobilePriceUpdateBar from '@/components/MobilePriceUpdateBar'
import ExchangeRateSettingsModal from '@/components/ExchangeRateSettingsModal'
import TelegramSettingsModal from '@/components/TelegramSettingsModal'
import BrandingSettingsModal from '@/components/BrandingSettingsModal'
import CardFormModal from '@/components/CardFormModal'
import MoveToCollectionModal from '@/components/MoveToCollectionModal'
import SellCardModal from '@/components/SellCardModal'
import SellSequentialSetModal from '@/components/SellSequentialSetModal'
import SequentialSetFormModal from '@/components/SequentialSetFormModal'
import Dashboard from '@/components/Dashboard'
import ThemeToggle from '@/components/ThemeToggle'

const LIST_SCROLL_KEY = 'card-tracker:list-scroll'
const LIST_TAB_KEY = 'card-tracker:list-tab'

function isTab(value: string | null): value is Tab {
  return value === 'mine' || value === 'sold' || value === 'wishlist'
}

type Tab = 'mine' | 'sold' | 'wishlist'
type MyCardRenderItem =
  | { type: 'single'; card: CardWithLatestPrice }
  | { type: 'set'; setId: string; cards: CardWithLatestPrice[] }
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

function groupBySequentialSet(list: CardWithLatestPrice[]): MyCardRenderItem[] {
  const seenSets = new Set<string>()
  const items: MyCardRenderItem[] = []
  for (const c of list) {
    if (c.sequential_set_id) {
      if (seenSets.has(c.sequential_set_id)) continue
      seenSets.add(c.sequential_set_id)
      const groupCards = list.filter((x) => x.sequential_set_id === c.sequential_set_id)
      items.push({ type: 'set', setId: c.sequential_set_id, cards: groupCards })
    } else {
      items.push({ type: 'single', card: c })
    }
  }
  return items
}

function getProfitInfo(c: CardWithLatestPrice) {
  if (!c.latestPrice) return null
  const marketTotal = c.latestPrice.market_price_thb * (c.quantity ?? 1)
  return calcProfit(c.cost_thb, marketTotal)
}

function getSoldProfitInfo(c: CardWithLatestPrice) {
  if (c.sold_price_thb === null) return null
  return calcProfit(c.cost_thb, c.sold_price_thb)
}

function applyFilters(
  list: CardWithLatestPrice[],
  search: string,
  category: string,
  itemType: string,
  grade: string
): CardWithLatestPrice[] {
  return list.filter((c) => {
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (category !== 'all' && c.category !== category) return false
    if (itemType !== 'all' && c.item_type !== itemType) return false
    // Sealed boxes don't really have a grade — whatever value sits in that
    // column for a box is incidental, not meaningful, so the grade filter
    // shouldn't include/exclude boxes based on it.
    if (grade !== 'all' && c.item_type !== SEALED_BOX_ITEM_TYPE && c.grade !== grade) return false
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

// Sold cards don't carry a meaningful latest market price to sort by, so
// mirror applySort's option meanings using the realized sale instead.
function applySoldSort(list: CardWithLatestPrice[], sort: SortOption): CardWithLatestPrice[] {
  const arr = [...list]
  switch (sort) {
    case 'profit_amount_desc':
      arr.sort((a, b) => (getSoldProfitInfo(b)?.profit ?? -Infinity) - (getSoldProfitInfo(a)?.profit ?? -Infinity))
      return arr
    case 'profit_amount_asc':
      arr.sort((a, b) => (getSoldProfitInfo(a)?.profit ?? Infinity) - (getSoldProfitInfo(b)?.profit ?? Infinity))
      return arr
    case 'profit_margin_desc':
      arr.sort(
        (a, b) => (getSoldProfitInfo(b)?.marginPct ?? -Infinity) - (getSoldProfitInfo(a)?.marginPct ?? -Infinity)
      )
      return arr
    case 'profit_margin_asc':
      arr.sort(
        (a, b) => (getSoldProfitInfo(a)?.marginPct ?? Infinity) - (getSoldProfitInfo(b)?.marginPct ?? Infinity)
      )
      return arr
    case 'market_desc':
      arr.sort((a, b) => (b.sold_price_thb ?? -1) - (a.sold_price_thb ?? -1))
      return arr
    case 'name_asc':
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'))
      return arr
    case 'newest':
    default:
      arr.sort((a, b) => new Date(b.sold_at ?? b.created_at).getTime() - new Date(a.sold_at ?? a.created_at).getTime())
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
  const [sellingCard, setSellingCard] = useState<Card | null>(null)
  const [sellingSet, setSellingSet] = useState<CardWithLatestPrice[] | null>(null)
  const [sequentialSetFormOpen, setSequentialSetFormOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('profit_amount_desc')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterItemType, setFilterItemType] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = [filterCategory !== 'all', filterItemType !== 'all', filterGrade !== 'all'].filter(
    Boolean
  ).length

  const [mobileJob, setMobileJob] = useState<MobileBatchJob | null>(null)
  useEffect(() => {
    setMobileJob(loadMobileJob())
  }, [])

  const [rateSettingsOpen, setRateSettingsOpen] = useState(false)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateSetting | null>(null)
  const loadExchangeRateInfo = useCallback(() => {
    getFixedExchangeRate().then(setExchangeRateInfo)
  }, [])
  useEffect(() => {
    loadExchangeRateInfo()
  }, [loadExchangeRateInfo])

  const [telegramSettingsOpen, setTelegramSettingsOpen] = useState(false)

  const [brandingSettingsOpen, setBrandingSettingsOpen] = useState(false)
  const [branding, setBranding] = useState<SiteBranding | null>(null)
  const loadBranding = useCallback(() => {
    getSiteBranding().then(setBranding)
  }, [])
  useEffect(() => {
    loadBranding()
  }, [loadBranding])
  useRefetchOnResume(loadBranding)

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
  useRefetchOnResume(loadData)

  // Remember scroll position across a visit to a card's detail page so
  // coming back doesn't dump you back at the top of the list. Save on the
  // click's capture phase — Next.js resets scroll to 0 as part of the
  // navigation itself, so waiting for unmount (or even the click's bubble
  // phase) can already see scrollY as 0 by the time we read it.
  const scrollRestoredRef = useRef(false)
  useEffect(() => {
    function save() {
      sessionStorage.setItem(LIST_SCROLL_KEY, String(window.scrollY))
    }
    window.addEventListener('click', save, true)
    return () => window.removeEventListener('click', save, true)
  }, [])

  // Remember which tab (mine/sold/wishlist) was active for the same reason —
  // the list page fully remounts on the way back from a card's detail page,
  // which would otherwise reset the tab to the 'mine' default. Restoring it
  // has to happen in an effect (after mount), not in the useState initializer
  // — reading sessionStorage during the initial render would make the
  // server-rendered HTML (always 'mine') mismatch the client's first render,
  // which corrupts hydration (the tab label and the rendered list end up
  // showing different tabs). Saving only happens from selectTab (an explicit
  // user click), not from a generic effect on every `tab` change — an effect
  // would also fire right after this restore runs and, depending on effect
  // ordering, can re-write the pre-restore value and clobber what we just
  // restored.
  useEffect(() => {
    const saved = sessionStorage.getItem(LIST_TAB_KEY)
    if (isTab(saved)) setTab(saved)
  }, [])
  function selectTab(next: Tab) {
    setTab(next)
    sessionStorage.setItem(LIST_TAB_KEY, next)
  }
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return
    scrollRestoredRef.current = true
    const saved = sessionStorage.getItem(LIST_SCROLL_KEY)
    if (saved) window.scrollTo(0, Number(saved))
  }, [loading])

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

  const myCards = useMemo(
    () => withLatest(cards.filter((c) => !c.is_wishlist && !c.is_sold)),
    [cards, latestPriceByCard]
  )
  const soldCards = useMemo(
    () => withLatest(cards.filter((c) => !c.is_wishlist && c.is_sold)),
    [cards, latestPriceByCard]
  )
  const wishlistCards = useMemo(() => withLatest(cards.filter((c) => c.is_wishlist)), [cards, latestPriceByCard])

  const soldStats = useMemo(() => {
    let totalCost = 0
    let totalSold = 0
    for (const c of soldCards) {
      totalCost += c.cost_thb ?? 0
      totalSold += c.sold_price_thb ?? 0
    }
    const profit = totalSold - totalCost
    const marginPct = totalCost === 0 ? 0 : (profit / totalCost) * 100
    return { totalCost, totalSold, profit, marginPct }
  }, [soldCards])

  const gradeOptions = useMemo(() => {
    const set = new Set(cards.filter((c) => c.item_type !== SEALED_BOX_ITEM_TYPE).map((c) => c.grade).filter(Boolean))
    return Array.from(set).sort()
  }, [cards])

  const visibleMyCards = useMemo(
    () => applySort(applyFilters(myCards, search, filterCategory, filterItemType, filterGrade), sortBy),
    [myCards, search, filterCategory, filterItemType, filterGrade, sortBy]
  )
  // Sequential Set cards stay clustered as one block, but the block is
  // positioned wherever its first (best-sorted) member lands, so sort order
  // is still respected instead of sets always floating to the top.
  const myCardRenderItems = useMemo(() => groupBySequentialSet(visibleMyCards), [visibleMyCards])
  const visibleWishlistCards = useMemo(
    () => applySort(applyFilters(wishlistCards, search, filterCategory, filterItemType, filterGrade), sortBy),
    [wishlistCards, search, filterCategory, filterItemType, filterGrade, sortBy]
  )
  const visibleSoldCards = useMemo(
    () => applySoldSort(applyFilters(soldCards, search, filterCategory, filterItemType, filterGrade), sortBy),
    [soldCards, search, filterCategory, filterItemType, filterGrade, sortBy]
  )
  const soldCardRenderItems = useMemo(() => groupBySequentialSet(visibleSoldCards), [visibleSoldCards])

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

  // Reverts one sold card, merging it back into its origin row if it was a
  // partial-sale split. No confirm dialog and no loadData — callers do both,
  // so a whole-set unsell can confirm once and reload once at the end.
  async function unsellCard(card: Card): Promise<string | null> {
    if (card.sold_from_card_id) {
      const { data: origin } = await supabase
        .from('cards')
        .select('*')
        .eq('id', card.sold_from_card_id)
        .maybeSingle()
      if (origin && !origin.is_wishlist && !origin.is_sold) {
        const mergedCosts = [...(origin.costs_thb || []), ...(card.costs_thb || [])]
        const mergedCostTotal = mergedCosts.reduce((s: number, c: number) => s + c, 0)
        const { error: mergeErr } = await supabase
          .from('cards')
          .update({
            quantity: (origin.quantity ?? 1) + (card.quantity ?? 1),
            costs_thb: mergedCosts,
            cost_thb: mergedCostTotal,
          })
          .eq('id', origin.id)
        if (mergeErr) return 'รวมกลับไม่สำเร็จ: ' + mergeErr.message

        const res = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok || !data.success) return 'ลบรายการที่ขายไม่สำเร็จ: ' + (data.error || res.statusText)
        return null
      }
    }

    const { error: updErr } = await supabase
      .from('cards')
      .update({ is_sold: false, sold_price_thb: null, sold_at: null })
      .eq('id', card.id)
    if (updErr) return 'ยกเลิกไม่สำเร็จ: ' + updErr.message
    return null
  }

  async function handleUnsell(card: Card) {
    const ok = window.confirm(`ยกเลิกการขาย "${card.name}" ใช่ไหม? การ์ดจะย้ายกลับไปที่ "การ์ดของฉัน"`)
    if (!ok) return
    const err = await unsellCard(card)
    if (err) {
      alert(err)
      return
    }
    loadData()
  }

  function handleUpdatePrices(cardsToUpdate: Card[]) {
    if (!isExtensionInstalled()) {
      alert(EXTENSION_INSTALL_HINT)
      return
    }
    const inputs = cardsToUpdate.map(cardToUpdateInput).filter((c): c is NonNullable<typeof c> => c !== null)
    if (inputs.length === 0) {
      alert('การ์ดที่เลือกไม่มีลิงก์ SNKRDUNK เลย')
      return
    }
    requestPriceUpdate(inputs)
  }

  function handleUpdatePricesMobile(cardsToUpdate: Card[]) {
    const inputs = cardsToUpdate.map(cardToUpdateInput).filter((c): c is NonNullable<typeof c> => c !== null)
    if (inputs.length === 0) {
      alert('การ์ดที่เลือกไม่มีลิงก์ SNKRDUNK เลย')
      return
    }

    // window.open must happen synchronously inside the click handler (not
    // after an await) or iOS Safari's popup blocker silently kills it — we
    // open a blank tab now and redirect it once the exchange rate is ready.
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

      const batch = buildMobileBatchStartUrl(inputs, rate)
      if (!batch) {
        win.close()
        alert('การ์ดที่เลือกไม่มีลิงก์ SNKRDUNK เลย')
        return
      }

      win.location.href = batch.url
      setMobileJob(batch.job)
      saveMobileJob(batch.job)
    })()
  }

  function handleMobileJobDone() {
    loadData()
    setTimeout(() => {
      setMobileJob(null)
      saveMobileJob(null)
    }, 6000)
  }

  async function handleUnsellSet(cardsToUnsell: Card[]) {
    const ok = window.confirm(
      `ยกเลิกการขายทั้งเซ็ต (${cardsToUnsell.length} ใบ) ใช่ไหม? การ์ดทุกใบจะย้ายกลับไปที่ "การ์ดของฉัน"`
    )
    if (!ok) return
    for (const c of cardsToUnsell) {
      const err = await unsellCard(c)
      if (err) {
        alert(err)
        loadData()
        return
      }
    }
    loadData()
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <header className="relative mb-6 flex items-center justify-between gap-2">
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-56 w-[min(90%,640px)] -translate-x-1/2 rounded-full bg-brand-200/30 blur-3xl dark:bg-brand-500/15"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => !readOnly && setBrandingSettingsOpen(true)}
          disabled={readOnly}
          className="relative flex items-center gap-3 text-left disabled:cursor-default"
        >
          {branding?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.iconUrl}
              alt=""
              className="h-12 w-12 rounded-xl border border-brand-100 object-cover dark:border-brand-500/30 sm:h-14 sm:w-14"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-xl dark:border-brand-500/30 dark:bg-brand-500/15 sm:h-14 sm:w-14 sm:text-2xl">
              🃏
            </span>
          )}
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              {branding?.title || 'Card Price Tracker'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">คลังการ์ดสะสม Pokémon &amp; Sports</p>
          </div>
        </button>
        <div className="relative flex shrink-0 items-start gap-2">
          <div className="flex flex-col items-end gap-1.5">
            {readOnly && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                มุมมองสาธารณะ · ดูอย่างเดียว
              </span>
            )}
            {readOnly ? (
              exchangeRateInfo && (
                <span className="num rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  เรท {exchangeRateInfo.rate} · {formatRelative(exchangeRateInfo.updatedAt)}
                </span>
              )
            ) : (
              <button
                onClick={() => setRateSettingsOpen(true)}
                className="num rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
              >
                {exchangeRateInfo
                  ? `เรท ${exchangeRateInfo.rate} · ${formatRelative(exchangeRateInfo.updatedAt)}`
                  : 'ตั้งเรทค่าเงิน'}
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => setTelegramSettingsOpen(true)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                🔔 แจ้งเตือนราคา
              </button>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        <button
          onClick={() => selectTab('mine')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'mine'
              ? 'bg-white text-brand-700 shadow dark:bg-slate-800 dark:text-brand-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          การ์ดของฉัน ({cards.filter((c) => !c.is_wishlist && !c.is_sold).length})
        </button>
        <button
          onClick={() => selectTab('sold')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'sold'
              ? 'bg-white text-brand-700 shadow dark:bg-slate-800 dark:text-brand-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          ขายแล้ว ({cards.filter((c) => !c.is_wishlist && c.is_sold).length})
        </button>
        <button
          onClick={() => selectTab('wishlist')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'wishlist'
              ? 'bg-white text-brand-700 shadow dark:bg-slate-800 dark:text-brand-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Wishlist ({cards.filter((c) => c.is_wishlist).length})
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          โหลดข้อมูลผิดพลาด: {error}
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อการ์ด..."
              className="input min-w-[140px] flex-1"
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="relative shrink-0 rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          <div className={`flex-wrap gap-2 sm:flex ${filtersOpen ? 'flex' : 'hidden'}`}>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input !w-auto">
              <option value="all">ทุกหมวดหมู่</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={filterItemType} onChange={(e) => setFilterItemType(e.target.value)} className="input !w-auto">
              <option value="all">ทุกประเภท</option>
              {ITEM_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {filterItemType !== SEALED_BOX_ITEM_TYPE && (
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="input !w-auto">
                <option value="all">ทุกเกรด</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="input !w-auto">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <option key={s} value={s}>
                  เรียงตาม: {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400">กำลังโหลด...</div>
      ) : tab === 'mine' ? (
        <>
          <Dashboard cards={cards} priceHistory={priceHistory} latestPriceByCard={latestPriceByCard} />

          <div className="mb-4 mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">การ์ดของฉัน</h2>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openAddForm('mine')}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  + เพิ่มการ์ด
                </button>
                <button
                  onClick={() => setSequentialSetFormOpen(true)}
                  className="rounded-lg bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                >
                  + Sequential Set
                </button>
                <button
                  onClick={() => handleUpdatePrices(myCards)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  อัปเดตราคาทั้งหมด (คอม)
                </button>
                <button
                  onClick={() => handleUpdatePricesMobile(myCards)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  อัปเดตราคาทั้งหมด (มือถือ)
                </button>
              </div>
            )}
          </div>

          {myCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดในคอลเลกชัน" />
          ) : visibleMyCards.length === 0 ? (
            <EmptyState text="ไม่พบการ์ดที่ตรงกับตัวกรอง" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {myCardRenderItems.map((item) =>
                item.type === 'set' ? (
                  <div
                    key={item.setId}
                    className="col-span-2 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/25 dark:bg-brand-500/10 sm:col-span-3 lg:col-span-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Sequential Set · {item.cards.length} ใบ</p>
                      {!readOnly && (
                        <button
                          onClick={() => setSellingSet(item.cards)}
                          className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25"
                        >
                          ขายทั้งเซ็ต
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {item.cards.map((c) => (
                        <CardTile
                          key={c.id}
                          card={c}
                          mode="mine"
                          onEdit={() => openEditForm(c)}
                          onDelete={() => handleDelete(c)}
                          onSell={() => setSellingCard(c)}
                          onUpdatePrice={() => handleUpdatePrices([c])}
                          onUpdatePriceMobile={() => handleUpdatePricesMobile([c])}
                          linkHref={readOnly ? `/card/${c.id}?readonly=1` : `/card/${c.id}`}
                          readOnly={readOnly}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <CardTile
                    key={item.card.id}
                    card={item.card}
                    mode="mine"
                    onEdit={() => openEditForm(item.card)}
                    onDelete={() => handleDelete(item.card)}
                    onSell={() => setSellingCard(item.card)}
                    onUpdatePrice={() => handleUpdatePrices([item.card])}
                    onUpdatePriceMobile={() => handleUpdatePricesMobile([item.card])}
                    linkHref={readOnly ? `/card/${item.card.id}?readonly=1` : `/card/${item.card.id}`}
                    readOnly={readOnly}
                  />
                )
              )}
            </div>
          )}
        </>
      ) : tab === 'sold' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="ต้นทุนรวม (ขายแล้ว)" value={formatTHB(soldStats.totalCost)} />
            <StatTile label="ขายได้รวม" value={formatTHB(soldStats.totalSold)} />
            <StatTile
              label="กำไรที่รับรู้แล้ว"
              value={formatSigned(soldStats.profit, formatTHB)}
              tone={soldStats.profit >= 0 ? 'positive' : 'negative'}
            />
            <StatTile
              label="Margin"
              value={formatPct(soldStats.marginPct)}
              tone={soldStats.marginPct >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <div className="mb-4 mt-6 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">ขายแล้ว</h2>
          </div>

          {soldCards.length === 0 ? (
            <EmptyState text="ยังไม่มีการ์ดที่ขายแล้ว" />
          ) : visibleSoldCards.length === 0 ? (
            <EmptyState text="ไม่พบการ์ดที่ตรงกับตัวกรอง" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {soldCardRenderItems.map((item) =>
                item.type === 'set' ? (
                  <div
                    key={item.setId}
                    className="col-span-2 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/25 dark:bg-brand-500/10 sm:col-span-3 lg:col-span-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Sequential Set · {item.cards.length} ใบ</p>
                      {!readOnly && (
                        <button
                          onClick={() => handleUnsellSet(item.cards)}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          ยกเลิกขายทั้งเซ็ต
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {item.cards.map((c) => (
                        <CardTile
                          key={c.id}
                          card={c}
                          mode="sold"
                          onEdit={() => openEditForm(c)}
                          onDelete={() => handleDelete(c)}
                          onUnsell={() => handleUnsell(c)}
                          linkHref={readOnly ? `/card/${c.id}?readonly=1` : `/card/${c.id}`}
                          readOnly={readOnly}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <CardTile
                    key={item.card.id}
                    card={item.card}
                    mode="sold"
                    onEdit={() => openEditForm(item.card)}
                    onDelete={() => handleDelete(item.card)}
                    onUnsell={() => handleUnsell(item.card)}
                    linkHref={readOnly ? `/card/${item.card.id}?readonly=1` : `/card/${item.card.id}`}
                    readOnly={readOnly}
                  />
                )
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Wishlist</h2>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openAddForm('wishlist')}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  + เพิ่ม Wishlist
                </button>
                <button
                  onClick={() => handleUpdatePrices(wishlistCards)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  อัปเดตราคาทั้งหมด (คอม)
                </button>
                <button
                  onClick={() => handleUpdatePricesMobile(wishlistCards)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  อัปเดตราคาทั้งหมด (มือถือ)
                </button>
              </div>
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
                  onUpdatePrice={() => handleUpdatePrices([c])}
                  onUpdatePriceMobile={() => handleUpdatePricesMobile([c])}
                  linkHref={readOnly ? `/card/${c.id}?readonly=1` : `/card/${c.id}`}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </>
      )}

      <PriceUpdateBar onDone={loadData} />
      <MobilePriceUpdateBar job={mobileJob} onDone={handleMobileJobDone} />

      {!readOnly && rateSettingsOpen && (
        <ExchangeRateSettingsModal onClose={() => setRateSettingsOpen(false)} onSaved={loadExchangeRateInfo} />
      )}
      {!readOnly && telegramSettingsOpen && (
        <TelegramSettingsModal onClose={() => setTelegramSettingsOpen(false)} onSaved={() => {}} />
      )}

      {!readOnly && brandingSettingsOpen && (
        <BrandingSettingsModal onClose={() => setBrandingSettingsOpen(false)} onSaved={loadBranding} />
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

      {!readOnly && sellingCard && (
        <SellCardModal
          card={sellingCard}
          onClose={() => setSellingCard(null)}
          onSold={() => {
            setSellingCard(null)
            loadData()
          }}
        />
      )}

      {!readOnly && sequentialSetFormOpen && (
        <SequentialSetFormModal
          onClose={() => setSequentialSetFormOpen(false)}
          onSaved={() => {
            setSequentialSetFormOpen(false)
            loadData()
          }}
        />
      )}

      {!readOnly && sellingSet && (
        <SellSequentialSetModal
          cards={sellingSet}
          onClose={() => setSellingSet(null)}
          onSold={() => {
            setSellingSet(null)
            loadData()
          }}
        />
      )}
    </main>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 dark:border-slate-700 dark:text-slate-500">
      {text}
    </div>
  )
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-red-500 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(30,20,60,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`num mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl ${toneClass}`}>{value}</p>
    </div>
  )
}
