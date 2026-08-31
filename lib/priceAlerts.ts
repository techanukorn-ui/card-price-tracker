import { supabaseAdmin } from './supabaseAdmin'
import { formatJPY } from './format'
import { escapeHtml, sendTelegramMessage, sendTelegramPhoto } from './telegram'

// Server-only: called from /api/update-price and /api/update-price-mobile
// right after a new price_history row is inserted. Checks every active,
// not-yet-triggered price_alerts row for that card and pushes a Telegram
// message for each one the new price crosses. Works the same for cards in
// either tab (การ์ดของฉัน / Wishlist) — alerts are just keyed by card_id.
//
// Never throws: a Telegram/config problem must not fail the price update
// that triggered it.
export async function checkAndNotifyPriceAlerts(cardId: string, marketPriceJpy: number, siteOrigin: string): Promise<void> {
  try {
    const { data: alerts } = await supabaseAdmin
      .from('price_alerts')
      .select('id, target_price_jpy, direction, note')
      .eq('card_id', cardId)
      .eq('is_active', true)
      .is('triggered_at', null)

    if (!alerts || alerts.length === 0) return

    const hits = alerts.filter(
      (a) =>
        (a.direction === 'above' && marketPriceJpy >= a.target_price_jpy) ||
        (a.direction === 'below' && marketPriceJpy <= a.target_price_jpy)
    )
    if (hits.length === 0) return

    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('id, name, grade, is_wishlist, image_url, custom_image_url')
      .eq('id', cardId)
      .maybeSingle()
    if (!card) return
    const photoUrl = card.custom_image_url || card.image_url || null

    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', 1)
      .maybeSingle()

    for (const alert of hits) {
      await supabaseAdmin.from('price_alerts').update({ triggered_at: new Date().toISOString() }).eq('id', alert.id)

      if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) continue

      const directionLabel = alert.direction === 'above' ? 'ราคาขึ้นถึงเป้าแล้ว' : 'ราคาลงถึงเป้าแล้ว'
      const lines = [
        `🔔 <b>${directionLabel}</b>`,
        `${escapeHtml(card.name)} (${escapeHtml(card.grade)}${card.is_wishlist ? ' · Wishlist' : ''})`,
        `ราคาล่าสุด: ${formatJPY(marketPriceJpy)}`,
        `เป้าที่ตั้งไว้: ${formatJPY(alert.target_price_jpy)}`,
      ]
      if (alert.note) lines.push(`หมายเหตุ: ${escapeHtml(alert.note)}`)
      lines.push(`${siteOrigin}/card/${card.id}`)

      const text = lines.join('\n')
      if (photoUrl) {
        await sendTelegramPhoto(settings.telegram_bot_token, settings.telegram_chat_id, photoUrl, text)
      } else {
        await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, text)
      }
    }
  } catch (err) {
    console.error('checkAndNotifyPriceAlerts failed', err)
  }
}
