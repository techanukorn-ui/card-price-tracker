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
  }
  )
