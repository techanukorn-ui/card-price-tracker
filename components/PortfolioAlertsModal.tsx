'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PortfolioAlert, PriceAlertDirection } from '@/lib/types'
import { formatTHB, formatRelative } from '@/lib/format'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

// Global (not per-card) target on total portfolio market value —
// "การ์ดของฉัน" scope only. Checked server-side after every price update
// (lib/portfolioAlerts.ts); this modal is just CRUD for the list, same
// shape as components/PriceAlertsPanel.tsx but without a card_id.
export default function PortfolioAlertsModal({ onClose }: Props) {
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PortfolioAlert | null>(null)

  async function load() {
    const { data } = await supabase.from('portfolio_alerts').select('*').order('created_at', { ascending: true })
    setAlerts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id: string) {
    const ok = window.confirm('ลบเป้าพอร์ตนี้ใช่ไหม?')
    if (!ok) return
    await supabase.from('portfolio_alerts').delete().eq('id', id)
    load()
  }

  async function handleToggleActive(alert: PortfolioAlert) {
    await supabase
      .from('portfolio_alerts')
      .update({
        is_active: !alert.is_active,
        triggered_at: !alert.is_active ? null : alert.triggered_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alert.id)
    load()
  }

  return (
    <Modal title="🎯 เป้าพอร์ตรวม" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        แจ้งเตือนเมื่อ<b>มูลค่าตลาดรวม</b>ของการ์ดของฉัน (ไม่รวม Wishlist/ขายแล้ว) ถึงเป้าที่ตั้งไว้ — เช็คทุกครั้งที่มีการอัปเดตราคาการ์ดใบไหนก็ตาม
      </p>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <>
          {alerts.length === 0 && !formOpen && <p className="text-xs text-slate-400">ยังไม่มีเป้าพอร์ตรวม</p>}

          {alerts.length > 0 && (
            <div className="space-y-1.5">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <span className="num font-semibold text-slate-800 dark:text-slate-200">
                      {a.direction === 'above' ? '⬆️ ขึ้นถึง' : '⬇️ ลงถึง'} {formatTHB(a.target_value_thb)}
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
                </div>
              ))}
            </div>
          )}

          {formOpen ? (
            <AlertForm
              alert={editing}
              onClose={() => setFormOpen(false)}
              onSaved={() => {
                setFormOpen(false)
                load()
              }}
            />
          ) : (
            <button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="mt-3 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + ตั้งเป้าพอร์ตใหม่
            </button>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ปิด
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function AlertForm({
  alert,
  onClose,
  onSaved,
}: {
  alert: PortfolioAlert | null
  onClose: () => void
  onSaved: () => void
}) {
  const [target, setTarget] = useState(alert ? String(alert.target_value_thb) : '')
  const [direction, setDirection] = useState<PriceAlertDirection>(alert?.direction || 'above')
  const [note, setNote] = useState(alert?.note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const targetValue = Number(target)
    if (!target.trim() || !isFinite(targetValue) || targetValue <= 0) {
      setError('กรอกมูลค่าเป้าหมาย (บาท) เป็นตัวเลขที่มากกว่า 0')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      target_value_thb: targetValue,
      direction,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
      triggered_at: null,
      is_active: true,
    }
    const { error: err } = alert
      ? await supabase.from('portfolio_alerts').update(payload).eq('id', alert.id)
      : await supabase.from('portfolio_alerts').insert(payload)
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
          ⬆️ แจ้งเมื่อมูลค่าขึ้นถึง
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
          ⬇️ แจ้งเมื่อมูลค่าลงถึง
        </button>
      </div>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">มูลค่าเป้าหมาย (บาท)</span>
        <input
          type="number"
          inputMode="numeric"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="เช่น 2000000"
          className="input"
        />
      </label>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">หมายเหตุ (ไม่บังคับ)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น เป้าปีนี้"
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
