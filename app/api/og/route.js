// app/api/og/route.js
// OG image generator — dual-mode output for WhatsApp:
//
// ?id=<uuid>          → 1080×1920 PORTRAIT  (9:16) — fills WhatsApp Status full-screen
// ?id=<uuid>&m=card   → 1080×1080 SQUARE    (1:1)  — WhatsApp chat link preview card
//
// WHY PORTRAIT for Status:
//   WhatsApp Status renders portrait images (9:16) full-screen edge-to-edge.
//   Landscape/square images leave empty space top+bottom.
//   1080×1920 = phone screen resolution → maximum visual impact.
//
// HOW IT WORKS:
//   1. Fetch product image from Supabase
//   2. Sample edge color of the image (avg of border pixels)
//   3. Fill canvas with that color so padding looks like natural extension
//   4. Paste product image centred — no harsh borders
//   5. Return JPEG bytes directly (no redirects)
//
// og:image in meta tags points to default (portrait) URL.
// WhatsApp Status = share the /product/ URL → Status preview = full-screen portrait.

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Portrait canvas (WhatsApp Status full-screen)
const PORTRAIT_W = 1080
const PORTRAIT_H = 1920

// Square canvas (WhatsApp chat card — still large enough for "large card" rendering)
const SQUARE_W = 1080
const SQUARE_H = 1080

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseFirstImage(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.find(u => typeof u === 'string' && u.startsWith('http')) ?? null
  if (typeof raw === 'string') {
    if (raw.startsWith('http')) return raw
    try {
      const a = JSON.parse(raw)
      if (Array.isArray(a)) return a.find(u => typeof u === 'string' && u.startsWith('http')) ?? null
    } catch {}
  }
  return null
}

// Sample the average color of the image edges for seamless background fill
async function sampleEdgeColor(sharp, imgBuf) {
  try {
    const S = 80
    const { data } = await sharp(imgBuf)
      .resize(S, S, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const px = []
    for (let x = 0; x < S; x++) {
      const ti = (0       * S + x) * 3;  px.push([data[ti],   data[ti+1],   data[ti+2]])
      const bi = ((S-1)   * S + x) * 3;  px.push([data[bi],   data[bi+1],   data[bi+2]])
    }
    for (let y = 1; y < S - 1; y++) {
      const li = (y * S + 0    ) * 3;    px.push([data[li],   data[li+1],   data[li+2]])
      const ri = (y * S + (S-1)) * 3;    px.push([data[ri],   data[ri+1],   data[ri+2]])
    }
    const sum = px.reduce((a,[r,g,b]) => [a[0]+r, a[1]+g, a[2]+b], [0,0,0])
    return {
      r: Math.min(255, Math.max(0, Math.round(sum[0]/px.length))),
      g: Math.min(255, Math.max(0, Math.round(sum[1]/px.length))),
      b: Math.min(255, Math.max(0, Math.round(sum[2]/px.length))),
    }
  } catch {
    return { r: 248, g: 248, b: 248 }
  }
}

async function buildImage(sharp, imgBuf, canvasW, canvasH) {
  // Get natural dimensions
  const meta = await sharp(imgBuf).metadata()
  const natW = meta.width  || 800
  const natH = meta.height || 800

  // Scale product image to fill the canvas WIDTH fully (no side bars)
  // Height is then natH * (canvasW / natW) — may be shorter than canvas
  const scaledW = canvasW
  const scaledH = Math.round(natH * (canvasW / natW))

  // If scaled image is TALLER than canvas, crop to canvas height centred
  // If shorter, pad top+bottom with edge color
  const resizedBuf = await sharp(imgBuf)
    .resize(scaledW, Math.min(scaledH, canvasH * 2), {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .removeAlpha()
    .jpeg({ quality: 94 })
    .toBuffer()

  const rMeta  = await sharp(resizedBuf).metadata()
  const rW     = rMeta.width  || scaledW
  const rH     = rMeta.height || scaledH

  // Sample edge color from the resized product image
  const edgeColor = await sampleEdgeColor(sharp, resizedBuf)

  // Build background canvas filled with edge color
  const bgBuf = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: edgeColor }
  }).jpeg({ quality: 94 }).toBuffer()

  // Centre the product image on the canvas
  const left = Math.max(0, Math.round((canvasW - rW) / 2))
  const top  = Math.max(0, Math.round((canvasH - rH) / 2))

  // Clamp to canvas bounds (sharp will error if composite goes out of bounds)
  const safeLeft = Math.min(left, canvasW - 1)
  const safeTop  = Math.min(top,  canvasH - 1)

  return sharp(bgBuf)
    .composite([{ input: resizedBuf, left: safeLeft, top: safeTop }])
    .jpeg({ quality: 90, mozjpeg: false })
    .toBuffer()
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id   = searchParams.get('id')
  const mode = searchParams.get('m')   // 'card' = square, default = portrait

  const FALLBACK = 'https://viro.pk/og-image.jpg'
  const hdrs = {
    'Content-Type':  'image/jpeg',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    'Access-Control-Allow-Origin': '*',
  }

  if (!id) return NextResponse.redirect(FALLBACK)

  let sharp
  try { sharp = (await import('sharp')).default }
  catch { return NextResponse.redirect(FALLBACK) }

  try {
    // ── 1. Fetch product from DB ─────────────────────────────────────────
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=images&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }, cache: 'no-store' }
    )
    if (!dbRes.ok) return NextResponse.redirect(FALLBACK)
    const rows = await dbRes.json()
    const imgUrl = parseFirstImage(rows?.[0]?.images)
    if (!imgUrl) return NextResponse.redirect(FALLBACK)

    // ── 2. Fetch product image bytes ─────────────────────────────────────
    const imgFetch = await fetch(imgUrl, { cache: 'no-store' })
    if (!imgFetch.ok) return NextResponse.redirect(FALLBACK)
    const imgBuf = Buffer.from(await imgFetch.arrayBuffer())

    // ── 3. Choose canvas size ────────────────────────────────────────────
    // Default = portrait 1080×1920 → fills WhatsApp Status full-screen
    // ?m=card  = square  1080×1080 → large card in WhatsApp chat
    const [cW, cH] = mode === 'card'
      ? [SQUARE_W,   SQUARE_H]
      : [PORTRAIT_W, PORTRAIT_H]

    // ── 4. Build composite image ─────────────────────────────────────────
    const output = await buildImage(sharp, imgBuf, cW, cH)
    return new NextResponse(output, { headers: hdrs })

  } catch (err) {
    console.error('[og] error:', err?.message)
    // Try to serve fallback bytes (no redirect — crawlers don't follow them)
    try {
      const fb = await fetch(FALLBACK, { cache: 'no-store' })
      if (fb.ok) return new NextResponse(Buffer.from(await fb.arrayBuffer()), { headers: hdrs })
    } catch {}
    return NextResponse.redirect(FALLBACK)
  }
}
