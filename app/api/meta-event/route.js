import { NextResponse } from 'next/server'
import crypto from 'crypto'

const PIXEL_ID     = process.env.META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const API_VERSION  = 'v19.0'
const CAPI_URL     = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`
const IS_TEST      = process.env.META_TEST_EVENT_CODE

function hash(value) {
  if (!value) return undefined
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex')
}

// Pakistani checkout forms accept phone numbers two ways — "03XXXXXXXXX"
// (11 digits, no country code) or "92XXXXXXXXXX" (12 digits, with country
// code) — both pass the form's own validation. Meta's matching expects a
// consistent international format (E.164-style, digits only, country code
// included, no leading +) before hashing. Without this normalization, the
// far more common "03..." input format was being hashed AS-IS, missing the
// country code entirely — a confirmed mismatch against what Meta expects,
// degrading phone-based matching for the majority of orders.
function normalizePkPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^\d]/g, '') // strip spaces, dashes, parens, +
  if (digits.startsWith('92') && digits.length === 12) return digits
  if (digits.startsWith('0')  && digits.length === 11) return '92' + digits.slice(1)
  if (digits.length === 10) return '92' + digits // handles a bare "3XXXXXXXXX" with no leading 0
  return digits || null // fall back to whatever we got rather than dropping the field entirely
}

function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null
}

export async function POST(request) {
  try {
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      // This is almost certainly why Purchase EMQ could show 0 despite the
      // client sending correct email/phone/name data — if these env vars
      // are missing in production, EVERY event silently no-ops here and
      // nothing ever reaches Meta, with no visible error anywhere else in
      // the app (the client's .catch() never fires since this returns 200).
      console.error('[Meta CAPI] MISCONFIGURED — missing env var(s):',
        !PIXEL_ID ? 'META_PIXEL_ID ' : '', !ACCESS_TOKEN ? 'META_ACCESS_TOKEN' : '')
      return NextResponse.json({ error: 'Meta CAPI not configured' }, { status: 200 })
    }

    const body = await request.json()
    console.log("[CAPI API] Received event:", body.event_name, "value:", body.custom_data?.value, "currency:", body.custom_data?.currency)
    const {
      event_name,
      event_id,
      event_source_url,
      custom_data,
      user_data_raw,
      action_source = 'website',
    } = body

    const now = Math.floor(Date.now() / 1000)
    const ip  = getClientIp(request)
    const ua  = request.headers.get('user-agent') || ''

    const user_data = {
      client_ip_address: ip || undefined,
      client_user_agent: ua || undefined,
      em:  user_data_raw?.email      ? [hash(user_data_raw.email.toLowerCase().trim())] : undefined,
      ph:  user_data_raw?.phone      ? [hash(normalizePkPhone(user_data_raw.phone))] : undefined,
      fn:  user_data_raw?.first_name ? [hash(user_data_raw.first_name)] : undefined,
      ln:  user_data_raw?.last_name  ? [hash(user_data_raw.last_name)]  : undefined,
      ct:  user_data_raw?.city       ? [hash(user_data_raw.city)]       : undefined,
      country: [hash('pk')],
      fbc: user_data_raw?.fbc || undefined,
      fbp: user_data_raw?.fbp || undefined,
      external_id: user_data_raw?.user_id ? [hash(user_data_raw.user_id)] : undefined,
    }
    Object.keys(user_data).forEach(k => user_data[k] === undefined && delete user_data[k])

    const event = {
      event_name,
      event_time:       now,
      event_id:         event_id || `${event_name}_${now}`,
      event_source_url: event_source_url || 'https://www.viro.pk',
      action_source,
      user_data,
      ...(custom_data ? { custom_data } : {}),
    }

    const payload = {
      data: [event],
      ...(IS_TEST ? { test_event_code: IS_TEST } : {}),
    }

    const res = await fetch(`${CAPI_URL}?access_token=${ACCESS_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const result = await res.json()
    if (!res.ok) {
      console.error('[Meta CAPI] Error:', result)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Meta CAPI] Exception:', err.message)
    return NextResponse.json({ error: err.message }, { status: 200 })
  }
}
