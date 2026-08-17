'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import { openWhatsApp } from '../lib/whatsapp'
import { useSite } from '../context/SiteSettingsContext'
import { useHideOnScroll } from '../lib/useHideOnScroll'

export default function WhatsAppButton() {
  const { contact } = useSite()
  const pathname = usePathname()
  const hidden = useHideOnScroll()
  function handleClick(e) {
    e.preventDefault()
    openWhatsApp('Hi Viro! I need help with my order.', contact.whatsapp)
  }

  // Product detail pages have their own sticky "Cart / Buy Now" bar pinned to
  // the bottom (~155px tall, z-index 9999). The default 80px offset used to
  // land this button right on top of the Buy Now button. Lift it clear of
  // that bar on product pages specifically; everywhere else stays at 80px.
  const isProductPage = pathname?.startsWith('/product/')
  const bottomOffset = isProductPage ? '175px' : '80px'

  return (
    <button
      onClick={handleClick}
      aria-label="Chat on WhatsApp"
      style={{
        position: 'fixed',
        bottom: bottomOffset,
        right: '16px',
        zIndex: 900,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#25D366,#128C7E)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(37,211,102,0.45)',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transform: hidden ? 'scale(0.6) translateX(6px)' : 'scale(1) translateX(0)',
        transition: 'transform 0.25s ease, opacity 0.25s ease, bottom 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { if (!hidden) { e.currentTarget.style.transform='scale(1.1)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(37,211,102,0.6)' } }}
      onMouseLeave={e => { if (!hidden) { e.currentTarget.style.transform='scale(1)';   e.currentTarget.style.boxShadow='0 4px 16px rgba(37,211,102,0.45)' } }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    </button>
  )
}
