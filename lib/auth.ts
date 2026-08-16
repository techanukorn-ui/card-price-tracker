// Edge-compatible session token helpers for the admin password gate.
// The token is a deterministic HMAC of a fixed message keyed by ADMIN_PASSWORD,
// so middleware (edge runtime) can verify it without a session store.

export const SESSION_COOKIE = 'card_admin_session'
const SESSION_MESSAGE = 'card-price-tracker-admin-session'

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bufToHex(sig)
}

export async function createSessionToken(password: string): Promise<string> {
  return hmac(password, SESSION_MESSAGE)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function verifySessionToken(token: string, password: string): Promise<boolean> {
  const expected = await createSessionToken(password)
  return timingSafeEqual(token, expected)
}
