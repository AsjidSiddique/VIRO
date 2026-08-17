'use client'
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react'

export default function AdminLogin({ onLogin }) {
  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [attempts, setAttempts]         = useState(0)
  const [lockedUntil, setLockedUntil]   = useState(null)

  async function handleLogin(e) {
    e.preventDefault()

    // Brute-force check
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000)
      setError(`Too many failed attempts. Try again in ${secs}s.`)
      return
    }

    setLoading(true)
    setError('')

    // Reject login over plain HTTP (passwords must not travel unencrypted)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setError('Insecure connection. Admin requires HTTPS.')
      setLoading(false)
      return
    }

    const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/secret`

    // Validate env vars
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      setError('App config error — Supabase env vars missing. Check Vercel env settings.')
      setLoading(false)
      return
    }

    try {
      // ── Call Edge Function for login ──────────────────────────────────────
      // Use ANON key as Bearer (required by Supabase gateway)
      // No x-admin-token needed here — we're logging IN, not already authed
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          action:   'admin_login',
          username: username.trim(),
          password,
        }),
      })

      let data
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        if (res.status === 401) {
          setError(
            text.includes('JWT') || text.includes('Invalid')
              ? 'Supabase anon key rejected — check NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env vars.'
              : 'Supabase returned 401 — project may be paused. Check supabase.com dashboard.'
          )
          setLoading(false)
          return
        }
        setError(`Server error (${res.status}) — please try again.`)
        setLoading(false)
        return
      }

      if (data.token) {
        // ── Store token in httpOnly cookie (server middleware guard) ─────────
        await fetch('/api/admin/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: data.token }),
        })

        // ── CRITICAL: Also store in localStorage for adminApi.js ─────────────
        // adminApi.js sends the token as x-admin-token header so the Edge
        // Function can verify admin identity on every subsequent request.
        // httpOnly cookies are unreadable by JS (by design) — localStorage is
        // the correct mechanism for Edge Function auth headers.
        localStorage.setItem('viro_admin_user',  data.username || username.trim())

        setAttempts(0)
        setLockedUntil(null)
        onLogin(data.username || username.trim())
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (data.error && data.error.includes('Too many')) {
          setLockedUntil(Date.now() + 15 * 60 * 1000)
          setError(data.error)
        } else if (newAttempts >= 5) {
          setLockedUntil(Date.now() + 60_000)
          setError('Too many failed attempts. Locked for 60 seconds.')
        } else {
          setError(data.error || `Invalid credentials. ${5 - newAttempts} attempt(s) left.`)
        }
      }
    } catch {
      setError('Network error — please check your connection.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 30% 40%, #00BFFF0A 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, #8B5CF615 0%, transparent 50%), #0A0E1A' }}>
      <div className="w-full max-w-sm slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img src="/logo.jpg" alt="Viro" className="w-20 h-20 rounded-2xl object-cover"
              style={{ boxShadow: '0 0 40px #8B5CF640' }} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>🔐</div>
          </div>
          <h1 className="font-display text-2xl font-extrabold gradient-text">Admin Panel</h1>
          <p className="text-slate-500 text-sm mt-1">viro.pk — Secure Access</p>
        </div>

        <div className="viro-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">👤</span>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="admin" required autoComplete="username"
                  style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔑</span>
                <input type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-red-400 fade-in"
                style={{ background: '#EF444415', border: '1px solid #EF444440' }}>
                ⚠️ {error}
                {lockedUntil && Date.now() < lockedUntil && (
                  <div className="mt-1 text-xs text-red-300 opacity-70">
                    Wait {Math.ceil((lockedUntil - Date.now()) / 1000)}s then try again.
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base font-bold mt-2">
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in...
                  </span>
                : '🔐 Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">VIRO — VALUE | VARIETY | VISION</p>
      </div>
    </div>
  )
}
