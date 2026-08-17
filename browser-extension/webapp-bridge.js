// Runs on the card-price-tracker web app. Bridges window CustomEvents (used
// by the React app) to chrome.runtime messages (used by the background
// service worker that drives the SNKRDUNK scraping job).

document.documentElement.dataset.cptExtension = '1'
window.dispatchEvent(new CustomEvent('cpt:extension-ready'))
console.log('[cpt] extension bridge loaded')

// After the extension itself is reloaded/updated (e.g. from chrome://extensions),
// any content script already sitting on an already-open tab is orphaned: its
// chrome.runtime handle points at a destroyed context. It keeps receiving DOM
// events fine, but any chrome.runtime.* call throws "Extension context
// invalidated." The fix is just reloading the page — this detects that case
// up front and tells the web app to show a clear message instead of a raw
// uncaught error.
window.addEventListener('cpt:update-request', (e) => {
  const detail = e.detail || {}
  console.log('[cpt] update-request', detail)

  if (!chrome.runtime || !chrome.runtime.id) {
    console.error('[cpt] extension context invalidated (needs a page refresh)')
    window.dispatchEvent(new CustomEvent('cpt:extension-stale'))
    return
  }

  try {
    chrome.runtime.sendMessage({ type: 'CPT_START', jobId: detail.jobId, cards: detail.cards || [] }, () => {
      if (chrome.runtime.lastError) {
        console.error('[cpt] sendMessage to background failed:', chrome.runtime.lastError.message)
        window.dispatchEvent(new CustomEvent('cpt:extension-stale'))
      }
    })
  } catch (err) {
    console.error('[cpt] sendMessage threw:', err)
    window.dispatchEvent(new CustomEvent('cpt:extension-stale'))
  }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.jobId) return
  console.log('[cpt] message from background:', msg)
  if (msg.type === 'CPT_PROGRESS') {
    window.dispatchEvent(new CustomEvent('cpt:progress', { detail: msg }))
  } else if (msg.type === 'CPT_CARD_RESULT') {
    window.dispatchEvent(new CustomEvent('cpt:card-result', { detail: msg }))
  } else if (msg.type === 'CPT_DONE') {
    window.dispatchEvent(new CustomEvent('cpt:done', { detail: msg }))
  }
})
