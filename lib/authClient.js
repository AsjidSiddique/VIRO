// ── Google Auth Client ────────────────────────────────────────────────────────
// Uses Supabase's native Google OAuth. No @supabase/supabase-js needed —
// we call the REST endpoints directly.
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// ── localStorage keys ─────────────────────────────────────────────────────────
export const AUTH_KEY      = 'viro_auth_user'    // { email, name, avatar, access_token }
export const PROFILE_KEY   = 'viro_auth_profile' // { customer_id, gender, dob }

// ── Get current auth user from localStorage ───────────────────────────────────
export function getAuthUser() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') } catch { return null }
}

export function setAuthUser(user) {
  if (typeof window === 'undefined') return
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  else localStorage.removeItem(AUTH_KEY)
}

export function getAuthProfile() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') } catch { return null }
}
export function setAuthProfile(p) {
  if (typeof window === 'undefined') return
  if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  else localStorage.removeItem(PROFILE_KEY)
}


// ── Exchange code for session (called from /auth/callback) ────────────────────
export async function exchangeCodeForSession(code) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ auth_code: code }),
  })
  if (!res.ok) {
    // Try alternative exchange method
    const res2 = await fetch(`${SUPA_URL}/auth/v1/callback?code=${encodeURIComponent(code)}`, {
      headers: { 'apikey': SUPA_KEY },
    })
    if (!res2.ok) return null
    return null
  }
  const data = await res.json()
  return data
}

// ── Get user from access_token ────────────────────────────────────────────────
export async function getUserFromToken(access_token) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${access_token}`,
    }
  })
  if (!res.ok) return null
  return await res.json()
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut() {
  const user = getAuthUser()
  if (user?.access_token) {
    try {
      await fetch(`${SUPA_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${user.access_token}` }
      })
    } catch {}
  }
  // Clear all Supabase auth tokens from localStorage so Google shows account picker on next login
  if (typeof window !== 'undefined') {
    Object.keys(localStorage).forEach(k => {
      if (k.includes('supabase') || k.includes('auth-token') || k.includes('sb-')) {
        localStorage.removeItem(k)
      }
    })
    // Clear session storage too
    Object.keys(sessionStorage).forEach(k => {
      if (k.includes('supabase') || k.includes('auth')) sessionStorage.removeItem(k)
    })
  }
  setAuthUser(null)
  setAuthProfile(null)
}

// ── Sign in — always show account picker (prompt=select_account) ─────────────
export function signInWithGoogle(redirectTo = '/auth/callback') {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const callbackUrl = encodeURIComponent(`${base}${redirectTo}`)
  // prompt=select_account forces Google to show account chooser every time
  const url = `${SUPA_URL}/auth/v1/authorize?provider=google&redirect_to=${callbackUrl}&prompt=select_account`
  window.location.href = url
}

// ── Call Supabase RPC with auth token ─────────────────────────────────────────
export async function rpcWithAuth(fn, args, accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${accessToken || SUPA_KEY}`,
  }
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`RPC ${fn} failed: ${err}`)
  }
  return await res.json()
}

// ── Anon RPC (no token needed — SECURITY DEFINER functions) ──────────────────
export async function rpcAnon(fn, args) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) { const e = await res.text(); throw new Error(e) }
  return await res.json()
}
