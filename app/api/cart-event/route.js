// app/api/cart-event/route.js
// ════════════════════════════════════════════════════════════════════════════
// Logs cart events by forwarding to the Supabase `secret` Edge Function, which
// holds the service-role key server-side (in Supabase, not in Vercel env).
//
// WHY THIS CHANGED: this route used to read process.env.SUPABASE_SERVICE_ROLE_KEY
// directly — but that var was never set in Vercel (this project deliberately
// keeps the service key out of Vercel and only inside the Edge Function's own
// secrets, same as admin login). That mismatch made every write here silently
// fail forever. Routing through the Edge Function matches the pattern already
// used by /api/admin/action and /api/admin/verify.
//
// cart_add / cart_remove / cart_merge are public actions on the Edge Function
// (see index.ts PUBLIC_ACTIONS) — no admin token needed, since these are
// ordinary shopper actions scoped to a session_id/customer_id the caller
// already owns.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

async function callEdge(action, payload) {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'apikey':       SUPABASE_ANON || '',
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { session_id, product_id, quantity, customer_id,
      selected_color_id, selected_size_id, selected_color_name, selected_size_name } = body

    if (!session_id || typeof session_id !== 'string' || session_id.length > 200) {
      return NextResponse.json({ ok: false, error: 'invalid session_id' }, { status: 400 })
    }
    if (!product_id || typeof product_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid product_id' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
      return NextResponse.json({ ok: false, error: 'invalid quantity' }, { status: 400 })
    }

    // Detect source server-side from UA, same signal /go and middleware use elsewhere
    const ua = request.headers.get('user-agent') || ''
    const source = /Instagram/i.test(ua) ? 'instagram'
      : /FBAN|FBAV/i.test(ua) ? 'facebook'
      : 'direct'

    const { ok, data } = await callEdge('cart_add', {
      session_id, product_id, quantity: qty, customer_id: customer_id || null, source,
      selected_color_id: selected_color_id || null, selected_size_id: selected_size_id || null,
      selected_color_name: selected_color_name || null, selected_size_name: selected_size_name || null,
    })

    // BUGFIX: this used to unconditionally return {ok:true} here regardless
    // of what the edge function actually reported — even discarding
    // data.ok itself. That meant if cart_add had been silently failing all
    // along, this route would still tell the client "success," and any
    // diagnostic info the edge function returned (including the new
    // _debug write-path/verify-row reporting) was thrown away before it
    // ever reached the browser console. Forward the real result now.
    if (!ok || !data?.ok) console.error('[cart-event POST] edge call failed:', data)
    return NextResponse.json({ ok: !!(ok && data?.ok), _debug: data?._debug, error: data?.error })
  } catch (err) {
    console.error('[cart-event POST]', err)
    return NextResponse.json({ ok: false, error: 'failed' })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { session_id, customer_id } = body
    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid session_id' }, { status: 400 })
    }
    if (!customer_id || typeof customer_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid customer_id' }, { status: 400 })
    }
    await callEdge('cart_merge', { session_id, customer_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cart-event PATCH/merge]', err)
    return NextResponse.json({ ok: false, error: 'failed' })
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json()
    const { session_id, product_id, selected_color_id, selected_size_id } = body
    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid session_id' }, { status: 400 })
    }
    const { ok, data } = await callEdge('cart_remove', {
      session_id, product_id,
      selected_color_id: selected_color_id || null,
      selected_size_id:  selected_size_id  || null,
    })
    if (!ok) return NextResponse.json({ ok: false, error: data?.error || 'failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cart-event DELETE]', err)
    return NextResponse.json({ ok: false, error: 'failed' })
  }
}
