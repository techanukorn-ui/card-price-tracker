// Shared low-level Telegram senders, used by lib/priceAlerts.ts (per-card
// target notifications) and app/api/cron/weekly-digest (weekly portfolio
// summary). Server-only — never throws; callers decide what "delivery
// failed" should mean for their flow.

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Telegram sendMessage failed', res.status, body)
  }
}

// Telegram fetches the photo from this URL itself, so it only works with a
// publicly reachable image (SNKRDUNK's CDN image_url, or a Supabase Storage
// custom_image_url — both public). Caption has the same 1024-char cap
// Telegram applies to captions. Falls back to a plain text message if the
// photo send fails for any reason (e.g. Telegram couldn't fetch that URL) so
// the notification still gets through.
export async function sendTelegramPhoto(botToken: string, chatId: string, photoUrl: string, caption: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Telegram sendPhoto failed, falling back to text', res.status, body)
    await sendTelegramMessage(botToken, chatId, caption)
  }
}
