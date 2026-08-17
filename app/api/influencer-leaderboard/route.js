// app/api/influencer-leaderboard/route.js
// Public monthly leaderboard — names + revenue only, no balances or
// contact info. email (optional) also gets that partner's own rank back
// even if they're outside the top 10.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = body?.email && typeof body.email === 'string' ? body.email : undefined

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({ action: 'influencer_leaderboard', email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || 'Failed to load' }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[influencer-leaderboard]', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
  }
}
