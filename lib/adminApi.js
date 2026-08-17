// lib/adminApi.js — v4 (Secure: httpOnly cookie, no localStorage token)
// ─────────────────────────────────────────────────────────────────────────────
//
// SECURITY FIX (Gap 2):
//   Token is no longer stored in localStorage (XSS vulnerability).
//   Instead, all admin API calls go through /api/admin/action — a Next.js
//   server route that reads the httpOnly cookie and forwards the token to
//   Supabase. The browser JS never sees the raw admin token.
//
// FLOW:
//   client → POST /api/admin/action → Next.js reads httpOnly cookie
//          → forwards to Supabase Edge Function → returns JSON → client
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_URL = '/api/admin/action'

/**
 * Call the Viro admin Edge Function via the secure server-side proxy.
 *
 * @param {string} action   - Action name (e.g. 'product_update')
 * @param {object} payload  - Additional payload fields
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} On network error
 */
export async function adminApi(action, payload = {}) {
  if (typeof window === 'undefined') {
    throw new Error('adminApi can only be called client-side')
  }

  let res
  try {
    res = await fetch(PROXY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // Credentials: 'include' ensures the httpOnly cookie is sent to the proxy
      credentials: 'include',
      body: JSON.stringify({ action, ...payload }),
    })
  } catch (networkErr) {
    throw new Error('Network error — check your connection and try again.')
  }

  let data
  try { data = await res.json() }
  catch { data = { error: `Server error (${res.status})` } }

  // If the proxy says 401 (no cookie / expired session) → redirect to login
  if (res.status === 401) {
    console.warn('[adminApi] Session expired or invalid — redirecting to login')
    handleAuthFailure('session_expired')
    return { error: 'Session expired — redirecting to login' }
  }

  // Edge Function rejected the token
  if (
    data?.error && (
      data.error.toLowerCase().includes('not authenticated') ||
      data.error.toLowerCase().includes('please log in') ||
      data.error.toLowerCase().includes('invalid token') ||
      data.error.toLowerCase().includes('unauthorized')
    )
  ) {
    console.warn('[adminApi] Edge Function rejected token')
    handleAuthFailure('token_rejected')
    return { error: 'Session expired — redirecting to login' }
  }

  return data
}

function handleAuthFailure(reason = 'unknown') {
  console.warn(`[adminApi] Auth failure (${reason}) — clearing session`)
  localStorage.removeItem('viro_admin_user')
  // POST to /api/admin/logout — the server clears the cookie AND redirects
  // to the admin login page server-side. The slug never touches the client bundle.
  fetch('/api/admin/logout', { method: 'POST' })
    .then(res => { if (res.redirected) window.location.href = res.url })
    .catch(() => { window.location.href = '/' })
}
