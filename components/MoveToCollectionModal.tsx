'use client'

import { FormEvent, useState } from 'react'
import { Card } from '@/lib/types'
import Modal from './Modal'

interface Props {
  card: Card
  onClose: () => void
  onMoved: () => void
}

export default function MoveToCollectionModal({ card, onClose, onMoved }: Props) {
  const [costThb, setCostThb] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (costThb.trim() === '' || isNaN(Number(costThb))) {
      setError('กรุณากรอกราคาซื้อเป็นตัวเลข')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_wishlist: false,
        cost_thb: Number(costThb),
        costs_thb: [Number(costThb)],
        quantity: 1,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok || !data.success) {
      setError(data.error || 'บันทึกไม่สำเร็จ')
      return
    }
    onMoved()
  }

  return (
    <Modal title={`ย้าย "${card.name}" เข้าคอลเลกชัน`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">ราคาซื้อ (บาท)</span>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={costThb}
            onChange={(e) => setCostThb(e.target.value)}
            className="input"
            placeholder="0"
          />
        </label>

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
            {saving ? 'กำลังย้าย...' : 'ย้ายเข้าคอลเลกชัน'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
