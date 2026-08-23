import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase caps an unpaged select at 1000 rows by default. price_history has
// already passed that (and keeps growing as more cards/price pulls get
// added), so anywhere that needs the *whole* table — the portfolio
// value-over-time chart (app/page.tsx), the weekly digest — has to page
// through it explicitly instead of trusting a single .select() to return
// everything. Pages by `id` (the primary key) rather than fetched_at:
// fetched_at can repeat across cards within the same batch update to
// microsecond-level precision in rare cases, which would risk skipping or
// duplicating rows across pages; `id` is guaranteed unique so paging by it
// is always stable regardless of how the caller wants the results sorted
// afterwards.
export async function fetchAllRows<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await client.from(table).select(columns).order('id', { ascending: true }).range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}
