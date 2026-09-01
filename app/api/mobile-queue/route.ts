import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Backing store for the iOS mobile batch-update queue (see
// lib/mobilePriceUpdate.ts and browser-extension/ios-userscript.user.js).
// POST creates a job once, up front, from the app (same-origin). GET is
// called cross-origin by the userscript running on snkrdunk.com to fetch the
// queue back by token — so it needs CORS headers.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  const { token, queue } = body || {}
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400, headers: CORS_HEADERS })
  }
  if (!Array.isArray(queue) || queue.length === 0) {
    return NextResponse.json({ success: false, error: 'queue must be a non-empty array' }, { status: 400, headers: CORS_HEADERS })
  }

  const { error } = await supabaseAdmin.from('mobile_price_jobs').insert({ token, queue })
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400, headers: CORS_HEADERS })
  }

  const { data, error } = await supabaseAdmin
    .from('mobile_price_jobs')
    .select('queue')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS })
  }
  if (!data) {
    return NextResponse.json({ success: false, error: `job ${token} not found` }, { status: 404, headers: CORS_HEADERS })
  }

  return NextResponse.json({ success: true, queue: data.queue }, { headers: CORS_HEADERS })
}
