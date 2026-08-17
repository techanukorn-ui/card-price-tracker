import { supabase } from './supabaseClient'

// A single fixed JPY→THB rate the user sets manually (instead of every price
// pull grabbing a fresh live rate). Rationale: most cards' JPY market price
// doesn't move day to day, but the live rate does — so THB profit/loss
// numbers were jittering from FX noise alone, not real portfolio movement.
// Stored as the one row with id=1 in app_settings (table created manually by
// the user via SQL — see the migration note where this feature was added).

export interface ExchangeRateSetting {
  rate: number
  updatedAt: string
}

export async function getFixedExchangeRate(): Promise<ExchangeRateSetting | null> {
  const { data, error } = await supabase.from('app_settings').select('jpy_thb_rate, updated_at').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return { rate: data.jpy_thb_rate, updatedAt: data.updated_at }
}

export async function setFixedExchangeRate(rate: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, jpy_thb_rate: rate, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}
