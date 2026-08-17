// app/api/push-order/route.js
// PUBLIC endpoint — sends an order confirmation push to the customer.
// Does NOT use adminApi (which needs admin cookie). Instead, calls OneSignal
// REST API directly from the server using ONESIGNAL_REST_KEY env var.
// The REST key never reaches the browser.

import { NextResponse } from 'next/server'

// Rate limit — 5 push requests per minute per IP
const rateMap = new Map()
function isRateLimited(ip) {
  const now = Date.now(), WIN = 60_000, MAX = 5
  const e = rateMap.get(ip)
  if (!e || now > e.r) { rateMap.set(ip, { c: 1, r: now + WIN }); return false }
  if (e.c >= MAX) return true
  e.c++; return false
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const APP_ID   = process.env.ONESIGNAL_APP_ID   || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const REST_KEY = process.env.ONESIGNAL_REST_KEY

  if (!APP_ID || !REST_KEY) {
    // Keys not configured — skip silently (push is non-critical)
    return NextResponse.json({ ok: false, skipped: 'OneSignal not configured' })
  }

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { orderId, name, total, phone } = body
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const shortId = orderId.slice(0, 8).toUpperCase()
  const heading = `Order Confirmed! 🎉`
  const message = `Hi ${name || 'there'}! Your order #${shortId} (Rs. ${total?.toLocaleString() ?? '...'}) is placed. We'll deliver in 2-3 days.`

  try {
    // Target by phone tag — OneSignal must have this tag set when user subscribes.
    // The filter targets users who have tag { phone: <phone number> }.
    const payload = {
      app_id:   APP_ID,
      headings: { en: heading },
      contents: { en: message },
      url:      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://viro.pk'}/orders`,
      chrome_web_icon: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://viro.pk'}/icon-192.png`,
      // If phone tag exists: target that specific user
      // Falls back to "all subscribed users" if no phone tag (still useful for admin)
      ...(phone
        ? {
            filters: [
              { field: 'tag', key: 'phone', relation: '=', value: phone }
            ]
          }
        : { included_segments: ['Subscribed Users'] }
      ),
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Key ${REST_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[push-order] OneSignal error:', data)
      return NextResponse.json({ ok: false, error: data }, { status: 502 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[push-order]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
