// ─────────────────────────────────────────────────────────────
// adminUtils.js — shared helpers used across admin components
// ─────────────────────────────────────────────────────────────

// Convert UTC ISO string to local datetime-local value for the input
export function isoToLocalInput(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert datetime-local string (local time) to ISO string (UTC)
export function localDateToISO(localStr) {
  if (!localStr) return null
  const d = new Date(localStr)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

// Simple promise-based confirm dialog (fires custom event)
export function adminConfirm(msg) {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('viro-admin-confirm', { detail: { msg, resolve } }))
  })
}

export const TABS = ['Products', 'Add Product', 'Orders', 'Coupons', 'Reviews', 'Categories', 'Site Settings']
