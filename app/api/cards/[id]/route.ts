import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// PUT /api/cards/[id] — update a card. Requires the admin session cookie (checked in middleware).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('cards')
    .update(payload)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}

// DELETE /api/cards/[id] — delete a card. Requires the admin session cookie (checked in middleware).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin.from('cards').delete().eq('id', params.id)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
