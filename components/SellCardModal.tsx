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
  const totalQty = card.quantity ?? 1
  const [qtySold, setQtySold] = useState(totalQty.toString())
  const [soldPriceThb, setSoldPriceThb] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const qty = Number(qtySold)
    if (qtySold.trim() === '' || isNaN(qty) || qty < 1 || qty > totalQty) {
      setError(`กรุณากรอกจำนวนที่ขายเป็นตัวเลข 1-${totalQty}`)
      return
    }
    if (soldPriceThb.trim() === '' || isNaN(Number(soldPriceThb))) {
      setError('กรุณากรอกราคาขายเป็นตัวเลข')
      return
    }

    setSaving(true)
    const price = Number(soldPriceThb)
    const costs = card.costs_thb && card.costs_thb.length > 0 ? card.costs_thb : card.cost_thb !== null ? [card.cost_thb] : []

    try {
      if (qty >= totalQty) {
        // sell the whole card entry as-is
        const { error: updErr } = await supabase
          .from('cards')
          .update({
            is_sold: true,
            sold_price_thb: price,
            sold_at: new Date().toISOString(),
          })
          .eq('id', card.id)
        if (updErr) throw updErr
      } else {
        // partial sale: split off `qty` copies into a new sold card entry,
        // keep the rest (with their own costs) on the original entry
        const soldCosts = costs.slice(0, qty)
        const remainingCosts = costs.slice(qty)
        const soldCostTotal = soldCosts.reduce((s, c) => s + c, 0)
        const remainingCostTotal = remainingCosts.reduce((s, c) => s + c, 0)

        const { error: insErr } = await supabase.from('cards').insert({
          name: card.name,
          category: card.category,
          grade: card.grade,
          raw_condition: card.raw_condition,
          cost_thb: soldCostTotal,
          costs_thb: soldCosts,
          quantity: qty,
          snkrdunk_url: card.snkrdunk_url,
          image_url: card.image_url,
          custom_image_url: card.custom_image_url,
          is_wishlist: false,
          is_sold: true,
          sold_price_thb: price,
          sold_at: new Date().toISOString(),
          sequential_set_id: card.sequential_set_id,
        })
        if (insErr) throw insErr

        const { error: updErr } = await supabase
          .from('cards')
          .update({
            cost_thb: remainingCostTotal,
            costs_thb: remainingCosts,
            quantity: totalQty - qty,
          })
          .eq('id', card.id)
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
    <Modal title={`ทำเครื่องหมายว่าขาย "${card.name}" แล้ว`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {totalQty > 1 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              จำนวนที่ขาย (มีทั้งหมด {totalQty} ใบ)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={totalQty}
              value={qtySold}
              onChange={(e) => setQtySold(e.target.value)}
              className="input"
            />
            {Number(qtySold) > 0 && Number(qtySold) < totalQty && (
              <p className="mt-1 text-[11px] text-slate-400">
                เหลือ {totalQty - Number(qtySold)} ใบในคอลเลกชัน ที่เหลือจะยังไม่ถือว่าขาย
              </p>
            )}
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            ราคาที่ขายได้ {totalQty > 1 ? `(รวม ${qtySold || '?'} ใบที่ขาย, บาท)` : '(บาท)'}
          </span>
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
