import { useEffect } from 'react'

// iOS "Add to Home Screen" apps run in a standalone WKWebView that iOS
// commonly keeps alive in memory when you switch away — reopening the icon
// just resumes the same already-loaded page instead of a fresh navigation,
// so any data fetched only on mount (like loadData() below) goes stale.
// Re-running the given callback on visibilitychange/focus/pageshow covers
// that resume case (and also regular tab-switching / bfcache restores).
export function useRefetchOnResume(callback: () => void) {
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') callback()
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) callback()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', callback)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', callback)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [callback])
}
