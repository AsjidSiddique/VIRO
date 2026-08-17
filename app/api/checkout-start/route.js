// app/api/checkout-start/route.js
// Logs "reached checkout" — a stronger purchase-intent signal than add-to-cart
// alone. Forwards to the `secret` Edge Function's public checkout_start action.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const body = await request.json()
    const { session_id, customer_id } = body
    if (!session_id || typeof session_id !== 'string' || session_id.length > 200) {
      return NextResponse.json({ ok: false, error: 'invalid session_id' }, { status: 400 })
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({ action: 'checkout_start', session_id, customer_id: customer_id || null }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[checkout-start]', data)
      // Still return ok:true to the browser — this is analytics-only and must
      // never block or slow down checkout — but the real error is logged here
      // server-side (Vercel function logs) for debugging deployment gaps.
      return NextResponse.json({ ok: true, _debug: data?.error || 'edge function error' })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[checkout-start]', err)
    return NextResponse.json({ ok: false })
  }
}
