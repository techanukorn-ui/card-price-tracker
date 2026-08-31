import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkAndNotifyPriceAlerts } from '@/lib/priceAlerts'
import { checkAndNotifyPortfolioAlerts } from '@/lib/portfolioAlerts'

// POST /api/update-price
// Body: { card_id: string, market_price_jpy: number, exchange_rate: number, market_price_thb?: number, image_url?: string, lowest_listing_price_jpy?: number }
//
// Inserts a new snapshot row into price_history. Never updates/overwrites an
// existing row — every call appends a new row so the full price history is
// kept. market_price_thb is computed from jpy * exchange_rate when not
// provided directly. If image_url is passed and the card still has no
// image_url/custom_image_url, it's written to cards.image_url (auto-fill
// rule — see CLAUDE.md "กฎการเติมรูปภาพ"). If lowest_listing_price_jpy is
// passed, it overwrites cards.lowest_listing_price_jpy directly — it's a
// live "current cheapest listing" snapshot, not part of the price_history log.
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const { card_id, market_price_jpy, exchange_rate, image_url, lowest_listing_price_jpy } = body || {}

  if (!card_id || typeof card_id !== 'string') {
    return NextResponse.json({ success: false, error: 'card_id is required' }, { status: 400 })
  }
  if (typeof market_price_jpy !== 'number' || !isFinite(market_price_jpy)) {
    return NextResponse.json({ success: false, error: 'market_price_jpy must be a number' }, { status: 400 })
  }
  if (typeof exchange_rate !== 'number' || !isFinite(exchange_rate)) {
    return NextResponse.json({ success: false, error: 'exchange_rate must be a number' }, { status: 400 })
  }

  const market_price_thb =
    typeof body.market_price_thb === 'number' && isFinite(body.market_price_thb)
      ? body.market_price_thb
      : market_price_jpy * exchange_rate

  const { data: card, error: cardErr } = await supabaseAdmin
    .from('cards')
    .select('id, image_url, custom_image_url')
    .eq('id', card_id)
    .maybeSingle()

  if (cardErr) {
    return NextResponse.json({ success: false, error: cardErr.message }, { status: 500 })
  }
  if (!card) {
    return NextResponse.json({ success: false, error: `card_id ${card_id} not found` }, { status: 404 })
  }

  if (typeof image_url === 'string' && image_url && !card.image_url && !card.custom_image_url) {
    await supabaseAdmin.from('cards').update({ image_url }).eq('id', card_id)
  }

  if (typeof lowest_listing_price_jpy === 'number' && isFinite(lowest_listing_price_jpy)) {
    await supabaseAdmin
      .from('cards')
      .update({ lowest_listing_price_jpy, lowest_listing_price_fetched_at: new Date().toISOString() })
      .eq('id', card_id)
  }

  const { data, error } = await supabaseAdmin
    .from('price_history')
    .insert({
      card_id,
      market_price_jpy,
      market_price_thb,
      exchange_rate,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  await checkAndNotifyPriceAlerts(card_id, market_price_jpy, req.nextUrl.origin)
  await checkAndNotifyPortfolioAlerts(req.nextUrl.origin)

  return NextResponse.json({ success: true, data })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST { card_id, market_price_jpy, exchange_rate, market_price_thb? }',
  })
}
