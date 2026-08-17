// app/api/admin-cart/route.js
// Cart analytics for the admin dashboard — forwards to the `secret` Edge
// Function's admin_cart_get action, which IS token-gated (unlike cart_add/
// cart_remove/customer_cart_get). Reads the httpOnly admin cookie server-side,
// same pattern as /api/admin/action and /api/admin/verify.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// BUGFIX: using cookies() makes THIS ROUTE dynamic (can't be statically
// cached as a whole) — but that's a SEPARATE mechanism from Next's fetch-
// level Data Cache, which caches individual fetch() calls independently
// and is NOT automatically disabled just because the surrounding route is
// dynamic. Without `cache: 'no-store'` on the fetch below, this could
// still silently serve a stale cached response from the edge function
// regardless of what's actually changed in the database since — this is
// very likely why admin cart data appeared stuck/stale in earlier testing.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const adminToken  = cookieStore.get('viro_admin_token')?.value

    if (!adminToken || adminToken.length < 32) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated', cartCounts: [], cartDetail: [] },
        { status: 401 }
      )
    }

    // Optional date range — ?since=...&until=... (ISO). Omitted = all time.
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') || null
    const until = searchParams.get('until') || null

    const edgeRes = await fetch(EDGE_FN_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON || '',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ action: 'admin_cart_get', since, until }),
    })

    const data = await edgeRes.json().catch(() => ({}))
    if (!edgeRes.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || 'edge function error', cartCounts: [], cartDetail: [] },
        { status: edgeRes.status, headers: { 'Cache-Control': 'no-store, must-revalidate' } }
      )
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
  } catch (err) {
    console.error('[admin-cart GET]', err)
    return NextResponse.json({ ok: false, error: err.message, cartCounts: [], cartDetail: [] }, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
  }
}
