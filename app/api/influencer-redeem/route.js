// app/api/influencer-redeem/route.js
// Called by checkout right after an order that used Partner Coins is
// successfully created — deducts the spent amount from the partner's
// balance. validate-order already computed and capped the amount
// server-side before the order was placed; this just makes it real.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const { email, amount, order_id } = await request.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'Positive amount required' }, { status: 400 })
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({ action: 'influencer_redeem_balance', email, amount, order_id }),
    })
    const data = await res.json().catch(() => ({}))
    // Never block the order over this — the order already exists at this
    // point. Log server-side if it fails so it can be reconciled manually,
    // but always return ok to the client either way.
    if (!res.ok) console.error('[influencer-redeem] failed:', data?.error)
    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    console.error('[influencer-redeem]', err)
    return NextResponse.json({ ok: true }) // best-effort — never block on this
  }
}
