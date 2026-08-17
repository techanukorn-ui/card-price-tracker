import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/update-price-mobile
// Body: { card_id: string, market_price_jpy: number, exchange_rate: number, market_price_thb?: number }
//
// Deliberately a separate copy of /api/update-price's logic rather than a
// shared helper: this endpoint is called cross-origin (fetch() from a
// userscript running on snkrdunk.com, as part of the iOS mobile batch-update
// flow) so it needs CORS headers. Keeping it a standalone file means the
// existing desktop/extension flow through /api/update-price can never be
// affected by changes made here.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400, headers: CORS_HEADERS })
  }

  const { card_id, market_price_jpy, exchange_rate } = body || {}

  if (!card_id || typeof card_id !== 'string') {
    return NextResponse.json({ success: false, error: 'card_id is required' }, { status: 400, headers: CORS_HEADERS })
  }
  if (typeof market_price_jpy !== 'number' || !isFinite(market_price_jpy)) {
    return NextResponse.json(
      { success: false, error: 'market_price_jpy must be a number' },
      { status: 400, headers: CORS_HEADERS }
    )
  }
  if (typeof exchange_rate !== 'number' || !isFinite(exchange_rate)) {
    return NextResponse.json(
      { success: false, error: 'exchange_rate must be a number' },
      { status: 400, headers: CORS_HEADERS }
    )
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
    return NextResponse.json({ success: false, error: cardErr.message }, { status: 500, headers: CORS_HEADERS })
  }
  if (!card) {
    return NextResponse.json(
      { success: false, error: `card_id ${card_id} not found` },
      { status: 404, headers: CORS_HEADERS }
    )
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ success: true, data }, { headers: CORS_HEADERS })
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      usage: 'POST { card_id, market_price_jpy, exchange_rate, market_price_thb? } — CORS-enabled copy of /api/update-price for the iOS mobile batch-update userscript',
    },
    { headers: CORS_HEADERS }
  )
}
