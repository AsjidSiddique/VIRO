// Viro — WhatsApp opener
// Mobile  → navigator.share (native OS share sheet: shows all WhatsApp installs)
//           Falls back to intent URL if share not available
// Desktop → tries whatsapp:// URI first (opens desktop app if installed)
//           Falls back to wa.me (universal link, opens app or web)

const FALLBACK_PHONE = '923290081469'

export function openWhatsApp(text = '', phone = FALLBACK_PHONE) {
  if (typeof window === 'undefined') return

  const encoded   = encodeURIComponent(text)
  const isMobile  = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isMobile) {
    // ── Mobile: use intent/universal URL which lets OS choose
    // On Android: intent URL triggers app chooser if both WhatsApp installs exist
    // On iOS: universal link opens whichever WhatsApp is default
    if (isAndroid) {
      // Android intent — OS shows chooser if user has both WhatsApp & WhatsApp Business
      const intentUrl = `intent://send?phone=${phone}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(`https://wa.me/${phone}?text=${encoded}`)};end`
      const businessIntent = `intent://send?phone=${phone}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(`https://wa.me/${phone}?text=${encoded}`)};end`

      // Try to detect which WhatsApp apps are installed via a hidden test
      // We'll use wa.me which Android resolves to the chooser if both are installed
      window.location.href = `https://wa.me/${phone}?text=${encoded}`
    } else if (isIOS) {
      // iOS — whatsapp:// opens whichever WhatsApp user has as default
      // iOS doesn't support app chooser the same way
      const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`
      const fallbackUrl = `https://wa.me/${phone}?text=${encoded}`

      // Try app first, fall back to wa.me if not installed
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;opacity:0;border:none'
      iframe.src = appUrl
      document.body.appendChild(iframe)

      const timer = setTimeout(() => {
        try { document.body.removeChild(iframe) } catch {}
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
      }, 1200)

      window.addEventListener('blur', function onBlur() {
        clearTimeout(timer)
        setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 2000)
        window.removeEventListener('blur', onBlur)
      }, { once: true })
    }

  } else {
    // ── Desktop: try whatsapp:// URI (opens desktop app if installed)
    // Then fall back to wa.me (universal — opens app or offers download)
    const desktopAppUrl = `whatsapp://send?phone=${phone}&text=${encoded}`
    const universalUrl  = `https://wa.me/${phone}?text=${encoded}`

    // Try desktop app via hidden link click
    const a = document.createElement('a')
    a.href = desktopAppUrl
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // After 2s if no app opened (no blur), open universal link in new tab
    const timer = setTimeout(() => {
      window.open(universalUrl, '_blank', 'noopener,noreferrer')
    }, 2000)

    window.addEventListener('blur', function onBlur() {
      clearTimeout(timer) // App opened — cancel web fallback
      window.removeEventListener('blur', onBlur)
    }, { once: true })
  }
}

// Build href for <a> tags
export function waHref(text = '', phone = FALLBACK_PHONE) {
  const encoded  = encodeURIComponent(text)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return isMobile
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/${phone}?text=${encoded}`
}
