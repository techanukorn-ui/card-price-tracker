import type { Metadata, Viewport } from 'next'
import './globals.css'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_TITLE = 'Card Price Tracker'
const DESCRIPTION = 'ติดตามราคาการ์ดสะสม Pokémon / Sports'

// Without this, Next statically bakes generateMetadata's result in at build
// time, so title/icon changes from the settings modal wouldn't show up until
// the next deploy. Forces it to re-read app_settings on every request instead.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
    const { data } = await supabaseAdmin
        .from('app_settings')
        .select('site_title, site_icon_url, updated_at')
        .eq('id', 1)
        .maybeSingle()

    const title = data?.site_title?.trim() || DEFAULT_TITLE
    const version = data?.updated_at ? new Date(data.updated_at).getTime() : 0

    return {
        title,
        description: DESCRIPTION,
        icons: data?.site_icon_url
            ? { icon: `/api/site-icon?v=${version}`, apple: `/api/site-icon?v=${version}` }
            : undefined,
        appleWebApp: {
            title,
            statusBarStyle: 'default',
        },
    }
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
          <html lang="th">
            <body className="min-h-screen">{children}</body>
          </html>
        )
}
