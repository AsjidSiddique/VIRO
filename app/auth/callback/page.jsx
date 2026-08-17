// app/auth/callback/page.jsx
// Supabase redirects here after Google OAuth
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getUserFromToken, setAuthUser, setAuthProfile, rpcAnon } from '../../../lib/authClient'

function CallbackInner() {
  const router = useRouter()
  const _searchParams = useSearchParams()
  const [status, setStatus] = useState('Completing sign in…')

  useEffect(() => {
    async function handle() {
      try {
        // Supabase passes the session in the URL hash (#access_token=...)
        // or as query params (?code=...) depending on flow type
        let access_token = null
        let user_email   = null
        let user_name    = null
        let user_avatar  = null

        // Check URL hash (implicit flow)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1))
          access_token = hash.get('access_token')
        }

        // Check sessionStorage for PKCE flow tokens stored by Supabase JS
        if (!access_token && typeof window !== 'undefined') {
          // Supabase stores tokens in localStorage under various keys
          for (const key of Object.keys(localStorage)) {
            if (key.includes('auth-token') || key.includes('supabase.auth')) {
              try {
                const val = JSON.parse(localStorage.getItem(key) || 'null')
                if (val?.access_token) { access_token = val.access_token; break }
              } catch {}
            }
          }
        }

        if (access_token) {
          setStatus('Loading your profile…')
          const userData = await getUserFromToken(access_token)
          if (userData) {
            user_email  = userData.email
            user_name   = userData.user_metadata?.full_name || userData.user_metadata?.name || ''
            user_avatar = userData.user_metadata?.avatar_url || ''

            setAuthUser({ email: user_email, name: user_name, avatar: user_avatar, access_token })
            // Meta CAPI: CompleteRegistration
            import('../../../lib/metaEvents').then(m => m.trackCompleteRegistration({
              email: user_email,
              first_name: user_name?.split(' ')[0],
              last_name: user_name?.split(' ').slice(1).join(' '),
            })).catch(() => {})

            // Try to link to existing customer record
            try {
              setStatus('Linking your account…')
              const linkRes = await rpcAnon('link_auth_to_customer', {
                p_auth_user_id: userData.id,
                p_email: user_email,
              })
              if (linkRes?.success) {
                setAuthProfile({ customer_id: linkRes.customer_id, linked: true })
              }
            } catch {}
          }
        }

        // Check where to redirect back to
        const redirectTo = sessionStorage.getItem('viro_auth_redirect') || '/account'
        sessionStorage.removeItem('viro_auth_redirect')
        setStatus('Done! Redirecting…')
        // Use window.location for hard reload so Navbar/AppShell re-reads localStorage
        setTimeout(() => { window.location.href = redirectTo }, 400)
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('Sign in failed. Redirecting…')
        setTimeout(() => { window.location.href = '/account' }, 1500)
      }
    }
    handle()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--viro-sectionBg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
        <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
      </svg>
      <p style={{ fontSize: 14, color: 'var(--viro-textSub)', fontWeight: 600 }}>{status}</p>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
          <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
        </svg>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  )
}
