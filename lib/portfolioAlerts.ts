import { supabaseAdmin } from './supabaseAdmin'
import { fetchAllRows } from './fetchAll'
import { buildWeeklyDigest } from './weeklyDigest'
import { formatTHB } from './format'
import { PriceHistory } from './types'
import { escapeHtml, sendTelegramMessage } from './telegram'

// Server-only: called after every price_history insert (same trigger point
// as checkAndNotifyPriceAlerts) to check the global portfolio_alerts
// against the current total market value of "การ์ดของฉัน" (mine scope,
// same number Dashboard shows). Never throws — a Telegram/config problem
// must not fail the price update that triggered it.
export async function checkAndNotifyPortfolioAlerts(siteOrigin: string): Promise<void> {
  try {
    const { data: alerts } = await supabaseAdmin
      .from('portfolio_alerts')
      .select('id, target_value_thb, direction, note')
      .eq('is_active', true)
      .is('triggered_at', null)

    if (!alerts || alerts.length === 0) return

    const [{ data: cards }, priceHistory] = await Promise.all([
      supabaseAdmin.from('cards').select('*'),
      fetchAllRows<PriceHistory>(supabaseAdmin, 'price_history', '*'),
    ])
    const totalValue = buildWeeklyDigest(cards || [], priceHistory, 'mine').totalValue

    const hits = alerts.filter(
      (a) =>
        (a.direction === 'above' && totalValue >= a.target_value_thb) ||
        (a.direction === 'below' && totalValue <= a.target_value_thb)
    )
    if (hits.length === 0) return

    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', 1)
      .maybeSingle()

    for (const alert of hits) {
      await supabaseAdmin.from('portfolio_alerts').update({ triggered_at: new Date().toISOString() }).eq('id', alert.id)

      if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) continue

      const directionLabel = alert.direction === 'above' ? 'มูลค่าพอร์ตขึ้นถึงเป้าแล้ว' : 'มูลค่าพอร์ตลงถึงเป้าแล้ว'
      const lines = [
        `🎯 <b>${directionLabel}</b>`,
        `มูลค่าตลาดรวม (การ์ดของฉัน): ${formatTHB(totalValue)}`,
        `เป้าที่ตั้งไว้: ${formatTHB(alert.target_value_thb)}`,
      ]
      if (alert.note) lines.push(`หมายเหตุ: ${escapeHtml(alert.note)}`)
      lines.push(siteOrigin)

      await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, lines.join('\n'))
    }
  } catch (err) {
    console.error('checkAndNotifyPortfolioAlerts failed', err)
  }
}
