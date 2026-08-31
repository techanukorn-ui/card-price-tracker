// ==UserScript==
// @name         Card Price Tracker - Mobile Batch Update
// @namespace    card-price-tracker
// @version      1.1
// @description  Scrapes SNKRDUNK sold-price history and reports it back to card-price-tracker, one card per page load. Only activates when the page URL carries the cpt_* queue params created by the web app's "อัปเดตราคา (มือถือ)" button — otherwise it's a no-op, safe to leave installed and browsing SNKRDUNK normally.
// @match        https://snkrdunk.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Ports the exact same scraping + averaging logic as
// browser-extension/background.js (scrapeCardOnPage) — see that file's
// comments for the full rationale. The difference here is there's no
// background page to hold queue state between cards (iOS's Userscripts app
// has no equivalent), so the whole remaining queue rides along as URL query
// params and each "next card" is a real location.href navigation in the same
// tab, never a new popup — that's what keeps this working under iOS Safari's
// popup blocker.

;(function () {
  'use strict'

  if (window.__cptMobileRan) return
  window.__cptMobileRan = true

  const BETWEEN_CARDS_DELAY_MS = 1800
  const SEALED_BOX_ITEM_TYPE = 'กล่องซีล'
  const SEALED_BOX_VARIANT_LABEL = '1個'

  const params = new URLSearchParams(window.location.search)
  const q = params.get('cpt_q')
  const iStr = params.get('cpt_i')
  const token = params.get('cpt_t')
  const apiUrl = params.get('cpt_api')
  const rateStr = params.get('cpt_rate')

  // Not a batch-update navigation (normal browsing) — do nothing.
  if (!q || iStr === null || !token || !apiUrl || !rateStr) return

  const index = Number(iStr)
  const rate = Number(rateStr)

  let queue
  try {
    queue = JSON.parse(decodeURIComponent(escape(atob(q))))
  } catch (e) {
    console.error('[cpt-mobile] อ่านคิวจาก URL ไม่ได้:', e)
    return
  }

  const card = queue[index]
  if (!card) {
    console.error('[cpt-mobile] index ไม่ตรงกับคิว:', index)
    return
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  async function pollUntil(check, timeoutMs) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const result = check()
      if (result) return result
      await sleep(300)
    }
    return null
  }

  function parseSoldAt(s) {
    s = s.trim()
    if (s === 'たった今') return new Date()
    let m = s.match(/^(\d+)分前$/)
    if (m) return new Date(Date.now() - Number(m[1]) * 60 * 1000)
    m = s.match(/^(\d+)時間前$/)
    if (m) return new Date(Date.now() - Number(m[1]) * 60 * 60 * 1000)
    m = s.match(/^(\d+)日前$/)
    if (m) return new Date(Date.now() - Number(m[1]) * 24 * 60 * 60 * 1000)
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return null
  }

  function readRows() {
    const soldAtCells = document.querySelectorAll('tr td[class*="__soldAt"]')
    return Array.from(soldAtCells).map((td) => {
      const tr = td.closest('tr')
      const tds = tr ? tr.querySelectorAll('td') : []
      return {
        soldAtText: (tds[0] && tds[0].textContent) || '',
        variant: ((tds[1] && tds[1].textContent) || '').trim(),
        priceText: (tds[3] && tds[3].textContent) || '',
      }
    })
  }

  function findButton(label) {
    return Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === label) || null
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Same rule as browser-extension/background.js's findPriceGridButton():
  // SNKRDUNK has two button sets with overlapping label text — a price grid
  // near the top (label immediately followed by "¥N,NNN~" or "出品待ち") and a
  // separate plain-text filter row further down (just "PSA10" etc, matched by
  // findButton() above to filter the sold-history table). This matches the
  // price-grid chip specifically so the reported price isn't always null.
  function findPriceGridButton(label) {
    const re = new RegExp('^' + escapeRegex(label) + '(¥|出品待ち)')
    return Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent.trim())) || null
  }

  function readListingPriceFromButton(btn) {
    if (!btn) return null
    const m = (btn.textContent || '').match(/¥\s?([\d,]+)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
  }

  // Same rule as browser-extension/background.js's findMainImage(): the
  // card's own product photo is the one img[src] containing "size=l".
  function findMainImage() {
    const img = Array.from(document.querySelectorAll('img')).find((el) => (el.src || '').includes('size=l'))
    return img ? img.src : null
  }

  async function scrapePrice() {
    const tableReady = await pollUntil(() => readRows().length > 0, 8000)
    if (!tableReady) return { ok: false, error: 'โหลดตารางประวัติการขายไม่ทัน' }

    const isSealed = card.itemType === SEALED_BOX_ITEM_TYPE
    let targetVariant

    if (isSealed) {
      targetVariant = SEALED_BOX_VARIANT_LABEL
      const btn = findButton(targetVariant)
      if (btn) btn.click() // best-effort; box pages don't always need it
    } else {
      targetVariant = card.grade === 'Raw' ? card.rawCondition : card.grade
      if (!targetVariant) return { ok: false, error: 'การ์ดใบนี้ไม่มีเกรด/สภาพให้กรอง' }
      const btn = await pollUntil(() => findButton(targetVariant), 5000)
      if (!btn) return { ok: false, error: `ไม่พบปุ่มกรองเกรด "${targetVariant}"` }
      btn.click()
    }

    const filtered = await pollUntil(() => {
      const rows = readRows().filter((r) => r.variant === targetVariant)
      return rows.length > 0 ? rows : null
    }, 5000)

    const rows = filtered || readRows().filter((r) => r.variant === targetVariant)
    const parsed = rows
      .map((r) => ({ date: parseSoldAt(r.soldAtText), price: Number(r.priceText.replace(/[^\d]/g, '')) }))
      .filter((r) => r.date && Number.isFinite(r.price) && r.price > 0)

    parsed.sort((a, b) => b.date.getTime() - a.date.getTime())
    if (parsed.length === 0) return { ok: false, error: `ไม่พบประวัติการขายที่ตรงกับ "${targetVariant}"` }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const withinWeek = parsed.filter((r) => r.date.getTime() >= sevenDaysAgo)
    const used = withinWeek.length > 0 ? withinWeek.slice(0, 3) : [parsed[0]]
    const avg = used.reduce((sum, r) => sum + r.price, 0) / used.length

    const image_url = card.hasImage ? null : findMainImage()
    const lowest_listing_price_jpy = readListingPriceFromButton(findPriceGridButton(targetVariant))

    return { ok: true, price_jpy: Math.round(avg * 100) / 100, image_url, lowest_listing_price_jpy }
  }

  function nextStepUrl(nextIndex) {
    const next = queue[nextIndex]
    const u = new URL(next.url)
    u.searchParams.set('cpt_q', q)
    u.searchParams.set('cpt_i', String(nextIndex))
    u.searchParams.set('cpt_t', token)
    u.searchParams.set('cpt_api', apiUrl)
    u.searchParams.set('cpt_rate', rateStr)
    return u.toString()
  }

  ;(async () => {
    try {
      const result = await scrapePrice()
      if (result.ok) {
        try {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              card_id: card.id,
              market_price_jpy: result.price_jpy,
              exchange_rate: rate,
              image_url: result.image_url || undefined,
              lowest_listing_price_jpy:
                typeof result.lowest_listing_price_jpy === 'number' ? result.lowest_listing_price_jpy : undefined,
            }),
          })
        } catch (e) {
          console.error('[cpt-mobile] ส่งราคากลับไม่สำเร็จ:', card.id, e)
        }
      } else {
        console.error('[cpt-mobile] ดึงราคาไม่สำเร็จ:', card.id, result.error)
      }
    } catch (e) {
      console.error('[cpt-mobile] สคริปต์พังระหว่างดึงราคา:', card.id, e)
    }

    await sleep(BETWEEN_CARDS_DELAY_MS)

    const nextIndex = index + 1
    if (nextIndex < queue.length) {
      window.location.href = nextStepUrl(nextIndex)
    } else {
      console.log('[cpt-mobile] อัปเดตครบทุกใบแล้ว ปิดแท็บ')
      window.close()
    }
  })()
})()
