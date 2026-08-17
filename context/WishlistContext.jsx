'use client'
import { supabase } from '../lib/supabase'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const WishlistContext = createContext()

const LS_KEY    = 'viro_wishlist'
const PHONE_KEY = 'viro_user_info'

function loadLocal() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveLocal(list) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}
function getPhone() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(PHONE_KEY) || '{}').phone || null } catch { return null }
}
function normPhone(phone) {
  if (!phone) return null
  const d = phone.replace(/[\s\-()+]/g, '')
  return d.startsWith('0') ? '92' + d.slice(1) : d
}

export function WishlistProvider({ children }) {
  // Hydration-safe: start empty on server, load after mount
  const [wishlist, setWishlistState] = useState([])
  const [syncing,  setSyncing]       = useState(false)
  const [wishlistReady, setWishlistReady] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState([]) // {id, name, oldPrice, newPrice, type: 'drop'|'rise'}

  // Load wishlist from localStorage and refresh live prices from DB
  useEffect(() => {
    const local = loadLocal()
    if (local.length > 0) {
      setWishlistState(local)
      setWishlistReady(true)
      // Refresh live prices from DB after loading saved list
      if (local.length > 0 && supabase) {
        const ids = local.map(p => p.id)
        supabase.from('products')
          .select('id, price, discount_price, sale_active, sale_ends_at, stock, status')
          .in('id', ids)
          .then(({ data: live }) => {
            if (!live?.length) return
            const alerts = []
            setWishlistState(prev => {
              const updated = prev.map(saved => {
                const fresh = live.find(p => p.id === saved.id)
                if (!fresh) return saved
                // Check price change
                const savedPrice = saved.saved_price || saved.discount_price || saved.price
                const now = new Date()
                const saleOk = fresh.discount_price && fresh.discount_price < fresh.price &&
                  fresh.sale_active && (!fresh.sale_ends_at || new Date(fresh.sale_ends_at) > now)
                const livePrice = saleOk ? fresh.discount_price : fresh.price
                if (savedPrice && livePrice && livePrice !== savedPrice) {
                  alerts.push({
                    id: saved.id,
                    name: saved.name,
                    oldPrice: savedPrice,
                    newPrice: livePrice,
                    type: livePrice < savedPrice ? 'drop' : 'rise',
                    saving: savedPrice - livePrice,
                    pct: Math.round(Math.abs((livePrice - savedPrice) / savedPrice) * 100),
                  })
                }
                return {
                  ...saved,
                  price: fresh.price,
                  discount_price: fresh.discount_price,
                  sale_active: fresh.sale_active,
                  sale_ends_at: fresh.sale_ends_at,
                  stock: fresh.stock,
                  status: fresh.status,
                  saved_price: savedPrice, // keep original saved price for comparison
                }
              })
              saveLocal(updated)
              return updated
            })
            if (alerts.length > 0) setPriceAlerts(alerts)
          }).catch(() => {})
      }
    } else {
      setWishlistReady(true)
    }
  }, [])

  const syncToCloud = useCallback(async (list) => {
    const phone = normPhone(getPhone())
    if (!phone) return
    try {
              const ids = list.map(p => p.id)
      await supabase.from('customers')
        .update({ wishlist_ids: ids })
        .or(`phone.eq.${phone},phone.eq.0${phone.slice(2)}`)
    } catch {}
  }, [])

  useEffect(() => {
    const phone = normPhone(getPhone())
    if (!phone) return
    
    setSyncing(true)
    const altPhone = '0' + phone.slice(2)

    supabase.from('customers')
      .select('wishlist_ids')
      .or(`phone.eq.${phone},phone.eq.${altPhone}`)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.wishlist_ids?.length) { setSyncing(false); return }
        const cloudIds = data.wishlist_ids
        const localIds = loadLocal().map(p => p.id)
        const newIds = cloudIds.filter(id => !localIds.includes(id))
        if (!newIds.length) { setSyncing(false); return }

        supabase.from('products')
          .select('*')
          .in('id', newIds)
          .then(({ data: prods }) => {
            if (!prods?.length) { setSyncing(false); return }
            setWishlistState(prev => {
              const merged = [...prev]
              prods.forEach(p => { if (!merged.find(x => x.id === p.id)) merged.push(p) })
              saveLocal(merged)
              return merged
            })
            setSyncing(false)
          })
      })
      .catch(() => setSyncing(false))
  }, [])

  const setWishlist = useCallback((updater) => {
    setWishlistState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveLocal(next)
      syncToCloud(next)
      return next
    })
  }, [syncToCloud])

  const addToWishlist      = (product) => setWishlist(prev =>
    prev.find(i => i.id === product.id) ? prev : [...prev, product]
  )
  const removeFromWishlist = (id) => setWishlist(prev => prev.filter(i => i.id !== id))
  const toggleWishlist     = (product) => setWishlist(prev =>
    prev.find(i => i.id === product.id)
      ? prev.filter(i => i.id !== product.id)
      : [...prev, product]
  )
  const isInWishlist  = (id) => wishlist.some(i => i.id === id)
  const wishlistCount = wishlist.length

  return (
    <WishlistContext.Provider value={{
      wishlist, addToWishlist, removeFromWishlist,
      toggleWishlist, isInWishlist, wishlistCount, syncing, wishlistReady, priceAlerts,
    }}>
      {children}
    </WishlistContext.Provider>
  )
}

export const useWishlist = () => useContext(WishlistContext)
