'use client'

import { useEffect, useState } from 'react'
import { getTelegramSettings, setTelegramSettings } from '@/lib/appSettings'
import { formatRelative } from '@/lib/format'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function TelegramSettingsModal({ onClose, onSaved }: Props) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [finding, setFinding] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [chatOptions, setChatOptions] = useState<{ chatId: string; name: string }[]>([])

  useEffect(() => {
    getTelegramSettings().then((setting) => {
      setBotToken(setting.botToken || '')
      setChatId(setting.chatId || '')
      setUpdatedAt(setting.updatedAt)
      setLoading(false)
    })
  }, [])

  async function handleFindChatId() {
    if (!botToken.trim()) {
      setError('กรอก Bot Token ก่อน')
      return
    }
    setFinding(true)
    setError(null)
    setInfo(null)
    setChatOptions([])
    try {
      const res = await fetch('/api/telegram/find-chat-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'ดึง Chat ID ไม่สำเร็จ')
        return
      }
      if (data.chats.length === 1) {
        setChatId(data.chats[0].chatId)
        setInfo(`พบแชทกับ "${data.chats[0].name}" — ใส่ Chat ID ให้แล้ว`)
      } else {
        setChatOptions(data.chats)
      }
    } catch {
      setError('ดึง Chat ID ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setFinding(false)
    }
  }

  async function handleTest() {
    if (!botToken.trim() || !chatId.trim()) {
      setError('กรอก Bot Token และ Chat ID ให้ครบก่อนทดสอบ')
      return
    }
    setTesting(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'ส่งข้อความทดสอบไม่สำเร็จ')
        return
      }
      setInfo('ส่งข้อความทดสอบแล้ว เช็คใน Telegram ได้เลย')
    } catch {
      setError('ส่งข้อความทดสอบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!botToken.trim() || !chatId.trim()) {
      setError('กรอก Bot Token และ Chat ID ให้ครบ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setTelegramSettings({ botToken: botToken.trim(), chatId: chatId.trim() })
      onSaved()
      onClose()
    } catch (e: any) {
      setError('บันทึกไม่สำเร็จ: ' + (e?.message || 'ไม่ทราบสาเหตุ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="แจ้งเตือนราคาผ่าน Telegram" onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <>
          <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">วิธีตั้งค่า (ทำครั้งเดียว)</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>ใน Telegram ค้นหา <b>@BotFather</b> แล้วพิมพ์ <code>/newbot</code> ตั้งชื่อบอทตามต้องการ</li>
              <li>คัดลอก Token ที่ได้มาวางในช่องด้านล่าง</li>
              <li>เปิดแชทกับบอทที่สร้าง แล้วพิมพ์ส่งข้อความอะไรก็ได้ (เช่น &quot;hi&quot;) ไปหาบอทก่อน</li>
              <li>กด &quot;ดึง Chat ID อัตโนมัติ&quot; ด้านล่าง</li>
            </ol>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Bot Token</span>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRstuVwxYZ"
              className="input"
              autoComplete="off"
            />
          </label>

          <button
            type="button"
            onClick={handleFindChatId}
            disabled={finding}
            className="mt-2 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {finding ? 'กำลังดึง...' : 'ดึง Chat ID อัตโนมัติ'}
          </button>

          {chatOptions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-slate-500">พบหลายแชท เลือกอันที่ใช่:</p>
              {chatOptions.map((c) => (
                <button
                  key={c.chatId}
                  type="button"
                  onClick={() => {
                    setChatId(c.chatId)
                    setChatOptions([])
                    setInfo(`เลือก "${c.name}" แล้ว`)
                  }}
                  className="block w-full rounded-md border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {c.name} <span className="text-slate-400">({c.chatId})</span>
                </button>
              ))}
            </div>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Chat ID</span>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="เติมให้อัตโนมัติ หรือกรอกเองก็ได้"
              className="input"
              autoComplete="off"
            />
          </label>

          {updatedAt && <p className="mt-1.5 text-[11px] text-slate-400">ตั้งค่าล่าสุดเมื่อ {formatRelative(updatedAt)}</p>}

          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="mt-3 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {testing ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
          </button>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {info && !error && <p className="mt-2 text-sm text-emerald-600">{info}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
