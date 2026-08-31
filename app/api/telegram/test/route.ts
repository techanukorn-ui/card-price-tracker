import { NextRequest, NextResponse } from 'next/server'

// POST /api/telegram/test
// Body: { bot_token: string, chat_id: string }
//
// Sends a one-off test message using the token/chat id currently in the
// settings form (not yet saved) so the user can confirm the setup works
// before clicking "บันทึก".
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const botToken = body?.bot_token
  const chatId = body?.chat_id
  if (!botToken || typeof botToken !== 'string' || !chatId || typeof chatId !== 'string') {
    return NextResponse.json({ success: false, error: 'bot_token และ chat_id ต้องกรอกให้ครบ' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ ทดสอบแจ้งเตือนจาก Card Price Tracker สำเร็จ' }),
    })
  } catch {
    return NextResponse.json({ success: false, error: 'ติดต่อ Telegram ไม่สำเร็จ' }, { status: 502 })
  }

  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    return NextResponse.json({ success: false, error: json?.description || 'ส่งข้อความไม่สำเร็จ' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
