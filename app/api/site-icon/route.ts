import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Proxies the user-uploaded icon (set via the "ตั้งชื่อ/ไอคอนเว็บ" modal,
// stored in Supabase Storage) so it can be referenced as a stable favicon
// URL from app/layout.tsx's metadata — a favicon has to be servable from our
// own domain, it can't just point straight at Supabase Storage.
export async function GET() {
  const { data } = await supabaseAdmin.from('app_settings').select('site_icon_url').eq('id', 1).maybeSingle()
  const iconUrl = data?.site_icon_url
  if (!iconUrl) {
    return new NextResponse(null, { status: 404 })
  }

  const upstream = await fetch(iconUrl)
  if (!upstream.ok) {
    return new NextResponse(null, { status: 404 })
  }

  const buffer = await upstream.arrayBuffer()
  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  return new NextResponse(buffer, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300' },
  })
}
