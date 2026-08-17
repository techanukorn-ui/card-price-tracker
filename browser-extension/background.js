// Orchestrates a price-update job: for each card, reuses one real browser
// tab, navigates it to the card's SNKRDUNK page, waits for the sold-history
// table to render, filters it to the card's own grade/condition, applies the
// "up to 3 most recent sales within 7 days, else the single latest sale"
// averaging rule, then POSTs the result to the web app's /api/update-price.
//
// Because this all happens as real navigations in a real Chrome tab (not a
// headless fetch), it passes SNKRDUNK's Cloudflare bot check the same way a
// human clicking through the site would.

const UPDATE_PRICE_URL = 'https://card-price-tracker-ten.vercel.app/api/update-price'
const EXCHANGE_RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=THB'
const SEALED_BOX_ITEM_TYPE = 'กล่องซีล'
const PAGE_SETTLE_DELAY_MS = 500
const BETWEEN_CARDS_DELAY_MS = 1800

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let settled = false
    function cleanup() {
      if (settled) return
      settled = true
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timer)
    }
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        cleanup()
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, timeoutMs)
  })
}

// Injected into the SNKRDUNK page. Must be fully self-contained (no closures
// over anything outside its own arguments) since chrome.scripting.executeScript
// serializes it and runs it in the page's isolated world.
//
// SNKRDUNK's sold-history table is rendered client-side after the initial
// page load (Next.js hydration + a data fetch), so a fixed short delay is
// not reliable — this polls for the table (and, after clicking a grade
// filter, for rows actually matching that grade) instead of guessing a wait.
function scrapeCardOnPage(grade, rawCondition, itemType, sealedBoxLabel) {
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

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  // Polls `check` every 300ms (up to timeoutMs) until it returns a truthy
  // value, or returns null if it never does.
  async function pollUntil(check, timeoutMs) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const result = check()
      if (result) return result
      await sleep(300)
    }
    return null
  }

  return (async () => {
    // Wait for the sold-history table itself to exist before doing anything else.
    const tableReady = await pollUntil(() => readRows().length > 0, 8000)
    if (!tableReady) {
      return { ok: false, error: 'โหลดตารางประวัติการขายบนหน้า SNKRDUNK ไม่ทัน (อาจช้ากว่าปกติ)' }
    }

    const isSealed = itemType === SEALED_BOX_ITEM_TYPE
    let targetVariant

    if (isSealed) {
      targetVariant = sealedBoxLabel
      const btn = findButton(targetVariant)
      if (btn) btn.click() // best-effort; box pages don't always need it
    } else {
      targetVariant = grade === 'Raw' ? rawCondition : grade
      if (!targetVariant) {
        return { ok: false, error: 'การ์ดใบนี้ไม่มีเกรด/สภาพ (raw_condition) ให้กรอง' }
      }
      const btn = await pollUntil(() => findButton(targetVariant), 5000)
      if (!btn) {
        return { ok: false, error: `ไม่พบปุ่มกรองเกรด "${targetVariant}" บนหน้า SNKRDUNK` }
      }
      btn.click()
    }

    // After clicking, wait for the table to actually reflect the filter
    // (rows whose grade/condition column matches the target).
    const filtered = await pollUntil(() => {
      const rows = readRows().filter((r) => r.variant === targetVariant)
      return rows.length > 0 ? rows : null
    }, 5000)

    const rows = filtered || readRows().filter((r) => r.variant === targetVariant)
    const parsed = rows
      .map((r) => ({
        date: parseSoldAt(r.soldAtText),
        price: Number(r.priceText.replace(/[^\d]/g, '')),
      }))
      .filter((r) => r.date && Number.isFinite(r.price) && r.price > 0)

    parsed.sort((a, b) => b.date.getTime() - a.date.getTime())

    if (parsed.length === 0) {
      return { ok: false, error: `ไม่พบประวัติการขายที่ตรงกับ "${targetVariant}"` }
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const withinWeek = parsed.filter((r) => r.date.getTime() >= sevenDaysAgo)
    const used = withinWeek.length > 0 ? withinWeek.slice(0, 3) : [parsed[0]]
    const avg = used.reduce((sum, r) => sum + r.price, 0) / used.length

    return {
      ok: true,
      price_jpy: Math.round(avg * 100) / 100,
      sampleCount: used.length,
      usedFallback: withinWeek.length === 0,
    }
  })()
}

