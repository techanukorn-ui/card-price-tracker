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
const SUPABASE_URL = 'https://zrlfdmxplfztomaodozd.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybGZkbXhwbGZ6dG9tYW9kb3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDk1MDQsImV4cCI6MjEwMjM4NTUwNH0.wAJ7N2R3JhKxdcQ_hnoInae-vVQXRGJ6ALNk0jK2VbI'
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
function scrapeCardOnPage(grade, rawCondition, itemType, sealedBoxLabel, sealedBoxItemType, hasImage) {
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

  // SNKRDUNK renders TWO different button sets with overlapping labels: a
  // price grid near the top (one chip per grade/condition, its own label
  // text followed by either a price like "¥2,290,000~" or "出品待ち" when
  // nothing is listed) and a separate plain-text filter row further down
  // (just "PSA10" etc, used to filter the 売買履歴 sold-history table —
  // that's what findButton() above matches). Conflating the two was the
  // original bug: reading price off the plain filter button always
  // returned null. This matches the price-grid chip specifically.
  //
  // Sealed-box quantity chips additionally insert a "(99+)"-style listing
  // count between the label and the price, e.g. "1個(99+)¥17,500~" — card
  // grade chips don't have this ("PSA10¥820,000~"). The optional group
  // below accounts for both.
  function findPriceGridButton(label) {
    const re = new RegExp('^' + escapeRegex(label) + '(\\([^)]*\\))?(¥|出品待ち)')
    return Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent.trim())) || null
  }

  // The card's own product photo on SNKRDUNK — CDN URL pattern
  // https://cdn.snkrdunk.com/upload_bg_removed/....webp?size=l. There's
  // normally exactly one such image on the page; it's distinct from the
  // og:image meta tag and the size=m thumbnails in the "related cards" zone.
  function findMainImage() {
    const img = Array.from(document.querySelectorAll('img')).find((el) => (el.src || '').includes('size=l'))
    return img ? img.src : null
  }

  function readListingPriceFromButton(btn) {
    if (!btn) return null
    const m = (btn.textContent || '').match(/¥\s?([\d,]+)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
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
   try {
    // Wait for the sold-history table itself to exist before doing anything else.
    const tableReady = await pollUntil(() => readRows().length > 0, 8000)
    if (!tableReady) {
      return { ok: false, error: 'โหลดตารางประวัติการขายบนหน้า SNKRDUNK ไม่ทัน (อาจช้ากว่าปกติ)' }
    }

    const isSealed = itemType === sealedBoxItemType
    let targetVariant
    let variantBtn

    if (isSealed) {
      targetVariant = sealedBoxLabel
      variantBtn = findButton(targetVariant)
      if (variantBtn) variantBtn.click() // best-effort; box pages don't always need it
    } else {
      targetVariant = grade === 'Raw' ? rawCondition : grade
      if (!targetVariant) {
        return { ok: false, error: 'การ์ดใบนี้ไม่มีเกรด/สภาพ (raw_condition) ให้กรอง' }
      }
      variantBtn = await pollUntil(() => findButton(targetVariant), 5000)
      if (!variantBtn) {
        return { ok: false, error: `ไม่พบปุ่มกรองเกรด "${targetVariant}" บนหน้า SNKRDUNK` }
      }
      variantBtn.click()
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

    const image_url = hasImage ? null : findMainImage()
    const lowest_listing_price_jpy = readListingPriceFromButton(findPriceGridButton(targetVariant))

    return {
      ok: true,
      price_jpy: Math.round(avg * 100) / 100,
      sampleCount: used.length,
      usedFallback: withinWeek.length === 0,
      image_url,
      lowest_listing_price_jpy,
    }
   } catch (e) {
     return { ok: false, error: 'สคริปต์อ่านหน้า SNKRDUNK พัง: ' + String((e && e.message) || e) }
   }
  })()
}

// Reads the user's fixed JPY→THB rate from the app_settings table (set via
// the "เรทค่าเงิน" button on the web app) instead of a live FX lookup — so
// THB numbers only move when a card's actual JPY price moves, not on every
// FX wobble. See lib/appSettings.ts on the web app side for the rationale.
async function fetchExchangeRate() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=jpy_thb_rate&id=eq.1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const json = await res.json()
  const rate = json && json[0] && json[0].jpy_thb_rate
  if (typeof rate !== 'number') throw new Error('ยังไม่ได้ตั้งเรทค่าเงิน — ตั้งค่าที่ปุ่ม "เรทค่าเงิน" บนเว็บก่อน')
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
        args: [card.grade, card.rawCondition, card.itemType, '1個', SEALED_BOX_ITEM_TYPE, !!card.hasImage],
      })
      const injection = injectionResults && injectionResults[0]
      const result = injection && injection.result

      if (!result || !result.ok) {
        const error =
          (result && result.error) ||
          (injection && injection.error && 'Chrome ฉีดสคริปต์ไม่สำเร็จ: ' + String(injection.error)) ||
          'อ่านราคาจากหน้า SNKRDUNK ไม่สำเร็จ (ไม่มีรายละเอียดเพิ่มเติม)'
        failures.push({ cardId: card.id, error })
        post({ type: 'CPT_CARD_RESULT', cardId: card.id, ok: false, error })
      } else {
        const postRes = await fetch(UPDATE_PRICE_URL, {
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
