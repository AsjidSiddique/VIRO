'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSite } from '../context/SiteSettingsContext'
import { supabase } from '../lib/supabase'

const TYPE_COLOR = { all: '#00BFFF', category: '#8B5CF6', block: '#F97316' }
const TYPE_ICON  = { all: '🛍', category: '🏷', block: '📦' }

// Your subcategories mostly share one generic icon in the database (that's
// the actual root cause of every row looking identical — no lookup can fix
// data that's the same at the source). This guesses a distinct, relevant
// icon straight from the label text for common jewelry/fashion terms, so
// "Rings", "Necklace Sets", "Earrings & Jhumki" etc. each get something
// that actually looks like what they are, regardless of what's stored in
// the category record. Falls through to the real category icon (in case
// you DO set a custom one later) only when nothing here matches.
const KEYWORD_ICONS = [
  [/ring/i, '💍'], [/necklace/i, '📿'], [/earring|jhumki|stud/i, '💎'],
  [/bracelet|bangle|handcuff|kara|cuff/i, '⛓️'], [/pendant/i, '🔮'],
  [/hair|clip|scrunchie|headband|pin/i, '🎀'], [/makeup|cosmetic|lipstick|lip/i, '💄'],
  [/bag|clutch|purse|handbag/i, '👜'], [/watch/i, '⌚'], [/jewel/i, '✨'],
  [/dress|fashion|cloth|wear/i, '👗'], [/shoe|sandal|heel/i, '👠'],
  [/perfume|fragrance/i, '🌸'], [/sunglass|glass/i, '🕶️'], [/scarf|hijab/i, '🧣'],
  [/gift/i, '🎁'], [/kid|baby/i, '🧸'], [/men/i, '🕴️'], [/electron/i, '🔌'],
]
function guessIcon(label) {
  const hit = KEYWORD_ICONS.find(([re]) => re.test(label || ''))
  return hit ? hit[1] : null
}

/**
 * Mobile-only hamburger (☰) + slide-out drawer, listing admin-configured
 * shortcuts (a subcategory, an existing Home Block's product set, or "All
 * Products"). "Home" is always first and fixed. A block-sourced item lands
 * on /shop pre-filtered to just that block's products via ?block=<id>,
 * which ShopClient reads the same way it already reads ?cat=/?q=.
 */
export default function SideMenuDrawer() {
  const { sideMenu, contact } = useSite()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [categoryIcons, setCategoryIcons] = useState({}) // { [categoryId]: icon }

  useEffect(() => {
    const needsLookup = sideMenu.some(i => i.type === 'category' && !i.icon)
    if (!needsLookup) return
    supabase.from('categories').select('id,icon').then(({ data }) => {
      if (data) setCategoryIcons(Object.fromEntries(data.map(c => [c.id, c.icon])))
    })
  }, [sideMenu])

  function itemHref(item) {
    if (item.type === 'all') return '/shop'
    if (item.type === 'category') return `/shop?cat=${item.categoryId}`
    if (item.type === 'block') return `/shop?block=${item.blockId}`
    return '/shop'
  }
  function itemIcon(item) {
    // Keyword match first — guarantees visual variety for the common case
    // (jewelry/fashion subcategory names) regardless of database data quality.
    const guessed = guessIcon(item.label)
    if (guessed) return guessed
    if (item.icon) return item.icon
    if (item.type === 'category') return categoryIcons[item.categoryId] || TYPE_ICON.category
    return TYPE_ICON[item.type] || '•'
  }

  return (
    <>
      {/* Trigger — rendered by TopBar.jsx inside a dedicated flex slot
          (not floating independently), so it can't collide with the
          ticker text and doesn't need a guessed top/left position at all. */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="md:hidden flex items-center justify-center flex-shrink-0"
          style={{
            width: 30, height: 30, margin: '0 6px 0 10px', borderRadius: '50%',
            background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.3), 0 0 0 2px #8B5CF6',
            border: 'none', color: '#8B5CF6', fontSize: 13, lineHeight: 1,
          }}>
          ☰
        </button>
      )}

      {open && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          {/* Backdrop — starts below the announcement bar so that bar stays
              exactly as-is (not dimmed/covered), avoiding a doubled-bar look */}
          <div onClick={() => setOpen(false)}
            style={{ position: 'absolute', top: 36, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', animation: 'sideMenuFadeIn 0.2s ease-out' }} />

          {/* Drawer panel — starts right where the announcement bar ends */}
          <div style={{
            position: 'absolute', top: 36, left: 0, bottom: 0, width: '80%', maxWidth: 300,
            background: 'var(--viro-bg)', boxShadow: '6px 0 28px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', animation: 'sideMenuSlideIn 0.24s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <style>{`
              @keyframes sideMenuSlideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
              @keyframes sideMenuFadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>

            <div className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: '1px solid var(--viro-border)' }}>
              <span className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--viro-text)' }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)', color: '#fff', fontSize: 12,
                }}>☰</span>
                Menu
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu"
                className="flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', fontSize: 13 }}>
                ✕
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-1.5">
              <MenuRow href="/" icon="🏠" label="Home" color="#8B5CF6" active={pathname === '/'} onClick={() => setOpen(false)} />
              {sideMenu.map(item => (
                <MenuRow key={item.id} href={itemHref(item)}
                  icon={itemIcon(item)}
                  color={TYPE_COLOR[item.type] || '#8B5CF6'}
                  label={item.label} onClick={() => setOpen(false)} />
              ))}
            </nav>

            {contact?.whatsapp && (
              <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid var(--viro-border)' }}>
                <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>Need help? WhatsApp {contact.phone || contact.whatsapp}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MenuRow({ href, icon, label, color, active, onClick }) {
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-xl transition-colors"
      style={{
        background: active ? `${color}14` : 'transparent',
        borderLeft: `3px solid ${active ? color : 'transparent'}`,
      }}>
      <span className="flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`, fontSize: 17 }}>
        {icon}
      </span>
      <span className="text-sm font-semibold flex-1" style={{ color: 'var(--viro-text)' }}>{label}</span>
      <span style={{ color: 'var(--viro-textSub)', fontSize: 13 }}>›</span>
    </Link>
  )
}
