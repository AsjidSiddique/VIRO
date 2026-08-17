'use client'
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Lazy-load both panels — keeps 75KB AdminDashboard out of public JS bundle
const AdminLogin    = dynamic(() => import('../../admin/AdminLogin'),    { loading: () => null, ssr: false })
const AdminDashboard = dynamic(() => import('../../admin/AdminDashboard'), { loading: () => null, ssr: false })

export default function AdminPage() {
  const [authed,    setAuthed]    = useState(false)
  const [adminUser, setAdminUser] = useState('')
  const [checking,  setChecking]  = useState(true)

  useEffect(() => {
    async function checkSession() {
      // Session is verified via the /api/admin/verify route — which reads the
      // httpOnly cookie server-side. No raw token ever touches localStorage.
      const user = localStorage.getItem('viro_admin_user')
      try {
        const res = await fetch('/api/admin/verify', { credentials: 'include' })
        if (res.ok) {
          setAuthed(true)
          setAdminUser(user || 'admin')
        } else {
          localStorage.removeItem('viro_admin_user')
          setAuthed(false)
        }
      } catch {
        setAuthed(false)
      }
      setChecking(false)
    }
    checkSession()
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout_self' }),
      })
    } catch {}
    await fetch('/api/admin/logout', { method: 'POST' })
    localStorage.removeItem('viro_admin_user')
    setAuthed(false)
  }

  async function handleLogoutEverywhere() {
    try {
      await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout_all' }),
      })
    } catch {}
    await fetch('/api/admin/logout', { method: 'POST' })
    localStorage.removeItem('viro_admin_user')
    setAuthed(false)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--viro-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.jpg" alt="Viro" className="w-16 h-16 rounded-xl object-cover animate-pulse" />
        <p className="text-slate-500 text-sm">Checking session…</p>
      </div>
    </div>
  )

  if (!authed) return <AdminLogin onLogin={u => { setAuthed(true); setAdminUser(u) }} />
  return <AdminDashboard adminUser={adminUser} onLogout={handleLogout} onLogoutEverywhere={handleLogoutEverywhere} />
}
