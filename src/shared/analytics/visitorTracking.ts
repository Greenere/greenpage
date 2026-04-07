const VISITOR_ANALYTICS_ENDPOINT = 'https://visitor-analysis.haoyanghowyoung.workers.dev/collect'
const VISITOR_SESSION_STORAGE_KEY = 'greenpage_visitor_session_id'

export type VisitorAnalyticsEventType = 'entry' | 'page_view'

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getSessionId() {
  if (typeof window === 'undefined') return null

  try {
    const existingSessionId = window.sessionStorage.getItem(VISITOR_SESSION_STORAGE_KEY)
    if (existingSessionId) return existingSessionId

    const nextSessionId = createSessionId()
    window.sessionStorage.setItem(VISITOR_SESSION_STORAGE_KEY, nextSessionId)
    return nextSessionId
  } catch {
    return null
  }
}

export function trackVisitorEvent(eventType: VisitorAnalyticsEventType) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const payload = {
    event_type: eventType,
    event_at: new Date().toISOString(),
    session_id: getSessionId(),
    page_url: window.location.href,
    page_path: window.location.pathname,
    page_search: window.location.search || null,
    page_hash: window.location.hash || null,
    referrer: document.referrer || null,
    title: document.title || null,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  }

  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(VISITOR_ANALYTICS_ENDPOINT, blob)
    return
  }

  fetch(VISITOR_ANALYTICS_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }).catch(() => {
    // Ignore analytics send failures so page rendering stays unaffected.
  })
}
