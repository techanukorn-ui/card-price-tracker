'use client'

import { useEffect, useState } from 'react'
import { countCompleted, MobileBatchJob } from '@/lib/mobilePriceUpdate'

interface Props {
  job: MobileBatchJob | null
  onDone?: () => void
}

const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 20 * 60 * 1000 // give plenty of room for occasional Cloudflare challenges mid-batch

export default function MobilePriceUpdateBar({ job, onDone }: Props) {
  const [completed, setCompleted] = useState(0)
  const [finished, setFinished] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!job) {
      setCompleted(0)
      setFinished(false)
      setTimedOut(false)
      return
    }

    let cancelled = false
    setCompleted(0)
    setFinished(false)
    setTimedOut(false)

    const startedAtMs = new Date(job.startedAt).getTime()

    const interval = setInterval(async () => {
      if (cancelled) return
      const n = await countCompleted(job)
      if (cancelled) return
      setCompleted(n)

      const isDone = n >= job.total
      const isTimedOut = !isDone && Date.now() - startedAtMs > MAX_WAIT_MS
      if (isDone || isTimedOut) {
        clearInterval(interval)
        setFinished(true)
        setTimedOut(isTimedOut)
        onDone?.()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.token])

  if (!job) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[92%] max-w-md rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {!finished ? (
        <>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            กำลังอัปเดตใบที่ {Math.min(completed + 1, job.total)} จาก {job.total}...
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${job.total ? (completed / job.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            อย่าปิดแท็บที่เปิดไปหน้า SNKRDUNK จนกว่าจะเสร็จ — มันจะเปลี่ยนหน้าและปิดตัวเองอัตโนมัติ
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {timedOut
            ? `หยุดรอแล้ว: อัปเดตสำเร็จ ${completed}/${job.total} ใบ (ที่เหลืออาจติดขัดระหว่างทาง ลองกดอัปเดตอีกครั้งได้)`
            : `อัปเดตเสร็จแล้ว: สำเร็จ ${completed}/${job.total} ใบ`}
        </p>
      )}
    </div>
  )
}
