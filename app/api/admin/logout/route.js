import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  cookies().delete('viro_admin_token')
  // Redirect server-side — the slug stays in ADMIN_SLUG env var,
  // never exposed to the browser bundle.
  const slug = process.env.ADMIN_SLUG || 'adm1n0nly'
  return NextResponse.redirect(
    new URL(`/${slug}`, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    { status: 303 }
  )
}
