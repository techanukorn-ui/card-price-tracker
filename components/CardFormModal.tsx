'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CATEGORY_OPTIONS, GRADE_OPTIONS } from '@/lib/types'
import Modal from './Modal'

interface Props {
  mode: 'mine' | 'wishlist'
  card: Card | null
  onClose: () => void
  onSaved: () => void
}

export default function CardFormModal({ mode, card, onClose, onSaved }: Props) {
  const isEdit = !!card
  const [name, setName] = useState(card?.name || '')
  const [category, setCategory] = useState(card?.category || 'Pokémon')
  const [grade, setGrade] = useState(card?.grade || 'PSA10')
  const [costThb, setCostThb] = useState(card?.cost_thb?.toString() || '')
  const [quantity, setQuantity] = useState(card?.quantity?.toString() || '1')
  const [snkrdunkUrl, setSnkrdunkUrl] = useState(card?.snkrdunk_url || '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('กรุณากรอกชื่อการ์ด')
      return
    }
    if (mode === 'mine' && costThb.trim() === '') {
      setError('กรุณากรอกราคาซื้อ')
      return
    }
    if (mode === 'mine' && (quantity.trim() === '' || Number(quantity) < 1)) {
      setError('จำนวนใบต้องมากกว่าหรือเท่ากับ 1')
      return
    }

    setSaving(true)
    try {
      let customImageUrl = card?.custom_image_url || null

      if (file) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('card-images').upload(path, file, {
          upsert: true,
        })
        if (uploadErr) throw uploadErr
        const { data: pub } = supabase.storage.from('card-images').getPublicUrl(path)
        customImageUrl = pub.publicUrl
      }

      const payload = {
        name: name.trim(),
        category,
        grade,
        cost_thb: mode === 'mine' ? Number(costThb) : null,
        quantity: mode === 'mine' ? Number(quantity) || 1 : 1,
        snkrdunk_url: snkrdunkUrl.trim() || null,
        custom_image_url: customImageUrl,
        is_wishlist: mode === 'wishlist',
      }

      if (isEdit && card) {
        const { error: updErr } = await supabase.from('cards').update(payload).eq('id', card.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase.from('cards').insert(payload)
        if (insErr) throw insErr
      }

      onSaved()
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title={isEdit ? 'แก้ไขการ์ด' : mode === 'mine' ? 'เพิ่มการ์ด' : 'เพิ่ม Wishlist'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="ชื่อการ์ด (ที่คุณเรียกเอง)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="เช่น Pikachu Poncho Team Skull"
          />
        </Field>

        <Field label="หมวดหมู่">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="เกรด">
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input">
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        {mode === 'mine' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="ราคาซื้อรวม (บาท)">
              <input
                type="number"
                inputMode="decimal"
                value={costThb}
                onChange={(e) => setCostThb(e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
            <Field label="จำนวนใบ">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input"
                placeholder="1"
              />
            </Field>
          </div>
        )}

        <Field label="SNKRDUNK URL">
          <input
            value={snkrdunkUrl}
            onChange={(e) => setSnkrdunkUrl(e.target.value)}
            className="input"
            placeholder="https://snkrdunk.com/apparels/..."
          />
        </Field>

        <Field label="อัปโหลดรูป (ถ้ามี — จะใช้แทนรูป auto จาก SNKRDUNK)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </Field>

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
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}
