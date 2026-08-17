// app/api/cron/cart-recovery/route.js
// ════════════════════════════════════════════════════════════════════════════
// Called on a schedule by Vercel Cron (see vercel.json) — NOT meant to be
// hit directly by a browser. Triggers the Edge Function's cart_recovery_scan
// action, which finds idle carts and sends a push notification to whoever's
// browser is tagged with that session id (see lib/tagOneSignalSession.js).
//
// Auth: Vercel automatically sends an "Authorization: Bearer $CRON_SECRET"
// header on cron-triggered requests when CRON_SECRET is set as a Vercel env
// var — we verify that here, then forward a SEPARATE secret (also named
// CRON_SECRET, but set in Supabase) to the Edge Function itself. Two
// different systems, both happen to use the same env var name, but they're
// independent secrets living in two different places.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function GET(request) {
  // Verify this request actually came from Vercel Cron, not a random visitor
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON || '',
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ action: 'cart_recovery_scan' }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, edgeResult: data })
  } catch (err) {
    console.error('[cron/cart-recovery]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
