'use client'

import { useEffect, useRef, useState } from 'react'
import {
  EXTENSION_STALE_HINT,
  PriceUpdateCardResult,
  PriceUpdateDone,
  PriceUpdateProgress,
  listenForExtensionStale,
} from '@/lib/priceUpdateBridge'

interface Props {
  onDone?: () => void
}

interface JobState {
  jobId: string
  total: number
  completed: number
  successCount: number
  failures: { cardId: string; error: string }[]
  finished: boolean
}

export default function PriceUpdateBar({ onDone }: Props) {
  const [job, setJob] = useState<JobState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onProgress(e: Event) {
      const detail = (e as CustomEvent<PriceUpdateProgress>).detail
      setJob((prev) => {
        if (!prev || prev.jobId !== detail.jobId) {
          return {
            jobId: detail.jobId,
            total: detail.total,
            completed: detail.completed,
            successCount: 0,
            failures: [],
            finished: false,
          }
        }
        return { ...prev, total: detail.total, completed: detail.completed }
      })
    }

    function onCardResult(e: Event) {
      const detail = (e as CustomEvent<PriceUpdateCardResult>).detail
      setJob((prev) => {
        if (!prev || prev.jobId !== detail.jobId) return prev
        return {
          ...prev,
          successCount: prev.successCount + (detail.ok ? 1 : 0),
          failures: detail.ok
            ? prev.failures
            : [...prev.failures, { cardId: detail.cardId, error: detail.error || 'ไม่ทราบสาเหตุ' }],
        }
      })
    }

    function onDoneEvt(e: Event) {
      const detail = (e as CustomEvent<PriceUpdateDone>).detail
      setJob((prev) => (prev && prev.jobId === detail.jobId ? { ...prev, finished: true } : prev))
      onDone?.()
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setJob(null), 6000)
    }

    window.addEventListener('cpt:progress', onProgress)
    window.addEventListener('cpt:card-result', onCardResult)
    window.addEventListener('cpt:done', onDoneEvt)
    const unsubscribeStale = listenForExtensionStale(() => {
      setJob(null)
      alert(EXTENSION_STALE_HINT)
    })
    return () => {
      window.removeEventListener('cpt:progress', onProgress)
      window.removeEventListener('cpt:card-result', onCardResult)
      window.removeEventListener('cpt:done', onDoneEvt)
      unsubscribeStale()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [onDone])

  if (!job) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[92%] max-w-md rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      {!job.finished ? (
        <>
          <p className="text-sm font-semibold text-slate-800">
            กำลังดึงราคาจาก SNKRDUNK... ({job.completed}/{job.total})
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${job.total ? (job.completed / job.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">อย่าปิดแท็บที่ extension เปิดไว้จนกว่าจะเสร็จ</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-800">
            อัปเดตเสร็จแล้ว: สำเร็จ {job.successCount} ใบ
            {job.failures.length > 0 ? `, ล้มเหลว ${job.failures.length} ใบ` : ''}
          </p>
          {job.failures.length > 0 && (
            <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-[11px] text-red-600">
              {job.failures.map((f, i) => (
                <li key={f.cardId + i}>{f.error}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
