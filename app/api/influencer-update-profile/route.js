// app/api/influencer-update-profile/route.js
// Lets a logged-in partner update their own contact/social info.
// Deliberately narrow — server-side action only reads name/phone/
// platform/handle/followers, never status/commission/coupon/balance.
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

export async function POST(request) {
  try {
    const { email, name, phone, platform, handle, followers } = await request.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
    }

    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
      body: JSON.stringify({
        action: 'influencer_update_profile', email,
        name:      name      ? String(name).slice(0, 200)  : undefined,
        phone:     phone !== undefined     ? (phone     ? String(phone).slice(0, 40)     : null) : undefined,
        platform:  platform !== undefined  ? (platform  ? String(platform).slice(0, 40)  : null) : undefined,
        handle:    handle !== undefined    ? (handle    ? String(handle).slice(0, 80)    : null) : undefined,
        followers: followers !== undefined ? (followers ? String(followers).slice(0, 40) : null) : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ ok: false, error: data?.error || 'Update failed' }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[influencer-update-profile]', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
  }
}
