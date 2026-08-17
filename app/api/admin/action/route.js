// app/api/admin/action/route.js
// Secure proxy: reads httpOnly cookie server-side, forwards to Supabase Edge Function.
// Includes CSRF protection via Origin/Host header validation.

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

// Allowed origins — same-origin only. No cross-site requests accepted.
const ALLOWED_ORIGINS = [
  'https://viro.pk',
  'https://www.viro.pk',
  'http://localhost:3000',
  'http://localhost:5173',
]

export async function POST(request) {
  // ── CSRF: validate Origin header ───────────────────────────────────────────
  // sameSite:'strict' cookie blocks cross-site requests in modern browsers,
  // but explicit Origin validation is the defence-in-depth layer.
  const origin = request.headers.get('origin') || ''
  const host   = request.headers.get('host')   || ''
  const isSameOrigin = ALLOWED_ORIGINS.includes(origin) ||
    origin === '' || // Server-to-server or same-origin requests omit Origin
    host.includes('localhost')

  if (!isSameOrigin) {
    console.warn('[action] CSRF blocked — Origin:', origin, 'Host:', host)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Read the httpOnly cookie — JS on the page cannot access this
    const cookieStore = await cookies()
    const adminToken  = cookieStore.get('viro_admin_token')?.value

    if (!adminToken || adminToken.length < 32) {
      return NextResponse.json(
        { error: 'Not authenticated — please log in again' },
        { status: 401 }
      )
    }

    let body
    try { body = await request.json() }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

    // Forward to Supabase Edge Function
    const edgeRes = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(body),
    })

    const contentType = edgeRes.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await edgeRes.json()
      if (edgeRes.status === 401) {
        const res = NextResponse.json(data, { status: 401 })
        res.cookies.delete('viro_admin_token')
        return res
      }
      return NextResponse.json(data, { status: edgeRes.status })
    }

    const text = await edgeRes.text()
    return NextResponse.json(
      { error: `Edge function error: ${text.slice(0, 200)}` },
      { status: edgeRes.status }
    )
  } catch (err) {
    console.error('[/api/admin/action]', err)
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 })
  }
}
