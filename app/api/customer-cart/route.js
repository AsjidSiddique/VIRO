// app/api/customer-cart/route.js
// Loads a logged-in customer's saved cart via the `secret` Edge Function
// (customer_cart_get is a public action — see supabase/functions/secret/index.ts).
// This enables cross-device cart sync without needing a service-role key in Vercel.
import { NextResponse } from 'next/server'

// BUGFIX: this route had neither `cache: 'no-store'` on its outbound fetch
// nor `dynamic = 'force-dynamic'` on itself. Next.js App Router caches
// server-side fetch() calls by default, and can cache an entire route's
// response too, when nothing tells it not to — meaning this endpoint could
// keep serving a stale, cached "items: []" response from an early request
// forever, regardless of what actually changes in the database afterward.
// This is the exact symptom reported: a write confirms ok, but the very
// next read on the same customer_id comes back empty. Forcing this route
// fully dynamic and disabling fetch caching eliminates that entirely.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    if (!customerId) {
      return NextResponse.json({ ok: false, error: 'customer_id required' }, { status: 400 })
    }

    const edgeRes = await fetch(EDGE_FN_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'apikey':       SUPABASE_ANON || '',
      },
      body: JSON.stringify({ action: 'customer_cart_get', customer_id: customerId }),
    })
    const data = await edgeRes.json().catch(() => ({}))
    if (!edgeRes.ok) {
      return NextResponse.json({ ok: false, error: data?.error || 'failed', items: [] }, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
    }
    return NextResponse.json({ ok: true, items: data.items || [], _debug: data._debug }, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
  } catch (err) {
    console.error('[customer-cart GET]', err.message)
    return NextResponse.json({ ok: false, error: err.message, items: [] }, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
  }
}
