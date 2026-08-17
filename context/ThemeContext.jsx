'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} })
export const useTheme = () => useContext(ThemeContext)

// ── Theme CSS variable maps ───────────────────────────────────────────────────
export const DARK = {
  '--viro-bg':           '#0F172A',
  '--viro-bgDeep':       '#080E1C',
  '--viro-bgCard':       '#1E293B',
  '--viro-bgInput':      '#1E293B',
  '--viro-border':       '#334155',
  '--viro-text':         '#F1F5F9',
  '--viro-textMuted':    '#94A3B8',
  '--viro-textSub':      '#64748B',
  '--viro-navBg':        '#080E1C',
  '--viro-navBorder':    '#1E293B',
  '--viro-featureBg':    '#1E293B',
  '--viro-featureBorder':'#334155',
  '--viro-sectionBg':    '#0F172A',
  '--viro-searchBg':     '#0F172A',
  '--viro-productWhite': '#1E293B',
}
export const LIGHT = {
  '--viro-bg':           '#F0F4F8',
  '--viro-bgDeep':       '#E2E8F0',
  '--viro-bgCard':       '#FFFFFF',
  '--viro-bgInput':      '#FFFFFF',
  '--viro-border':       '#CBD5E1',
  '--viro-text':         '#0F172A',
  '--viro-textMuted':    '#334155',
  '--viro-textSub':      '#64748B',
  '--viro-navBg':        '#FFFFFF',
  '--viro-navBorder':    '#E2E8F0',
  '--viro-featureBg':    '#FFFFFF',
  '--viro-featureBorder':'#CBD5E1',
  '--viro-sectionBg':    '#F0F4F8',
  '--viro-searchBg':     '#F8FAFC',
  '--viro-productWhite': '#FFFFFF',
}

// localStorage keys
const LS_THEME       = 'viro_theme'
const LS_THEME_VER   = 'viro_theme_ver'  // tracks the DB version stamp

function applyTheme(t) {
  const vars = t === 'light' ? LIGHT : DARK
  const root = document.documentElement
  root.setAttribute('data-theme', t)
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  document.body.style.backgroundColor = vars['--viro-bg']
  document.body.style.color           = vars['--viro-text']
}

export function ThemeProvider({ children }) {
  // BUGFIX (flash of wrong theme): this used to hardcode useState('dark'),
  // and the effect below re-applies applyTheme(theme) on every mount —
  // which meant it ALWAYS painted dark first, even when layout.jsx's
  // blocking inline <script> had already correctly applied the admin's
  // light theme before first paint. The hardcoded 'dark' overwrote the
  // correct theme, and only flipped back once the async initTheme() below
  // finished its own (redundant) fetch — that gap was the visible flash.
  // Fix: read the theme the blocking script already set on <html
  // data-theme="..."> as the INITIAL React state, so this provider starts
  // in sync with what's already painted instead of stomping on it.
  const [theme, setThemeState] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    let bc = null

    async function initTheme() {
      // ── Always fetch the DB theme to get the current version stamp ────────
      // The version stamp is a timestamp set by admin when they save the theme.
      // If the DB version is newer than what's cached in localStorage, we wipe
      // the cached user preference and apply the new admin-set default.
      // This is how theme changes propagate to ALL devices immediately.
      //
      // BUGFIX (stuck-dark on weak internet): this used to default
      // dbTheme='dark' / dbVersion='0' whenever the fetch failed or timed
      // out, then treated those FALLBACK values as if they were real DB
      // data — since '0' almost never matches a real version stamp, it
      // looked like "the admin changed the theme," forcibly overwrote the
      // correctly-applied light theme with dark, and PERSISTED that mistake
      // to localStorage. On a slow connection that keeps failing, this
      // could reapply on every load, looking permanently stuck. Fix: track
      // whether the fetch actually succeeded, and if it didn't, touch
      // nothing — leave whatever the blocking inline script already
      // painted (the correct theme) alone instead of guessing.
      let dbTheme = null
      let dbVersion = null
      let fetchOk = false
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'theme')
            .single()
          if (!error && data) {
            dbTheme   = data?.value?.mode    || 'dark'
            dbVersion = data?.value?.version || '0'
            fetchOk   = true
          }
        }
      } catch { /* network error — fetchOk stays false */ }

      if (!fetchOk) return // weak/failed connection: don't touch anything

      const cachedVersion = localStorage.getItem(LS_THEME_VER) || '0'
      const cachedTheme   = localStorage.getItem(LS_THEME)

      // If admin updated the theme (new version stamp) → clear user override
      if (dbVersion !== cachedVersion) {
        localStorage.setItem(LS_THEME_VER, dbVersion)
        localStorage.setItem(LS_THEME, dbTheme)
        setThemeState(dbTheme)
        applyTheme(dbTheme)
        return
      }

      // Same version: respect user's cached choice (or fall back to DB theme)
      const effectiveTheme = cachedTheme || dbTheme
      setThemeState(effectiveTheme)
      applyTheme(effectiveTheme)
    }

    initTheme()

    // ── BroadcastChannel: admin theme change propagates to all open tabs ─────
    // When admin saves theme in SiteSettingsTab, it broadcasts { type:'THEME_CHANGE', theme, version }
    // All open tabs on this device receive it and update instantly — no reload needed.
    try {
      bc = new BroadcastChannel('viro_theme_sync')
      bc.onmessage = (e) => {
        if (e.data?.type !== 'THEME_CHANGE') return
        const { theme: newTheme, version } = e.data
        if (!newTheme) return
        localStorage.setItem(LS_THEME, newTheme)
        localStorage.setItem(LS_THEME_VER, version || String(Date.now()))
        setThemeState(newTheme)
        applyTheme(newTheme)
      }
    } catch { /* BroadcastChannel not available in this env */ }

    return () => { try { bc?.close() } catch {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Called when user explicitly picks a theme (not admin)
  const setTheme = (t) => {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem(LS_THEME, t)
    // Don't update LS_THEME_VER — user preference sits on top of the current admin version
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, DARK, LIGHT }}>
      {children}
    </ThemeContext.Provider>
  )
}
