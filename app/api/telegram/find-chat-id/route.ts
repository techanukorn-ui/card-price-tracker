import { NextRequest, NextResponse } from 'next/server'

// POST /api/telegram/find-chat-id
// Body: { bot_token: string }
//
// Helper for the settings UI so the user doesn't have to read raw Telegram
// API JSON by hand: calls Telegram's getUpdates with the given bot token and
// returns the chat id(s) found in recent messages sent to the bot. The user
// flow is: create the bot via @BotFather, send it any message (e.g. "hi"),
// then click "ดึง Chat ID อัตโนมัติ" which hits this route.
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const botToken = body?.bot_token
  if (!botToken || typeof botToken !== 'string') {
    return NextResponse.json({ success: false, error: 'bot_token is required' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, { cache: 'no-store' })
  } catch {
    return NextResponse.json({ success: false, error: 'ติดต่อ Telegram ไม่สำเร็จ' }, { status: 502 })
  }

  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    return NextResponse.json(
      { success: false, error: json?.description || 'Bot token ไม่ถูกต้อง หรือ Telegram ตอบกลับผิดพลาด' },
      { status: 400 }
    )
  }

  const chats = new Map<string, { chatId: string; name: string }>()
  for (const update of json.result || []) {
    const chat = update?.message?.chat || update?.my_chat_member?.chat
    if (!chat?.id) continue
    const name = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || chat.username || String(chat.id)
    chats.set(String(chat.id), { chatId: String(chat.id), name })
  }

  if (chats.size === 0) {
    return NextResponse.json({
      success: false,
      error: 'ยังไม่พบข้อความ — เปิดแชทกับบอทใน Telegram แล้วส่งข้อความอะไรก็ได้ (เช่น "hi") ก่อน แล้วลองอีกครั้ง',
    })
  }

  return NextResponse.json({ success: true, chats: Array.from(chats.values()) })
}
