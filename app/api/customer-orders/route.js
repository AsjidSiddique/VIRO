// app/api/customer-orders/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Fetches orders for a customer by phone number using the service role key.
// The customers + orders tables have RLS restricting anon access, so this
// server route bypasses RLS by using SUPABASE_SERVICE_ROLE_KEY.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

function svcFetch(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(opts.headers || {}),
    },
  })
}

export async function POST(req) {
  try {
    const { action, phone, orderId } = await req.json()

    if (action === 'fetch') {
      if (!phone) return NextResponse.json({ orders: [] })

      const raw = phone.trim()
      const alt = raw.startsWith('0') ? '92' + raw.slice(1) : '0' + raw.slice(2)

      // Find customer IDs for both phone formats
      const [r1, r2] = await Promise.all([
        svcFetch(`customers?select=id&phone=eq.${encodeURIComponent(raw)}`).then(r => r.json()),
        svcFetch(`customers?select=id&phone=eq.${encodeURIComponent(alt)}`).then(r => r.json()),
      ])

      const customers = [...(Array.isArray(r1) ? r1 : []), ...(Array.isArray(r2) ? r2 : [])]
      if (!customers.length) return NextResponse.json({ orders: [] })

      const ids = [...new Set(customers.map(c => c.id))]
      const inFilter = ids.map(id => `customer_id=eq.${id}`).join(',')

      // Fetch orders with nested relations
      const selectCols = [
        '*',
        'customers(id,name,phone,city,address)',
        'order_items(quantity,price,original_price,products(id,name,images,avg_rating,review_count))',
        'coupon_code,coupon_discount,sale_discount,original_subtotal,discount_type',
      ].join(',').replace(/\s+/g, '')

      const ordersRes = await svcFetch(
        `orders?select=${encodeURIComponent(selectCols)}&or=(${ids.map(id => `customer_id.eq.${id}`).join(',')})&order=created_at.desc`
      )
      const orders = await ordersRes.json()

      return NextResponse.json({ orders: Array.isArray(orders) ? orders : [] })
    }

    if (action === 'cancel') {
      if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

      const res = await svcFetch(
        `orders?id=eq.${orderId}&status=in.(UNPAID,CONFIRMED)`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'CANCELLED' }),
        }
      )
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: err }, { status: res.status })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('customer-orders error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
