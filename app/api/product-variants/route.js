// app/api/product-variants/route.js
// Fetches product_colors, product_sizes, product_color_size_stock
// using the service-role key (bypasses RLS) so anon users can see variants.
// Called by ProductDetailClient instead of direct Supabase queries.

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getKey() { return SERVICE_KEY || ANON_KEY }

async function sq(table, params = '') {
  const key = getKey()
  if (!key || !SUPABASE_URL) return []
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('id')
  if (!productId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [colors, sizes, matrix] = await Promise.all([
    sq('product_colors', `?product_id=eq.${encodeURIComponent(productId)}&order=sort_order.asc`),
    sq('product_sizes',  `?product_id=eq.${encodeURIComponent(productId)}&order=sort_order.asc`),
    sq('product_color_size_stock', `?product_id=eq.${encodeURIComponent(productId)}&select=color_id,size_id,stock`),
  ])

  // Build matrix map
  const colorSizeMatrix = {}
  for (const row of matrix) {
    colorSizeMatrix[`${row.color_id}:${row.size_id}`] = row.stock
  }

  return NextResponse.json({ colors, sizes, colorSizeMatrix })
}