async function fetchExchangeRate() {
  const res = await fetch(EXCHANGE_RATE_URL)
  const json = await res.json()
  const rate = json && json.rates && json.rates.THB
  if (typeof rate !== 'number') throw new Error('อ่านอัตราแลกเปลี่ยนไม่ได้')
  return rate
}

async function runJob(jobId, cards, webappTabId) {
  function post(msg) {
    chrome.tabs.sendMessage(webappTabId, { ...msg, jobId }).catch(() => {})
  }

  let rate
  try {
    rate = await fetchExchangeRate()
  } catch (e) {
    post({
      type: 'CPT_DONE',
      successCount: 0,
      failCount: cards.length,
      failures: cards.map((c) => ({ cardId: c.id, error: 'ดึงอัตราแลกเปลี่ยน JPY→THB ไม่สำเร็จ' })),
    })
    return
  }

  let workTab
  try {
    workTab = await chrome.tabs.create({ url: 'about:blank', active: false })
  } catch (e) {
    post({
      type: 'CPT_DONE',
      successCount: 0,
      failCount: cards.length,
      failures: cards.map((c) => ({ cardId: c.id, error: 'เปิดแท็บสำหรับดึงราคาไม่สำเร็จ: ' + String((e && e.message) || e) })),
    })
    return
  }

  let successCount = 0
  const failures = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    post({ type: 'CPT_PROGRESS', total: cards.length, completed: i, currentId: card.id })

    if (!card.url) {
      const error = 'ไม่มีลิงก์ SNKRDUNK'
      failures.push({ cardId: card.id, error })
      post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: false, error })
      continue
    }

    try {
      await chrome.tabs.update(workTab.id, { url: card.url })
      await waitForTabLoad(workTab.id)
      await sleep(PAGE_SETTLE_DELAY_MS)

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: workTab.id },
        func: scrapeCardOnPage,
        args: [card.grade, card.rawCondition, card.itemType, '1個'],
      })
      const result = injectionResults && injectionResults[0] && injectionResults[0].result

      if (!result || !result.ok) {
        const error = (result && result.error) || 'อ่านราคาจากหน้า SNKRDUNK ไม่สำเร็จ'
        failures.push({ cardId: card.id, error })
        post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: false, error })
      } else {
        const postRes = await fetch(UPDATE_PRICE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: card.id, market_price_jpy: result.price_jpy, exchange_rate: rate }),
        })
        const postJson = await postRes.json().catch(() => ({}))
        if (postRes.ok && postJson.success) {
          successCount++
          post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: true, price_jpy: result.price_jpy })
        } else {
          const error = postJson.error || 'บันทึกราคาลงเว็บไม่สำเร็จ'
          failures.push({ cardId: card.id, error })
          post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: false, error })
        }
      }
    } catch (e) {
      const error = String((e && e.message) || e)
      failures.push({ cardId: card.id, error })
      post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: false, error })
    }

    if (i < cards.length - 1) await sleep(BETWEEN_CARDS_DELAY_MS)
  }

  post({ type: 'CPT_PROGRESS', total: cards.length, completed: cards.length })
  post({ type: 'CPT_DONE', successCount, failCount: failures.length, failures })

  await chrome.tabs.remove(workTab.id).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'CPT_START' && sender.tab && sender.tab.id != null) {
    runJob(msg.jobId, msg.cards || [], sender.tab.id)
  }
  return false
})
