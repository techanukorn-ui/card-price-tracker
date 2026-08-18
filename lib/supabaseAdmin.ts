import { createClient } from '@supabase/supabase-js'

// Server-only client. Uses the service role key when available so that
// /api/update-price keeps working even if RLS policies are tightened later.
// Falls back to the anon key so the route still works right after first deploy.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    serviceKey || 'placeholder',
  {
        auth: { persistSession: false },
        // Next.js patches the global fetch on the server to participate in its
        // Data Cache — without opting out here, supabase-js's requests can get
        // cached across requests (observed: generateMetadata in app/layout.tsx
        // serving a site_icon_url/updated_at read that was hours stale, even
        // with `export const dynamic = 'force-dynamic'` on the route). This
        // client is only ever used server-side, so always bypass that cache.
        global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }),
        },
  }
  )
