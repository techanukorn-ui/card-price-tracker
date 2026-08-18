'use client'

import { FormEvent, useState } from 'react'
import { CATEGORY_OPTIONS, GRADE_OPTIONS, RAW_CONDITION_OPTIONS } from '@/lib/types'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

interface Row {
  name: string
  cost: string
  snkrdunkUrl: string
}

function emptyRow(): Row {
  return { name: '', cost: '', snkrdunkUrl: '' }
}

export default function SequentialSetFormModal({ onClose, onSaved }: Props) {
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0])
  const [grade, setGrade] = useState('PSA10')
  const [rawCondition, setRawCondition] = useState<string>(RAW_CONDITION_OPTIONS[0])
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (rows.length < 2) {
      setError('Sequential Set ต้องมีอย่างน้อย 2 ใบ')
      return
    }
    if (rows.some((r) => !r.name.trim())) {
      setError('กรุณากรอกชื่อการ์ดให้ครบทุกใบ')
      return
    }
    if (rows.some((r) => r.cost.trim() === '' || isNaN(Number(r.cost)))) {
      setError('กรุณากรอกราคาซื้อให้ครบทุกใบ')
      return
    }

    setSaving(true)
    try {
      const sequentialSetId = crypto.randomUUID()

      for (const row of rows) {
        const cost = Number(row.cost)
        const payload = {
          name: row.name.trim(),
          category,
          grade,
          raw_condition: grade === 'Raw' ? rawCondition : null,
          cost_thb: cost,
          costs_thb: [cost],
          quantity: 1,
          snkrdunk_url: row.snkrdunkUrl.trim() || null,
          custom_image_url: null,
          is_wishlist: false,
          sequential_set_id: sequentialSetId,
        }
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
    <Modal onClose={onClose} title="เพิ่ม Sequential Set">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          เพิ่มการ์ดหลายใบพร้อมกัน ระบบจะจัดกลุ่มการ์ดชุดนี้แสดงเป็นก้อนเดียวกันในหน้ารายการ
        </p>

        <Field label="หมวดหมู่ (ใช้กับทุกใบในชุด)">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="เกรด (ใช้กับทุกใบในชุด)">
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input">
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        {grade === 'Raw' && (
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

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">การ์ดในชุด</span>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    className="input flex-1"
                    placeholder={`ชื่อการ์ดใบที่ ${i + 1}`}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={r.cost}
                    onChange={(e) => updateRow(i, 'cost', e.target.value)}
                    className="input !w-24"
                    placeholder="ราคา"
                  />
                  {rows.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="shrink-0 rounded-md bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      ลบ
                    </button>
                  )}
                </div>
                <input
                  value={r.snkrdunkUrl}
                  onChange={(e) => updateRow(i, 'snkrdunkUrl', e.target.value)}
                  className="input"
                  placeholder="SNKRDUNK URL (ถ้ามี)"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="mt-2 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            + เพิ่มใบ
          </button>
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
            {saving ? 'กำลังบันทึก...' : `บันทึก ${rows.length} ใบ`}
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
