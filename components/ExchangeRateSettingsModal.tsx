'use client'

import { useEffect, useState } from 'react'
import { getFixedExchangeRate, setFixedExchangeRate } from '@/lib/appSettings'
import { formatRelative } from '@/lib/format'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const LIVE_RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=THB'

export default function ExchangeRateSettingsModal({ onClose, onSaved }: Props) {
  const [input, setInput] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingLive, setFetchingLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFixedExchangeRate().then((setting) => {
      if (setting) {
        setInput(String(setting.rate))
        setUpdatedAt(setting.updatedAt)
      }
      setLoading(false)
    })
  }, [])

  async function handleFetchLive() {
    setFetchingLive(true)
    setError(null)
    try {
      const res = await fetch(LIVE_RATE_URL, { cache: 'no-store' })
      const json = await res.json()
      const rate = json?.rates?.THB
      if (typeof rate !== 'number') throw new Error('อ่านค่าจาก API ไม่ได้')
      setInput(String(rate))
    } catch {
      setError('ดึงเรทตลาดตอนนี้ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setFetchingLive(false)
    }
  }

  async function handleSave() {
    const rate = Number(input)
    if (!input.trim() || !isFinite(rate) || rate <= 0) {
      setError('กรอกเรทเป็นตัวเลขที่มากกว่า 0')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setFixedExchangeRate(rate)
      onSaved()
      onClose()
    } catch (e: any) {
      setError('บันทึกไม่สำเร็จ: ' + (e?.message || 'ไม่ทราบสาเหตุ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="เรทค่าเงิน (JPY → THB)" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        เรทนี้จะถูกใช้แทนการดึงเรทสดทุกครั้งที่อัปเดตราคา (ทั้งบนคอมและมือถือ) — เพื่อให้ราคาบาทที่เห็นสะท้อนแค่ราคาการ์ดที่เปลี่ยนจริง
        ไม่ใช่ค่าเงินที่แกว่งไปมา แก้เลขนี้เองได้ทุกเมื่อที่ต้องการ
      </p>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">1 เยน (JPY) = ? บาท (THB)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.0001"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="เช่น 0.2300"
              className="input"
            />
          </label>

          {updatedAt && <p className="mt-1.5 text-[11px] text-slate-400">ตั้งค่าล่าสุดเมื่อ {formatRelative(updatedAt)}</p>}

          <button
            type="button"
            onClick={handleFetchLive}
            disabled={fetchingLive}
            className="mt-3 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            {fetchingLive ? 'กำลังดึง...' : 'ดึงเรทตลาดตอนนี้มาใส่ให้'}
          </button>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
