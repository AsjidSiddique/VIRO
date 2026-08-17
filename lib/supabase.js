// ── lib/supabase.js — Drop-in replacement for @supabase/supabase-js ──────────
// Exports the same `supabase` object that all files expect:
//   import { supabase } from '../lib/supabase'
// Uses plain fetch() — no npm package, no React hooks, no SSR crash.
// Works identically on server (API routes, server components) and browser.
// ─────────────────────────────────────────────────────────────────────────────
import { browserSupabase } from './supabaseClient'

// Main export — same name every file already imports
export const supabase = browserSupabase

// Server-side factory (used by app/sitemap.js, app/product/page.jsx, etc.)
export function createServerSupabaseClient() {
  return browserSupabase
}
