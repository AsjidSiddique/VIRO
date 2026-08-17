'use client'
import { supabase } from '../lib/supabase'
import React, { useEffect, useState, useMemo } from 'react'
import { useSite } from '../context/SiteSettingsContext'
import SideMenuDrawer from './SideMenuDrawer'

// Fallback messages — used only when DB has no announcement saved
// Delivery values are injected dynamically from deliveryRules below
// Note: phone number is NOT hardcoded here — it's injected from contact.whatsapp in dynamicFallback
const BASE_FALLBACK = [
  '✅ Trusted Quality · Best Prices · Fast Delivery',
  '🛍️ Smart Shopping, Better Living — viro.pk',
]

export default function TopBar() {
  const { deliveryRules, contact, codAdvance } = useSite()

  // Build dynamic fallback from live delivery rules
  const dynamicFallback = useMemo(() => {
    if (!deliveryRules?.length) return BASE_FALLBACK
    const msgs = deliveryRules
      .filter(r => !r.cities?.includes('*'))
      .map(r => `🚚 FREE Delivery in ${r.label} on orders Rs.${r.freeThreshold?.toLocaleString()}+`)
    const wild = deliveryRules.find(r => r.cities?.includes('*'))
    if (wild) msgs.push(`🌍 ${wild.label} — Free on Rs.${wild.freeThreshold?.toLocaleString()}+ · Rs.${wild.charge} otherwise`)
    if (contact?.whatsapp) msgs.push(`📞 Call / WhatsApp: ${contact.phone || contact.whatsapp}`)
    return [...msgs, ...BASE_FALLBACK.slice(-2)]
  }, [deliveryRules, contact])

  // Sync dynamic fallback into messages once deliveryRules load from DB
  useEffect(() => {
    // Only update if still showing static BASE_FALLBACK (no DB announcement loaded yet)
    setMessages(prev => {
      const isStillDefault = prev.length <= BASE_FALLBACK.length &&
        prev.every(m => BASE_FALLBACK.includes(m))
      return isStillDefault ? dynamicFallback : prev
    })
  }, [dynamicFallback])

  // Always start with BASE_FALLBACK — matches server render exactly → no #418/#425 hydration mismatch.
  // Real cached value loaded post-hydration in useEffect below.
  const [messages, setMessages] = useState(BASE_FALLBACK)

  useEffect(() => {
    // Step 1: Check sessionStorage cache first (instant, no network)
    try {
      const raw = sessionStorage.getItem('viro_announcement')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed) && parsed?.msgs && Date.now() - parsed.ts < 5 * 60 * 1000) {
          setMessages(parsed.msgs)
          return  // cache still fresh — skip network fetch
        }
      }
    } catch {}
    // Step 2: Fetch from DB (background — doesn't block render)
    if (!supabase) return
    supabase.from('site_settings').select('value').eq('key', 'announcement').maybeSingle()
      .then(({ data }) => {
        if (data?.value?.messages?.length) {
          setMessages(data.value.messages)
          try {
            sessionStorage.setItem('viro_announcement', JSON.stringify({ msgs: data.value.messages, ts: Date.now() }))
          } catch {}
        }
      }).catch(() => {})
  }, [])

  // COD advance line injected here — driven by the admin toggle, not typed
  // into the DB announcement text, so it always reflects the real
  // configured amount and can be turned on/off without editing announcement
  // copy by hand.
  const displayMessages = useMemo(() => {
    if (!codAdvance?.enabled) return messages
    const codMsg = `💳 COD Orders: Rs.${codAdvance.amount} advance required to confirm`
    return [...messages, codMsg]
  }, [messages, codAdvance])

  return (
    // No md:pl offset — TopBar sits above EVERYTHING including sidebar
    <div className="sticky top-0 z-50 w-full overflow-hidden"
      style={{ height: '36px', background: 'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316,#8B5CF6,#00BFFF)', backgroundSize: '300% 100%', animation: 'gradShift 8s ease infinite' }}>
      <style>{`
        @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ticker { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
        .ticker { display:flex; white-space:nowrap; animation:ticker 32s linear infinite; gap:3rem; }
        .ticker:hover { animation-play-state:paused; }
      `}</style>
      <div className="flex items-center h-full overflow-hidden">
        {/* Dedicated slot — the ticker below is confined to its own
            overflow-hidden container starting after this, so scrolling
            text can never slide underneath the button no matter how long
            a message is or how the animation times out. */}
        <SideMenuDrawer />
        <div className="flex-1 h-full overflow-hidden relative">
          <div className="ticker">
            {/* COD advance message injected here, not typed into the DB
                announcement text — this way it's driven by the admin toggle
                (Site Settings → Checkout) and always reflects the real
                configured amount, instead of an announcement line that could
                drift out of sync if the amount changes later. */}
            {[...displayMessages,...displayMessages].map((m,i) => (
              <span key={i} className="text-white font-semibold text-xs px-6 flex-shrink-0"
                style={{textShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
