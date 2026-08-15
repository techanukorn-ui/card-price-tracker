import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/update-price
// Body: { card_id: string, market_price_jpy: number, exchange_rate: number, market_price_thb?: number }
//
// Inserts a new snapshot row into price_history. Never updates/overwrites an
// existing row — every call appends a new row so the full price history is
// kept. market_price_thb is computed from jpy * exchange_rate when not
// provided directly.
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const { card_id, market_price_jpy, exchange_rate } = body || {}

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
    .select('id')
    .eq('id', card_id)
    .maybeSingle()

  if (cardErr) {
    return NextResponse.json({ success: false, error: cardErr.message }, { status: 500 })
  }
  if (!card) {
    return NextResponse.json({ success: false, error: `card_id ${card_id} not found` }, { status: 404 })
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

  return NextResponse.json({ success: true, data })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST { card_id, market_price_jpy, exchange_rate, market_price_thb? }',
  })
}
