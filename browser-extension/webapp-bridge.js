// Runs on the card-price-tracker web app. Bridges window CustomEvents (used
// by the React app) to chrome.runtime messages (used by the background
// service worker that drives the SNKRDUNK scraping job).

document.documentElement.dataset.cptExtension = '1'
window.dispatchEvent(new CustomEvent('cpt:extension-ready'))
console.log('[cpt] extension bridge loaded')

window.addEventListener('cpt:update-request', (e) => {
  const detail = e.detail || {}
  console.log('[cpt] update-request', detail)
  chrome.runtime.sendMessage({ type: 'CPT_START', jobId: detail.jobId, cards: detail.cards || [] }, () => {
    if (chrome.runtime.lastError) {
      console.error('[cpt] sendMessage to background failed:', chrome.runtime.lastError.message)
    }
  })
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
