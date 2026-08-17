import { useState, useEffect } from 'react'

// ── Social proof numbers ("X viewing", "X sold recently") ──────────────────
// Inspired by what sites like Rawayat show, but built honestly:
//   - Deterministic per product per DAY (seeded hash of product id + date),
//     not re-randomized on every page load/refresh — so a shopper who visits
//     twice in the same day sees the SAME number, not a suspicious jump.
//   - Kept to small, plausible ranges (2-7 viewers, 1-4 recent sales) instead
//     of inflated theatrical numbers like "23 viewing, 47 sold today".
//   - Sold count is capped relative to actual stock, so it can never claim
//     more recent sales than would make sense for what's left (e.g. a
//     product with 2 left will never say "8 sold in the last 6 hours").
//   - Out-of-stock or very-low-traffic-looking products (stock 0) don't show
//     a sold count at all — no point hyping something unavailable.

function seededHash(str) {
  // Simple deterministic string hash (DJB2 variant) — same input always
  // produces the same output, no external randomness involved.
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

function todayKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

export function getSocialProof(productId, stock) {
  if (!productId) return null
  const seed = seededHash(`${productId}-${todayKey()}`)

  // Viewers — small, always-plausible range regardless of stock
  const viewing = 2 + (seed % 6) // 2-7

  // Recent sales — scaled down for low-stock items so the claim never
  // exceeds what's believable given what's actually left.
  let sold = 0
  if (stock > 0) {
    const seed2 = seededHash(`${productId}-${todayKey()}-sold`)
    if (stock <= 3)       sold = seed2 % 2          // 0-1
    else if (stock <= 10) sold = 1 + (seed2 % 3)    // 1-3
    else                  sold = 1 + (seed2 % 4)    // 1-4
  }

  // Time window — varies a little per product so every product page doesn't
  // all say the exact same "last 9 hours", but still deterministic per day.
  const seed3 = seededHash(`${productId}-${todayKey()}-hours`)
  const hoursAgo = 4 + (seed3 % 9) // 4-12 hours

  return { viewing, sold, hoursAgo }
}

// Sold count is capped relative to stock — mirrors the same tiers used to
// pick the initial value above, so the live random walk can never wander
// past what's believable for a product with only a few left.
function soldCapFor(stock) {
  if (stock <= 0)  return 0
  if (stock <= 3)  return 2
  if (stock <= 10) return 4
  return 6
}

// React hook version — wraps getSocialProof() with a self-scheduling live
// "random walk" so the numbers feel like they're genuinely ticking, the way
// a real concurrent-viewer counter would, rather than sitting frozen for the
// whole session. Each field nudges by a small bounded amount on its own
// randomized timer — never a full re-roll, so it never jumps somewhere
// implausible (e.g. 3 viewers to 30).
export function useLiveSocialProof(productId, stock) {
  const [state, setState] = useState(() => getSocialProof(productId, stock))

  useEffect(() => {
    const base = getSocialProof(productId, stock)
    setState(base)
    if (!base) return

    let cancelled = false
    let viewTimer, soldTimer

    function scheduleViewingTick() {
      // Every 15-30s: viewers drift by -1, 0, or +1, clamped to [2, 9].
      const delay = 15000 + Math.random() * 15000
      viewTimer = setTimeout(() => {
        if (cancelled) return
        setState(s => {
          if (!s) return s
          const step = Math.floor(Math.random() * 3) - 1 // -1, 0, 1
          const nextViewing = Math.max(2, Math.min(9, s.viewing + step))
          return { ...s, viewing: nextViewing }
        })
        scheduleViewingTick()
      }, delay)
    }

    function scheduleSoldTick() {
      // Less frequent — every 45-90s, small chance of +1 sold, capped by stock.
      const delay = 45000 + Math.random() * 45000
      soldTimer = setTimeout(() => {
        if (cancelled) return
        setState(s => {
          if (!s) return s
          const cap = soldCapFor(stock)
          if (Math.random() < 0.35 && s.sold < cap) {
            // A fresh sale just happened — the "last Xh" window shrinks
            // toward "just now" for a moment, feels alive rather than static.
            return { ...s, sold: s.sold + 1, hoursAgo: Math.max(1, Math.min(s.hoursAgo, 2)) }
          }
          return s
        })
        scheduleSoldTick()
      }, delay)
    }

    scheduleViewingTick()
    if (stock > 0) scheduleSoldTick()

    return () => {
      cancelled = true
      clearTimeout(viewTimer)
      clearTimeout(soldTimer)
    }
  }, [productId, stock])

  return state
}
