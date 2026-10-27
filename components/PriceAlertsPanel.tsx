'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PriceAlert, PriceAlertDirection, PriceAlertPriceType } from '@/lib/types'
import { formatJPY, formatRelative } from '@/lib/format'

interface Props {
  cardId: string
  isWishlist: boolean
  readOnly?: boolean
}

// Per-card price target notifications (pushed via Telegram from
// lib/priceAlerts.ts whenever a new price is fetched — see
// app/api/update-price and app/api/update-price-mobile). Editing an alert's
// target/direction, or re-activating one, resets triggered_at so it can fire
// again; this mirrors the schema comment in supabase/schema.sql.
export default function PriceAlertsPanel({ cardId, isWishlist, readOnly }: Props) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PriceAlert | null>(null)

  async function load() {
    const { data } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true })
    setAlerts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  async function handleDelete(id: string) {
    const ok = window.confirm('ลบการแจ้งเตือนนี้ใช่ไหม?')
    if (!ok) return
    await supabase.from('price_alerts').delete().eq('id', id)
    load()
  }

  async function handleToggleActive(alert: PriceAlert) {
    await supabase
      .from('price_alerts')
      .update({
        is_active: !alert.is_active,
        triggered_at: !alert.is_active ? null : alert.triggered_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alert.id)
    load()
  }

  if (loading) return null

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-medium text-slate-800 dark:text-slate-200">🔔 แจ้งเตือนราคา</h2>
        {!readOnly && (
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400"
          >
            + ตั้งเป้าหมาย
          </button>
        )}
      </div>

      {alerts.length === 0 && !formOpen && <p className="text-xs text-slate-400">ยังไม่มีการตั้งเป้าราคาสำหรับการ์ดใบนี้</p>}

      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <span className="num font-semibold text-slate-800 dark:text-slate-200">
                  {a.direction === 'above' ? '⬆️ ขึ้นถึง' : '⬇️ ลงถึง'} {formatJPY(a.target_price_jpy)}
                </span>
                <span className="ml-1.5 text-slate-400">
                  ({a.price_type === 'listing' ? 'ราคาตั้งขายต่ำสุด' : 'ราคาเฉลี่ยขายจริง'})
                </span>
                {a.note && <p className="mt-0.5 text-slate-400">{a.note}</p>}
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {!a.is_active
                    ? 'ปิดอยู่'
                    : a.triggered_at
                      ? `แจ้งไปแล้วเมื่อ ${formatRelative(a.triggered_at)}`
                      : 'กำลังรอ'}
                </p>
              </div>
              {!readOnly && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleToggleActive(a)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={a.is_active ? 'ปิดการแจ้งเตือนนี้' : 'เปิดการแจ้งเตือนนี้อีกครั้ง'}
                  >
                    {a.is_active ? '⏸' : '▶️'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(a)
                      setFormOpen(true)
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    แก้ไข
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600">
                    ลบ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <AlertForm
          cardId={cardId}
          isWishlist={isWishlist}
          alert={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function AlertForm({
  cardId,
  isWishlist,
  alert,
  onClose,
  onSaved,
}: {
  cardId: string
  isWishlist: boolean
  alert: PriceAlert | null
  onClose: () => void
  onSaved: () => void
}) {
  const [target, setTarget] = useState(alert ? String(alert.target_price_jpy) : '')
  const [direction, setDirection] = useState<PriceAlertDirection>(alert?.direction || (isWishlist ? 'below' : 'above'))
  const [priceType, setPriceType] = useState<PriceAlertPriceType>(alert?.price_type || 'sold_avg')
  const [note, setNote] = useState(alert?.note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const targetPrice = Number(target)
    if (!target.trim() || !isFinite(targetPrice) || targetPrice <= 0) {
      setError('กรอกราคาเป้าหมาย (เยน) เป็นตัวเลขที่มากกว่า 0')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      card_id: cardId,
      target_price_jpy: targetPrice,
      direction,
      price_type: priceType,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
      // editing the target/direction re-arms the alert
      triggered_at: null,
      is_active: true,
    }
    const { error: err } = alert
      ? await supabase.from('price_alerts').update(payload).eq('id', alert.id)
      : await supabase.from('price_alerts').insert(payload)
    setSaving(false)
    if (err) {
      setError('บันทึกไม่สำเร็จ: ' + err.message)
      return
    }
    onSaved()
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDirection('above')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
            direction === 'above'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          ⬆️ แจ้งเมื่อราคาขึ้นถึง
        </button>
        <button
          type="button"
          onClick={() => setDirection('below')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
            direction === 'below'
              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
              : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          ⬇️ แจ้งเมื่อราคาลงถึง
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setPriceType('sold_avg')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
            priceType === 'sold_avg'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
              : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          ราคาเฉลี่ยขายจริง
        </button>
        <button
          type="button"
          onClick={() => setPriceType('listing')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
            priceType === 'listing'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
              : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          ราคาตั้งขายต่ำสุดในตลาด
        </button>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        {priceType === 'listing'
          ? 'แจ้งเตือนตามราคาตั้งขายที่ถูกที่สุดที่มีอยู่จริงในตลาดตอนนี้ (出品中最安値)'
          : 'แจ้งเตือนตามราคาเฉลี่ยจากรายการขายจริงย้อนหลัง (ค่าเดียวกับ "ราคาตลาดล่าสุด" ที่โชว์บนหน้าเว็บ)'}
      </p>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">ราคาเป้าหมาย (เยน)</span>
        <input
          type="number"
          inputMode="numeric"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="เช่น 20000"
          className="input"
        />
      </label>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">หมายเหตุ (ไม่บังคับ)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น เท่าทุน, เป้ากำไร"
          className="input"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </div>
  )
}
