import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Card Price Tracker',
    description: 'ติดตามราคาการ์ดสะสม Pokémon / Sports',
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
