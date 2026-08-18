'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Card,
  CATEGORY_OPTIONS,
  GRADE_OPTIONS,
  ITEM_TYPE_OPTIONS,
  RAW_CONDITION_OPTIONS,
  SEALED_BOX_ITEM_TYPE,
} from '@/lib/types'
import { formatTHB } from '@/lib/format'
import Modal from './Modal'

interface Props {
  mode: 'mine' | 'wishlist'
  card: Card | null
  onClose: () => void
  onSaved: () => void
}

function initialCosts(card: Card | null): string[] {
  if (card?.costs_thb && card.costs_thb.length > 0) return card.costs_thb.map((c) => c.toString())
  if (card?.cost_thb !== null && card?.cost_thb !== undefined) return [card.cost_thb.toString()]
  return ['']
}

export default function CardFormModal({ mode, card, onClose, onSaved }: Props) {
  const isEdit = !!card
  const [name, setName] = useState(card?.name || '')
  const [category, setCategory] = useState(card?.category || 'Pokémon')
  const [itemType, setItemType] = useState(card?.item_type || 'การ์ด')
  const [grade, setGrade] = useState(card?.grade || 'PSA10')
  const [rawCondition, setRawCondition] = useState(card?.raw_condition || 'A')
  const isSealedBox = itemType === SEALED_BOX_ITEM_TYPE
  const [costsThb, setCostsThb] = useState<string[]>(initialCosts(card))
  const [snkrdunkUrl, setSnkrdunkUrl] = useState(card?.snkrdunk_url || '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateCost(index: number, value: string) {
    setCostsThb((prev) => prev.map((c, i) => (i === index ? value : c)))
  }
  function addCost() {
    setCostsThb((prev) => [...prev, ''])
  }
  function removeCost(index: number) {
    setCostsThb((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('กรุณากรอกชื่อการ์ด')
      return
    }
    if (
      mode === 'mine' &&
      (costsThb.length === 0 || costsThb.some((c) => c.trim() === '' || isNaN(Number(c))))
    ) {
      setError('กรุณากรอกราคาซื้อให้ครบทุกใบ')
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

      const parsedCosts = mode === 'mine' ? costsThb.map((c) => Number(c)) : []

      const payload = {
        name: name.trim(),
        category,
        item_type: itemType,
        grade: isSealedBox ? 'Raw' : grade,
        raw_condition: !isSealedBox && grade === 'Raw' ? rawCondition : null,
        cost_thb: mode === 'mine' ? parsedCosts.reduce((s, c) => s + c, 0) : null,
        costs_thb: mode === 'mine' ? parsedCosts : null,
        quantity: mode === 'mine' ? parsedCosts.length : 1,
        snkrdunk_url: snkrdunkUrl.trim() || null,
        custom_image_url: customImageUrl,
        is_wishlist: mode === 'wishlist',
      }

      if (isEdit && card) {
        const res = await fetch(`/api/cards/${card.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
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

        <Field label="ประเภท">
          <select value={itemType} onChange={(e) => setItemType(e.target.value)} className="input">
            {ITEM_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {!isSealedBox && (
          <Field label="เกรด">
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input">
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isSealedBox && grade === 'Raw' && (
          <Field label="สภาพ (A/B/C/D)">
            <select value={rawCondition} onChange={(e) => setRawCondition(e.target.value)} className="input">
              {RAW_CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        )}

        {mode === 'mine' && (
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">ต้นทุนแต่ละใบ (บาท)</span>
            <div className="space-y-2">
              {costsThb.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={c}
                    onChange={(e) => updateCost(i, e.target.value)}
                    className="input flex-1"
                    placeholder={`ราคาใบที่ ${i + 1}`}
                  />
                  {costsThb.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCost(i)}
                      className="shrink-0 rounded-md bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCost}
              className="mt-2 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + เพิ่มใบ
            </button>
            {costsThb.length > 1 && costsThb.every((c) => c.trim() !== '' && !isNaN(Number(c))) && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                รวมทั้งหมด {formatTHB(costsThb.reduce((s, c) => s + Number(c), 0))} ({costsThb.length} ใบ)
              </p>
            )}
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
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
