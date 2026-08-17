import { cookies } from 'next/headers'

// ── /api/admin/verify ─────────────────────────────────────────────────────
// Validates admin session by forwarding the token to the Supabase Edge Function.
//
// WHY THIS APPROACH:
// - No service role key in application code (security best practice)
// - No anon key querying admin_sessions (RLS would block it anyway)
// - The `secret` Edge Function ALREADY validates tokens with the service key
//   and even rotates them on every call — reuse that logic entirely
// - This route just reads the httpOnly cookie (JS can't) and forwards to Edge
//
export async function GET() {
  const cookieStore = cookies()
  const token = cookieStore.get('viro_admin_token')?.value

  // Gate 1: token must exist and have a plausible format
  if (!token || token.length < 32) {
    return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return Response.json({ ok: false, error: 'Server config error' }, { status: 500 })
  }

  // Gate 2: call the Edge Function with a lightweight "ping" action.
  // The Edge Function validates x-admin-token against admin_sessions using the
  // SERVICE_ROLE_KEY (server-side secret, never in browser code) and returns
  // 401 if the token is missing, expired, or invalid.
  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/secret`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'x-admin-token': token,   // ← Edge Function validates this vs DB using service key
      },
      body: JSON.stringify({ action: 'ping' }),
    })

    if (edgeRes.ok) {
      return Response.json({ ok: true })
    }

    // Edge Function returned 401/403 — token invalid or expired
    return Response.json({ ok: false, error: 'Invalid or expired session' }, { status: 401 })

  } catch (e) {
    console.error('[verify] Edge Function call failed:', e)
    return Response.json({ ok: false, error: 'Verification failed' }, { status: 500 })
  }
}
