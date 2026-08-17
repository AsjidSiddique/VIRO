// app/api/influencer-dashboard/route.js
// Forwards a dashboard read to the `secret` Edge Function's public
// influencer_dashboard action, scoped by the email the caller's own
// Google login returned client-side.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({ action: 'influencer_dashboard', email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || 'Failed to load' }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[influencer-dashboard]', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
  }
}
