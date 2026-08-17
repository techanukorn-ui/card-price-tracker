'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getSiteBranding, setSiteBranding } from '@/lib/appSettings'
import { formatRelative } from '@/lib/format'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const MAX_DIMENSION = 512
const JPEG_QUALITY = 0.82

// Downscales + re-encodes as JPEG client-side so uploads to Supabase Storage
// stay tiny (a favicon/header icon never needs to be more than a few
// hundred KB, let alone a multi-MB phone photo).
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('บีบอัดรูปไม่สำเร็จ'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('บีบอัดรูปไม่สำเร็จ'))),
          'image/jpeg',
          JPEG_QUALITY
        )
      }
      img.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

export default function BrandingSettingsModal({ onClose, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSiteBranding().then((b) => {
      setTitle(b.title || '')
      setIconUrl(b.iconUrl)
      setUpdatedAt(b.updatedAt)
      setLoading(false)
    })
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const blob = await compressImage(file)
      const path = `site/icon-${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('card-images')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadErr) throw uploadErr
      const { data: pub } = supabase.storage.from('card-images').getPublicUrl(path)
      setIconUrl(pub.publicUrl)
    } catch (e: any) {
      setError('อัปโหลดรูปไม่สำเร็จ: ' + (e?.message || 'ไม่ทราบสาเหตุ'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setSiteBranding({ title: title.trim(), iconUrl: iconUrl || undefined })
      onSaved()
      onClose()
    } catch (e: any) {
      setError('บันทึกไม่สำเร็จ: ' + (e?.message || 'ไม่ทราบสาเหตุ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="ตั้งชื่อ/ไอคอนเว็บ" onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">ชื่อเว็บ</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card Price Tracker"
              className="input"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1 block text-xs font-medium text-slate-600">ไอคอน</span>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-2xl">
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt="ไอคอน" className="h-full w-full object-cover" />
                ) : (
                  '🃏'
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          </div>

          {updatedAt && <p className="mt-3 text-[11px] text-slate-400">แก้ไขล่าสุดเมื่อ {formatRelative(updatedAt)}</p>}
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
              disabled={saving || uploading}
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
