'use client'
import React, { Suspense, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import Navbar from './Navbar'
import Footer from './Footer'
import Toast from './Toast'
import ScrollRestorer from './ScrollRestorer'
import NavProgress from './NavProgress'
import OfflineBanner from './OfflineBanner'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'

const ScrollToTop        = dynamic(() => import('./ScrollToTop'),        { ssr: false })
const WhatsAppButton     = dynamic(() => import('./WhatsAppButton'),     { ssr: false })
const PWAInstall         = dynamic(() => import('./PWAInstall'),         { ssr: false })
const PWAUpdateNotify    = dynamic(() => import('./PWAUpdateNotify'),    { ssr: false })
const ScrollUpArrow      = dynamic(() => import('./ScrollUpArrow'),      { ssr: false })
const OneSignalInit      = dynamic(() => import('./OneSignalInit'),      { ssr: false })
const NotificationPrompt = dynamic(() => import('./NotificationPrompt'), { ssr: false })
const CheckoutNudge      = dynamic(() => import('./CheckoutNudge'),      { ssr: false })
const MiniCartButton     = dynamic(() => import('./MiniCartButton'),     { ssr: false })
const PromoPopup         = dynamic(() => import('./PromoPopup'),         { ssr: false })
const ExitIntentPopup    = dynamic(() => import('./ExitIntentPopup'),    { ssr: false })
const RecentlyViewedStrip = dynamic(() => import('./RecentlyViewedStrip'), { ssr: false })
const FirstVisitHints     = dynamic(() => import('./FirstVisitHints'),     { ssr: false })
const FloatingReviewsButton = dynamic(() => import('./FloatingReviewsButton'), { ssr: false })

// ── PageTransition ─────────────────────────────────────────────────────────
// While next page loads: current page stays visible but dims slightly.
// When next page is ready: fades in cleanly.
// Navbar and Footer NEVER disappear — only the content area transitions.
function PageTransition({ children }) {
  const pathname     = usePathname()
  const isAdmin      = pathname?.startsWith('/adm')
  const prevPath     = useRef(pathname)
  const [opacity, setOpacity] = useState(1)
  const timer = useRef(null)

  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    // Dim briefly then restore — current content stays visible
    setOpacity(0.55)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpacity(1), 120)

    return () => clearTimeout(timer.current)
  }, [pathname])

  return (
    <div style={{
      opacity:    opacity,
      transition: opacity < 1 ? 'opacity 0.08s ease' : 'opacity 0.18s ease',
      minHeight:  '100vh',
      // NOTE: intentionally NOT setting willChange:'opacity' here. Per the CSS
      // spec, will-change:opacity makes an element a "containing block" for
      // any position:fixed descendant — exactly like a real transform would —
      // even while opacity is still 1. Every modal/popup on the site (prepaid
      // nudge, OOS popup, etc.) uses position:fixed expecting to center on the
      // actual visible viewport; with this wrapper as their containing block
      // instead, they centered on the full scrollable PAGE height instead —
      // invisible or half off-screen on any tall page. This was breaking
      // fixed positioning site-wide, not just for one popup.
    }}>
      {children}
    </div>
  )
}

export default function AppShell({ children }) {
  const pathname = usePathname()
  const isAdmin  = pathname?.startsWith('/adm')

  // Keep the cart's cached prices honest everywhere, not just on the
  // /cart and /checkout pages. Without this, a product's discount could go
  // live (or expire) while its cached copy still sits in someone's cart
  // from an earlier visit — showing stale prices on the floating mini-cart
  // pill on /shop, in the nav badge, etc. — until they happened to open
  // /cart. This runs once when the app first loads/refreshes, silently
  // re-syncing price/discount/stock from the DB in the background.
  const { refreshCartPrices, cartCount, cartReady } = useCart()
  useEffect(() => {
    if (isAdmin || !cartReady || !cartCount) return
    refreshCartPrices(supabase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartReady])

  return (
    <div suppressHydrationWarning className="min-h-screen"
      style={{ background: 'var(--viro-bg)', transition: 'background 0.3s ease' }}>

      {/* ── These NEVER remount — always persistent ── */}
      <NavProgress />
      <ScrollRestorer />
      {!isAdmin && <OfflineBanner />}
      {!isAdmin && <TopBar />}
      <Toast />
      {!isAdmin && <Navbar />}

      {/* ── Content area — only this transitions ── */}
      <main className={isAdmin ? 'min-h-screen' : 'md:ml-16 min-h-screen'} id="viro-main" aria-label="Main content"
        style={{ transition: 'margin-left 0.25s cubic-bezier(.4,0,.2,1)' }}>
        <PageTransition>
          {children}
        </PageTransition>
        {!isAdmin && <Footer />}
      </main>

      {/* ── Persistent overlays (customer-only) ── */}
      {!isAdmin && (
        <Suspense fallback={null}>
          <WhatsAppButton />
          <PWAInstall />
          <PWAUpdateNotify />
          <NotificationPrompt />
          <CheckoutNudge />
          <MiniCartButton />
          <PromoPopup />
          <ExitIntentPopup />
          <RecentlyViewedStrip />
          <FirstVisitHints />
          <FloatingReviewsButton />
          <ScrollUpArrow />
          <ScrollToTop />
          <OneSignalInit />
        </Suspense>
      )}
    </div>
  )
}
