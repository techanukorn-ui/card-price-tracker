import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

const PUBLIC_PATHS = new Set(['/login'])
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/update-price', '/api/site-icon', '/api/mobile-queue']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    // No password configured — leave the app open rather than locking everyone out.
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const authed = !!token && (await verifySessionToken(token, password))
  if (authed) return NextResponse.next()

  const isApi = pathname.startsWith('/api/')
  if (isApi) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const isReadOnlyView = req.nextUrl.searchParams.get('readonly') === '1'
  if (isReadOnlyView) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
