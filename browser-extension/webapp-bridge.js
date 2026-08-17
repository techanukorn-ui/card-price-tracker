// Runs on the card-price-tracker web app. Bridges window CustomEvents (used
// by the React app) to chrome.runtime messages (used by the background
// service worker that drives the SNKRDUNK scraping job).

document.documentElement.dataset.cptExtension = '1'
window.dispatchEvent(new CustomEvent('cpt:extension-ready'))

window.addEventListener('cpt:update-request', (e) => {
  const detail = e.detail || {}
  chrome.runtime.sendMessage({ type: 'CPT_START', jobId: detail.jobId, cards: detail.cards || [] })
})

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.jobId) return
  if (msg.type === 'CPT_PROGRESS') {
    window.dispatchEvent(new CustomEvent('cpt:progress', { detail: msg }))
  } else if (msg.type === 'CPT_CARD_RESULT') {
    window.dispatchEvent(new CustomEvent('cpt:card-result', { detail: msg }))
  } else if (msg.type === 'CPT_DONE') {
    window.dispatchEvent(new CustomEvent('cpt:done', { detail: msg }))
  }
})
