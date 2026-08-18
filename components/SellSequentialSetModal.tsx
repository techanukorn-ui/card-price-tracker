'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card } from '@/lib/types'
import { formatTHB } from '@/lib/format'
import Modal from './Modal'

interface Props {
  cards: Card[]
  onClose: () => void
  onSold: () => void
}

export default function SellSequentialSetModal({ cards, onClose, onSold }: Props) {
  const [soldPriceThb, setSoldPriceThb] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = Number(soldPriceThb)
  const validTotal = soldPriceThb.trim() !== '' && !isNaN(total)
  const baseShare = validTotal ? Math.floor((total / cards.length) * 100) / 100 : 0
  const shares = validTotal
    ? cards.map((_, i) => (i === cards.length - 1 ? total - baseShare * (cards.length - 1) : baseShare))
    : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validTotal) {
      setError('กรุณากรอกราคาขายเป็นตัวเลข')
      return
    }

    setSaving(true)
    try {
      const soldAt = new Date().toISOString()
      for (let i = 0; i < cards.length; i++) {
        const { error: updErr } = await supabase
          .from('cards')
          .update({
            is_sold: true,
            sold_price_thb: shares[i],
            sold_at: soldAt,
          })
          .eq('id', cards[i].id)
        if (updErr) throw updErr
      }
    } catch (err: any) {
      setSaving(false)
      setError(err.message || 'บันทึกไม่สำเร็จ')
      return
    }

    setSaving(false)
    onSold()
  }

  return (
    <Modal title={`ขายทั้งเซ็ต (${cards.length} ใบ)`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          กรอกราคาขายรวมของทั้งเซ็ต ระบบจะหารเฉลี่ยราคาขายให้แต่ละใบเอง
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">ราคาที่ขายได้รวม (บาท)</span>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={soldPriceThb}
            onChange={(e) => setSoldPriceThb(e.target.value)}
            className="input"
            placeholder="0"
          />
        </label>

        <div className="space-y-1.5">
          {cards.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-700"
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-300">
                {validTotal ? formatTHB(shares[i]) : '—'}
              </span>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'ยืนยันว่าขายแล้ว'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
