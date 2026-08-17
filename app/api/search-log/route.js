// app/api/search-log/route.js
// ════════════════════════════════════════════════════════════════════════════
// Logs a customer's search term (called after a debounced pause in typing,
// see ShopClient.jsx) by forwarding to the Supabase `secret` Edge Function —
// same pattern as /api/cart-event. Analytics-only: never blocks or errors
// out to the shopper if this fails.
//
// Named "search-log" rather than "search-track" on purpose — ad blockers and
// privacy extensions commonly filter any request URL containing "track",
// which would silently drop this call client-side with a "Failed to fetch"
// style error, with no server-side trace at all. Renaming avoids that class
// of false negative entirely.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const body = await request.json()
    const term = (body?.term || '').toString().trim()
    const resultCount = Number(body?.result_count) || 0

    if (!term || term.length < 2 || term.length > 100) {
      return NextResponse.json({ ok: true }) // silently ignore, not worth an error
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON || '' },
      body: JSON.stringify({ action: 'search_track', term, result_count: resultCount }),
    })
    if (!res.ok) console.error('[search-track] edge call failed:', await res.text().catch(() => ''))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[search-track POST]', err)
    return NextResponse.json({ ok: true }) // analytics-only, never surface as an error
  }
}
