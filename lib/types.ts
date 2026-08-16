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

export const RAW_CONDITION_OPTIONS = ['A', 'B', 'C', 'D'] as const

export interface Card {
  id: string
  name: string
  grade: string
  raw_condition: string | null
  category: string
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
  created_at: string
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
