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
    // No callback here on purpose: background.js's listener never calls
    // sendResponse (it's fire-and-forget - real progress/results come back
    // separately via chrome.tabs.sendMessage), so passing a callback would
    // make Chrome set lastError to "message port closed before a response
    // was received" on every single call, which is harmless noise, not a
    // real failure. Only a synchronous throw here means the context is
    // actually invalidated.
    chrome.runtime.sendMessage({ type: 'CPT_START', jobId: detail.jobId, cards: detail.cards || [] })
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
