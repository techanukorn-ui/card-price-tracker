'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card } from '@/lib/types'
import Modal from './Modal'

interface Props {
  card: Card
  onClose: () => void
  onSold: () => void
}

export default function SellCardModal({ card, onClose, onSold }: Props) {
  const [soldPriceThb, setSoldPriceThb] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (soldPriceThb.trim() === '' || isNaN(Number(soldPriceThb))) {
      setError('กรุณากรอกราคาขายเป็นตัวเลข')
      return
    }
    setSaving(true)
    setError(null)
    const { error: updErr } = await supabase
      .from('cards')
      .update({
        is_sold: true,
        sold_price_thb: Number(soldPriceThb),
        sold_at: new Date().toISOString(),
      })
      .eq('id', card.id)
    setSaving(false)
    if (updErr) {
      setError(updErr.message)
      return
    }
    onSold()
  }

  return (
    <Modal title={`ทำเครื่องหมายว่าขาย "${card.name}" แล้ว`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">ราคาที่ขายได้ (บาท)</span>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
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
