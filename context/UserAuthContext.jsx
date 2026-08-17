'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getAuthUser, setAuthUser, signInWithGoogle as doSignIn,
  signOut as doSignOut, rpcAnon, getAuthProfile, setAuthProfile,
} from '../lib/authClient'

const UserAuthContext = createContext(null)

export function UserAuthProvider({ children }) {
  const [user,     setUser]    = useState(null)   // { email, name, avatar, access_token }
  const [profile,  setProfile] = useState(null)   // { customer_id, gender, dob }
  const [ready,    setReady]   = useState(false)

  // Load from localStorage on mount + listen for changes across tabs/reloads
  useEffect(() => {
    const u = getAuthUser()
    const p = getAuthProfile()
    setUser(u)
    setProfile(p)
    setReady(true)

    // Re-read auth when storage changes (e.g. after OAuth callback sets token)
    function onStorage(e) {
      if (e.key === 'viro_auth_user') {
        const updated = getAuthUser()
        setUser(updated)
        if (!updated) setProfile(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const signIn = useCallback((redirectTo) => {
    if (redirectTo) sessionStorage.setItem('viro_auth_redirect', redirectTo)
    doSignIn()
  }, [])

  const signOut = useCallback(async () => {
    await doSignOut()
    setUser(null)
    setProfile(null)
    // Hard reload so all cached state (cart count, wishlist, etc.) clears
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }, [])

  // After login: fetch/update profile data from Supabase
  const refreshProfile = useCallback(async (email) => {
    if (!email) return
    try {
      const orders = await rpcAnon('get_orders_by_email', { p_email: email })
      if (Array.isArray(orders) && orders.length > 0) {
        const c = orders[0].customers
        if (c) {
          const p = { customer_id: c.id, gender: c.gender, dob: c.date_of_birth, linked: true }
          setProfile(p)
          setAuthProfile(p)
        }
      }
    } catch {
      // RPC may not exist yet if SQL migration hasn't been run — fail silently
    }
  }, [])

  // ── THE ACTUAL FIX for cross-device cart/wishlist sync ──────────────────
  // `refreshProfile` used to only ever get called from the Account page —
  // meaning `profile.customer_id` stayed null for anyone who logged in and
  // went straight to shopping without visiting Account first. Every feature
  // that depends on customer_id (cart sync, wishlist sync, order linking)
  // silently did nothing for that entire session, on that device, even
  // though the login itself succeeded. Auto-resolving it here — right after
  // `user` becomes available — means it's set the moment someone logs in,
  // on every device, without them needing to know to visit their profile.
  useEffect(() => {
    if (user?.email && !profile?.customer_id) {
      refreshProfile(user.email)
    }
  }, [user, profile?.customer_id, refreshProfile])

  // Update stored user
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates }
      setAuthUser(next)
      return next
    })
  }, [])

  return (
    <UserAuthContext.Provider value={{ user, profile, ready, signIn, signOut, refreshProfile, updateUser }}>
      {children}
    </UserAuthContext.Provider>
  )
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext)
  if (!ctx) throw new Error('useUserAuth must be used inside UserAuthProvider')
  return ctx
}
