// app/api/review/route.js
// ════════════════════════════════════════════════════════════════════════════
// Reviews — HYBRID: uses the direct service-role DB path (fast, no separate
// deploy target) when SUPABASE_SERVICE_ROLE_KEY is actually set in this
// environment; otherwise automatically falls back to the "secret" Edge
// Function's review_submit / customer_reviews_get actions.
//
// WHY HYBRID: the direct-DB version needs SUPABASE_SERVICE_ROLE_KEY in
// Vercel's env vars — turned out that wasn't actually set (confirmed by the
// "Server config error: SUPABASE_SERVICE_ROLE_KEY missing" error), so it
// 500'd. The Edge Function version needs a separate `supabase functions
// deploy secret` step, which repeatedly didn't happen across several rounds.
// Rather than bet on either being done, this checks at request time and uses
// whichever is actually available — add the env var later and it
// automatically switches to the faster direct path with no code changes.
//
// TO USE THE FASTER PATH: Vercel dashboard → Project Settings → Environment
// Variables → add SUPABASE_SERVICE_ROLE_KEY (value from Supabase dashboard →
// Project Settings → API → service_role key). One-time, no redeploy-and-hope
// required afterward.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EDGE_FN_URL    = `${SUPABASE_URL}/functions/v1/secret`

// ── Path A: direct DB access with the service-role key ─────────────────────
async function db(method, table, { params = '', body = null, prefer = null } = {}) {
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const headers = {
    'apikey':        KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type':  'application/json',
  }
  if (prefer) headers['Prefer'] = prefer
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* non-JSON error body */ }
  if (!res.ok) throw Object.assign(new Error(data?.message || text || `DB error ${res.status}`), { status: res.status })
  return data
}

async function submitViaDb({ order_id, product_id, rating, comment, customer_id, name }) {
  const orders = await db('GET', 'orders', { params: `?id=eq.${encodeURIComponent(order_id)}&select=id,status,customer_id&limit=1` })
  const order = orders?.[0]
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.status !== 'DELIVERED') throw Object.assign(new Error('Order must be delivered before reviewing'), { status: 403 })

  const items = await db('GET', 'order_items', { params: `?order_id=eq.${encodeURIComponent(order_id)}&product_id=eq.${encodeURIComponent(product_id)}&select=id&limit=1` })
  if (!items?.length) throw Object.assign(new Error('This product was not part of that order'), { status: 403 })

  const settings = await db('GET', 'site_settings', { params: `?key=eq.review_settings&select=value&limit=1` }).catch(() => [])
  const status = settings?.[0]?.value?.auto_approve ? 'approved' : 'pending'

  const finalCustomerId = customer_id || order.customer_id || null

  // Name resolution: trust an explicit client-typed name first, otherwise
  // look up the real name on the linked customer record (customers.name is
  // NOT NULL for every genuine account) before falling back to a generic
  // label — this is what let real customer reviews slip through as
  // "Anonymous" sitewide whenever the client-side name prop came through
  // empty.
  let finalName = name || null
  if (!finalName && finalCustomerId) {
    const custRows = await db('GET', 'customers', { params: `?id=eq.${encodeURIComponent(finalCustomerId)}&select=name&limit=1` }).catch(() => [])
    const custName = custRows?.[0]?.name
    if (custName && custName.trim()) finalName = custName.trim()
  }
  if (!finalName) finalName = 'Verified Customer'

  await db('POST', 'reviews', {
    params: '?on_conflict=order_id,product_id',
    body: { order_id, product_id, customer_id: finalCustomerId, name: finalName, rating, comment: comment || null, status, updated_at: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates',
  })
  return { ok: true, status }
}

async function getReviewsViaDb(order_ids) {
  const idsParam = order_ids.slice(0, 200).map(id => `"${id}"`).join(',')
  const reviews = await db('GET', 'reviews', { params: `?order_id=in.(${idsParam})&select=order_id,product_id,rating,comment,status,created_at` })
  return { ok: true, reviews: reviews || [] }
}

// ── Path B: Edge Function fallback ──────────────────────────────────────────
async function callEdge(action, payload) {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON || '' },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.ok) throw Object.assign(new Error(data?.error || 'edge function failed'), { status: res.status || 500 })
  return data
}

function hasServiceRole() { return !!process.env.SUPABASE_SERVICE_ROLE_KEY }

export async function POST(request) {
  try {
    const body = await request.json()
    const { order_id, product_id, rating, comment, customer_id, name } = body

    if (!order_id || typeof order_id !== 'string') return NextResponse.json({ ok: false, error: 'invalid order_id' }, { status: 400 })
    if (!product_id || typeof product_id !== 'string') return NextResponse.json({ ok: false, error: 'invalid product_id' }, { status: 400 })
    const r = Number(rating)
    if (!Number.isFinite(r) || r < 1 || r > 5) return NextResponse.json({ ok: false, error: 'invalid rating' }, { status: 400 })

    const result = hasServiceRole()
      ? await submitViaDb({ order_id, product_id, rating: r, comment, customer_id, name })
      : await callEdge('review_submit', { order_id, product_id, rating: r, comment: comment || null, customer_id: customer_id || null, name: name || null })

    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    console.error('[review POST]', hasServiceRole() ? 'via DB' : 'via edge fn', '-', err.message)
    return NextResponse.json({ ok: false, error: err.message || 'failed' }, { status: err.status || 500 })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const order_ids = Array.isArray(body.order_ids) ? body.order_ids.filter(Boolean) : []
    if (!order_ids.length) return NextResponse.json({ ok: true, reviews: [] })

    const result = hasServiceRole()
      ? await getReviewsViaDb(order_ids)
      : await callEdge('customer_reviews_get', { order_ids })

    return NextResponse.json({ ok: true, reviews: result.reviews || [] })
  } catch (err) {
    console.error('[review PATCH]', hasServiceRole() ? 'via DB' : 'via edge fn', '-', err.message)
    return NextResponse.json({ ok: false, error: err.message || 'failed', reviews: [] }, { status: err.status || 500 })
  }
}
