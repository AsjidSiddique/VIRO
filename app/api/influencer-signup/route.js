// app/api/influencer-signup/route.js
// Forwards a new influencer request to the `secret` Edge Function's public
// influencer_signup_request action. Same proxy pattern as checkout-start —
// keeps the Supabase service-role call server-side, browser never talks to
// the Edge Function directly.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const body = await request.json()
    const { email, name, phone, platform, handle, followers } = body || {}

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim() || name.length > 200) {
      return NextResponse.json({ ok: false, error: 'Name required' }, { status: 400 })
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({
        action: 'influencer_signup_request',
        email, name,
        phone:     phone     ? String(phone).slice(0, 40)   : null,
        platform:  platform  ? String(platform).slice(0, 40) : null,
        handle:    handle    ? String(handle).slice(0, 80)   : null,
        followers: followers ? String(followers).slice(0, 40): null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || 'Request failed' }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[influencer-signup]', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
  }
}
