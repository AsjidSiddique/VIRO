import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import GoClient from './GoClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Opening Viro.pk…',
  robots: { index: false, follow: false },
}

// Matches Instagram + Facebook in-app browsers (covers FBAN/FBAV for Facebook,
// Instagram for IG — both Android and iOS use these tokens).
const IN_APP_UA = /Instagram|FBAN|FBAV/i

function safeDestination(rawTo) {
  // Only ever allow an internal path. Never allow an absolute/external URL here —
  // this single check is what stops the /go page from being used as an open redirect.
  try {
    if (!rawTo) return '/shop'
    const decoded = decodeURIComponent(rawTo)
    if (!decoded.startsWith('/')) return '/shop'
    if (decoded.startsWith('//')) return '/shop' // protocol-relative — blocked
    return decoded
  } catch {
    return '/shop'
  }
}

export default async function GoPage({ searchParams }) {
  let ua = ''
  try {
    const h = await headers()
    ua = h.get('user-agent') || ''
  } catch {
    ua = ''
  }

  const params = (await searchParams) || {}
  const destination = safeDestination(params?.to)

  let isInApp = false
  try {
    isInApp = IN_APP_UA.test(ua)
  } catch {
    isInApp = false
  }

  // Not Instagram/Facebook → this page should be invisible. Redirect immediately,
  // server-side, before any HTML is sent. No flash, no extra tap, nothing to see.
  if (!isInApp) {
    redirect(destination)
  }

  // Instagram/Facebook in-app browser → show the branded one-tap screen.
  return <GoClient destination={destination} />
}
