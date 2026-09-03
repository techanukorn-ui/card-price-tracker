export const GRADE_OPTIONS = [
  'Raw',
  'PSA7',
  'PSA8',
  'PSA9',
  'PSA9.5',
  'PSA10',
  'BGS9',
  'BGS9.5',
  'BGS10',
  'Other',
] as const

export const CATEGORY_OPTIONS = ['Pokémon', 'One Piece', 'Sports', 'อื่นๆ'] as const

export const ITEM_TYPE_OPTIONS = ['การ์ด', 'กล่องซีล'] as const

export const SEALED_BOX_ITEM_TYPE = 'กล่องซีล'

export const RAW_CONDITION_OPTIONS = ['A', 'B', 'C', 'D'] as const

export interface Card {
  id: string
  name: string
  grade: string
  raw_condition: string | null
  category: string
  item_type: string
  quantity: number
  cost_thb: number | null
  costs_thb: number[] | null
  snkrdunk_url: string | null
  image_url: string | null
  custom_image_url: string | null
  is_wishlist: boolean
  is_sold: boolean
  sold_price_thb: number | null
  sold_at: string | null
  sold_from_card_id: string | null
  sequential_set_id: string | null
  created_at: string
  lowest_listing_price_jpy: number | null
  lowest_listing_price_fetched_at: string | null
}

export interface PriceHistory {
  id: string
  card_id: string
  market_price_jpy: number
  market_price_thb: number
  exchange_rate: number
  fetched_at: string
}

export interface CardWithLatestPrice extends Card {
  latestPrice: PriceHistory | null
}

export type PriceAlertDirection = 'above' | 'below'

// Which of the card's two live price numbers an alert watches: the sold-price
// average ('sold_avg', the long-standing default — what's shown as "ราคา
// ตลาดล่าสุด") or the current cheapest active listing ('listing', "ตั้งขายต่ำสุด
// ตอนนี้"). Old rows default to 'sold_avg' via the DB column default so
// existing alerts keep behaving exactly as before.
export type PriceAlertPriceType = 'sold_avg' | 'listing'

// Summarized per-card status for the 🔔 badge shown on CardTile in the list
// view: 'waiting' = an active alert hasn't hit its target yet, 'triggered' =
// it has. Computed in app/page.tsx from the raw price_alerts rows.
export type AlertBadgeStatus = 'waiting' | 'triggered'

export interface PriceAlert {
  id: string
  card_id: string
  target_price_jpy: number
  direction: PriceAlertDirection
  price_type: PriceAlertPriceType
  note: string | null
  is_active: boolean
  triggered_at: string | null
  created_at: string
  updated_at: string
}

// Global (not per-card) target on total portfolio market value — "การ์ดของฉัน"
// scope only, same as Dashboard/buildWeeklyDigest('mine'). Checked after
// every price update (lib/portfolioAlerts.ts), same trigger-once-then-arm
// behavior as PriceAlert.
export interface PortfolioAlert {
  id: string
  target_value_thb: number
  direction: PriceAlertDirection
  note: string | null
  is_active: boolean
  triggered_at: string | null
  created_at: string
  updated_at: string
}
