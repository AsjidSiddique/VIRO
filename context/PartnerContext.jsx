'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useUserAuth } from './UserAuthContext'

const PartnerContext = createContext(null)

export function PartnerProvider({ children }) {
  const { user, ready } = useUserAuth()
  const [state, setState] = useState('loading') // loading | logged_out | not_registered | pending | rejected | approved
  const [data, setData] = useState(null)
  const [rejectedReason, setRejectedReason] = useState('')
  const [rank, setRank] = useState(null)

  const load = useCallback(async () => {
    if (!user?.email) { setState('logged_out'); return }
    setState('loading')
    try {
      const res = await fetch('/api/influencer-dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const json = await res.json()
      if (!json.ok || json.status === 'not_registered') { setState('not_registered'); return }
      if (json.status === 'pending')  { setState('pending'); return }
      if (json.status === 'rejected') { setRejectedReason(json.rejected_reason || ''); setState('rejected'); return }
      if (json.status === 'approved') {
        setData({
          influencer: json.influencer, coupon: json.coupon, ledger: json.ledger || [],
          tier: json.tier, allTiers: json.all_tiers, orderCount: json.order_count ?? json.ledger?.length ?? 0,
          newSinceLastVisit: json.new_since_last_visit || 0, extraCoupons: json.extra_coupons || [],
        })
        setState('approved')
        return
      }
      setState('not_registered')
    } catch {
      setState('not_registered')
    }
  }, [user?.email])

  useEffect(() => { if (ready) load() }, [ready, load])

  useEffect(() => {
    if (state !== 'approved' || !user?.email) return
    fetch('/api/influencer-leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).then(r => r.json()).then(json => { if (json?.your_rank) setRank(json.your_rank) }).catch(() => {})
  }, [state, user?.email])

  return (
    <PartnerContext.Provider value={{ state, data, rejectedReason, rank, reload: load, ready }}>
      {children}
    </PartnerContext.Provider>
  )
}

export function usePartner() {
  const ctx = useContext(PartnerContext)
  if (!ctx) throw new Error('usePartner must be used within PartnerProvider')
  return ctx
}
