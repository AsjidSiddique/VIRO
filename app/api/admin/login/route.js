// app/api/admin/login/route.js
// Sets the httpOnly admin session cookie after successful Edge Function login.
// Rate limited via Upstash Redis (persistent across cold starts).
// Falls back to in-memory map if Upstash env vars are not set.

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const MAX_ATTEMPTS = 10
const WINDOW_SEC   = 60  // 1 minute

// ── Upstash Redis rate limiter (persistent — survives cold starts) ─────────
// Set these env vars in Vercel: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// If not set, falls back to in-memory map (resets on cold start)
async function redisRateLimit(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null  // Signal: use fallback

  const key = `viro_rl_admin:${ip}`
  try {
    // INCR key → increment count, get new value
    const incrRes = await fetch(`${url}/incr/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const incrData = await incrRes.json()
    const count = incrData.result ?? 1

    // On first request, set expiry
    if (count === 1) {
      await fetch(`${url}/expire/${key}/${WINDOW_SEC}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    return count >= MAX_ATTEMPTS
  } catch {
    return null  // Redis error → use fallback
  }
}

// ── Fallback: in-memory rate limiter (resets on cold start) ───────────────
const rateLimitMap = new Map()
function inMemoryRateLimit(ip) {
  const now   = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_SEC * 1000 })
    return false
  }
  if (entry.count >= MAX_ATTEMPTS) return true
  entry.count++
  return false
}

async function isRateLimited(ip) {
  const redisResult = await redisRateLimit(ip)
  if (redisResult !== null) return redisResult  // Redis worked
  return inMemoryRateLimit(ip)                  // Redis unavailable → fallback
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (await isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many requests — try again in a minute' }, { status: 429 })
  }

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string' || token.length < 32) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 })
    }

    const cookieStore = await cookies()
    cookieStore.set('viro_admin_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   8 * 60 * 60,  // 8 hours
      path:     '/',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
