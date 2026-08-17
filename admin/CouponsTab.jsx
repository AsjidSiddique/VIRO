'use client'
import { supabase } from '../lib/supabase'
import React, { useState, useEffect } from 'react'
import { adminApi } from '../lib/adminApi'
import { showSimpleToast } from '../components/Toast'
import { useSite } from '../context/SiteSettingsContext'

function CouponsTab() {
  const { couponEnabled, setCouponEnabled } = useSite()
  const [globalToggleSaving, setGlobalToggleSaving] = useState(false)
  const [coupons, setCoupons]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [form, setForm]         = useState({
    code:'', type:'percent', value:'', min_order:'', max_uses:'', starts_at:'', expires_at:'', enabled:true
  })
  const [editId,  setEditId]    = useState(null)
  const [filter,  setFilter]    = useState('all') // 'all' | 'active' | 'expired' | 'disabled'
  const [err,     setErr]       = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCoupons(data || [])
    } catch(e) {
      // Table may not exist yet — show empty state, don't crash
      if (e.message?.includes('relation') || e.message?.includes('does not exist') || e.code === '42P01') {
        setErr('⚠️ Run viro-v46-complete.sql in Supabase to create the coupons table first.')
      }
      setCoupons([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveGlobalCouponToggle(newVal) {
    setGlobalToggleSaving(true)
    try {
      console.log('[CouponToggle] Attempting save, newVal=', newVal)

      // Try adminApi (edge function) first
      let saved = false
      try {
        const r = await adminApi('site_setting_update', { key: 'coupon_enabled', value: newVal })
        console.log('[CouponToggle] adminApi result:', r)
        if (r?.ok) saved = true
      } catch (apiErr) {
        console.warn('[CouponToggle] adminApi failed, trying direct supabase:', apiErr)
      }

      // Fallback: direct Supabase upsert
      if (!saved) {
        console.log('[CouponToggle] Trying direct supabase upsert...')
        const { data, error } = await supabase
          .from('site_settings')
          .upsert({ key: 'coupon_enabled', value: newVal, updated_at: new Date().toISOString() }, { onConflict: 'key' })
          .select()
        console.log('[CouponToggle] Supabase result data:', data, 'error:', error)
        if (error) {
          console.error('[CouponToggle] Supabase error full object:', JSON.stringify(error))
          throw new Error(error.message || error.details || error.hint || JSON.stringify(error))
        }
        saved = true
      }

      if (saved) {
        setCouponEnabled(newVal)
        showSimpleToast(newVal ? '✅ Coupon field enabled for customers' : '🚫 Coupon field hidden', 'success')
      }
    } catch (e) {
      console.error('[CouponToggle] Final catch:', e)
      const msg = typeof e === 'string' ? e
        : e instanceof Error ? e.message
        : (e?.message || e?.details || e?.hint || JSON.stringify(e) || 'Unknown error')
      showSimpleToast('Failed to save: ' + msg, 'error')
    }
    setGlobalToggleSaving(false)
  }

  function resetForm() {
    setForm({ code:'', type:'percent', value:'', min_order:'', max_uses:'', expires_at:'', enabled:true })
    setEditId(null)
    setErr('')
  }

  function startEdit(c) {
    setForm({
      code:      c.code,
      type:      c.type,
      value:     String(c.value),
      min_order: c.min_order ? String(c.min_order) : '',
      max_uses:  c.max_uses  ? String(c.max_uses)  : '',
      starts_at:  c.starts_at  ? c.starts_at.slice(0,16)  : '',
      expires_at: c.expires_at ? c.expires_at.slice(0,16) : '',
      enabled:   c.enabled,
    })
    setEditId(c.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    setErr('')
    if (!form.code.trim())  return setErr('Coupon code is required')
    if (!form.value)        return setErr('Discount value is required')
    if (form.type === 'percent' && (Number(form.value) < 1 || Number(form.value) > 100))
      return setErr('Percentage must be 1–100')

    setSaving(true)
    const payload = {
      code:       form.code.toUpperCase().trim(),
      type:       form.type,
      value:      Number(form.value),
      min_order:  Number(form.min_order) || 0,
      max_uses:   form.max_uses ? Number(form.max_uses) : null,
      starts_at:  form.starts_at  ? new Date(form.starts_at).toISOString()  : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      enabled:    form.enabled,
    }

    try {
      if (editId) {
        await adminApi('coupon_update', { id: editId, patch: payload })
        showSimpleToast('✅ Coupon updated', 'success')
      } else {
        const r = await adminApi('coupon_create', payload)
        if (!r.ok) throw new Error(r.error || 'Failed to create coupon')
        showSimpleToast('🎟️ Coupon created!', 'success')
      }
      resetForm()
      load()
    } catch(e) {
      const emsg = typeof e === 'string' ? e : (e?.message ?? JSON.stringify(e))
      setErr(emsg.includes('duplicate') ? 'Code already exists' : (emsg || 'Save failed'))
    }
    setSaving(false)
  }

  async function toggleEnabled(c) {
    await adminApi('coupon_update', { id: c.id, patch: { enabled: !c.enabled } })
    load()
  }

  async function deleteCoupon(c) {
    if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return
    await adminApi('coupon_delete', { id: c.id })
    showSimpleToast('🗑️ Coupon deleted', 'info')
    load()
  }

  // Analytics
  const totalIssued = coupons.length
  const totalUsed   = coupons.reduce((s, c) => s + (c.used_count || 0), 0)
  const activeCount = coupons.filter(c => c.enabled && (!c.expires_at || new Date(c.expires_at) > new Date())).length
  const expiredCount= coupons.filter(c => c.expires_at && new Date(c.expires_at) <= new Date()).length

  const now = new Date()
  const filtered = coupons.filter(c => {
    if (filter === 'active')   return c.enabled && (!c.expires_at || new Date(c.expires_at) > now)
    if (filter === 'expired')  return c.expires_at && new Date(c.expires_at) <= now
    if (filter === 'disabled') return !c.enabled
    return true
  })

  return (
    <div className="px-4 pb-24 space-y-4">

      {/* ── Global Coupon Visibility Toggle ── */}
      <div className="viro-card overflow-hidden" style={{ marginTop: 16 }}>
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎟️</span>
              <h3 className="font-bold text-base" style={{ color:'var(--viro-text)' }}>
                Show Coupon Field on Checkout
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={couponEnabled
                  ? { background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' }
                  : { background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                {couponEnabled ? '✅ Visible' : '🚫 Hidden'}
              </span>
            </div>
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
              {couponEnabled
                ? 'Customers see a coupon code field at checkout — they can apply any active coupon.'
                : "Coupon field is hidden. E.g. when you already have a 30% sale running and don't want extra codes applied."}
            </p>
          </div>
          {/* Big prominent toggle */}
          <button
            onClick={() => saveGlobalCouponToggle(!couponEnabled)}
            disabled={globalToggleSaving}
            className="flex-shrink-0 transition-all"
            style={{
              width: 64, height: 32, borderRadius: 16, position:'relative',
              background: couponEnabled
                ? 'linear-gradient(135deg,#10B981,#059669)'
                : '#334155',
              boxShadow: couponEnabled ? '0 0 12px #10B98150' : 'none',
              border: 'none', cursor: globalToggleSaving ? 'not-allowed' : 'pointer',
              opacity: globalToggleSaving ? 0.7 : 1,
            }}>
            <span style={{
              position:'absolute', top: 4,
              left: couponEnabled ? 36 : 4,
              width: 24, height: 24, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'left 0.2s',
              display: 'flex', alignItems:'center', justifyContent:'center',
              fontSize: 12,
            }}>
              {globalToggleSaving ? '⏳' : couponEnabled ? '✓' : '✕'}
            </span>
          </button>
        </div>
        {/* Contextual hint */}
        <div className="px-4 pb-3">
          <div className="px-3 py-2 rounded-xl text-xs"
            style={{ background: couponEnabled ? '#10B98108' : '#EF444408',
                     border: `1px solid ${couponEnabled ? '#10B98120' : '#EF444420'}` }}>
            {couponEnabled
              ? "💡 Tip: Hide this when running a sitewide sale so customers can't stack discounts."
              : '💡 Tip: Enable when you want to run a targeted promo — create a code below and share it.'}
          </div>
        </div>
      </div>

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {[
          { label:'Total Coupons', value: totalIssued, icon:'🎟️', color:'#8B5CF6' },
          { label:'Times Used',    value: totalUsed,   icon:'✅', color:'#10B981' },
          { label:'Active Now',    value: activeCount, icon:'🟢', color:'#00BFFF' },
          { label:'Expired',       value: expiredCount,icon:'⏰', color:'#F97316' },
        ].map(s => (
          <div key={s.label} className="viro-card p-3 flex flex-col items-center text-center gap-1">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Create / Edit Form ── */}
      <div className="viro-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background:'var(--viro-bgDeep)', borderColor:'var(--viro-border)' }}>
          <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
            {editId ? '✏️ Edit Coupon' : '➕ Create Coupon'}
          </h3>
          {editId && (
            <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
              ✕ Cancel Edit
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {err && (
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
              ⚠️ {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Code */}
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Coupon Code *
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g,'') }))}
                placeholder="e.g. VIRO20, EID50, SAVE100"
                disabled={!!editId}
                style={{ fontFamily:'monospace', fontWeight:700, fontSize:15, letterSpacing:'0.1em',
                         opacity: editId ? 0.7 : 1 }}
                maxLength={20}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Discount Type *
              </label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="percent">% Percentage</option>
                <option value="fixed">Rs. Fixed Amount</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                {form.type === 'percent' ? 'Discount % (1–100) *' : 'Discount Amount (Rs.) *'}
              </label>
              <input type="number" min="1" max={form.type === 'percent' ? 100 : undefined}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'percent' ? '20' : '200'} />
              {form.value && (
                <p className="text-xs mt-1 font-semibold" style={{ color:'#10B981' }}>
                  {form.type === 'percent'
                    ? `Customer saves ${form.value}% off their order`
                    : `Customer saves Rs.${Number(form.value).toLocaleString()} off`}
                </p>
              )}
            </div>

            {/* Min Order */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Min. Order (Rs.)
              </label>
              <input type="number" min="0"
                value={form.min_order}
                onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))}
                placeholder="0 = no minimum" />
            </div>

            {/* Max Uses */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Max Uses (blank = unlimited)
              </label>
              <input type="number" min="1"
                value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="e.g. 50, 100" />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Start Date & Time (optional)
              </label>
              <input type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              {form.starts_at && new Date(form.starts_at) > new Date()
                ? <p className="text-xs mt-1 font-semibold" style={{ color:'#EAB308' }}>⏳ Coupon activates on {new Date(form.starts_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                : <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Blank = active immediately</p>
              }
            </div>

            {/* Expiry */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Expiry Date & Time (optional)
              </label>
              <input type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              {!form.expires_at && <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>No expiry = valid forever</p>}
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl col-span-2 md:col-span-1"
              style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Coupon Button to Customers</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                  {form.enabled ? 'Customers will see the coupon field at checkout' : 'Hidden — customers cannot apply this coupon'}
                </p>
              </div>
              <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                className="w-12 h-6 rounded-full transition-all flex-shrink-0 relative"
                style={{ background: form.enabled ? '#10B981' : '#334155' }}>
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: form.enabled ? '26px' : '2px' }} />
              </button>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 font-bold text-sm">
            {saving ? '⏳ Saving…' : editId ? '💾 Update Coupon' : '🎟️ Create Coupon'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[['all','All'],['active','🟢 Active'],['expired','⏰ Expired'],['disabled','🔴 Disabled']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={filter === v
              ? { background:'linear-gradient(135deg,#8B5CF6,#00BFFF)', color:'#fff' }
              : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {l} {v === 'all' ? `(${coupons.length})` : ''}
          </button>
        ))}
      </div>

      {/* ── Coupon List ── */}
      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--viro-textSub)' }}>Loading coupons…</div>
      ) : filtered.length === 0 ? (
        <div className="viro-card p-8 text-center">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No coupons found</p>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Create your first coupon above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isExpired  = c.expires_at && new Date(c.expires_at) <= now
            const isFull     = c.max_uses && c.used_count >= c.max_uses
            const notStarted = c.starts_at && new Date(c.starts_at) > now
            const isActive   = c.enabled && !isExpired && !isFull && !notStarted
            const usageRatio = c.max_uses ? c.used_count / c.max_uses : 0

            return (
              <div key={c.id} className="viro-card overflow-hidden"
                style={{ borderLeft: `4px solid ${isActive ? '#10B981' : isExpired ? '#F97316' : '#EF4444'}` }}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Code + badge */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base tracking-widest" style={{ color:'var(--viro-text)', fontFamily:'monospace' }}>
                            {c.code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: isActive ? '#10B98120' : '#EF444420',
                                     color:      isActive ? '#10B981'   : '#EF4444',
                                     border: `1px solid ${isActive ? '#10B98140' : '#EF444440'}` }}>
                            {isActive ? '🟢 Active' : notStarted ? '📅 Scheduled' : isExpired ? '⏰ Expired' : isFull ? '🔴 Limit Reached' : '⛔ Disabled'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color:'var(--viro-textSub)' }}>
                          <span className="font-bold" style={{ color:'#A78BFA' }}>
                            {c.type === 'percent' ? `${c.value}% OFF` : `Rs.${c.value} OFF`}
                          </span>
                          {c.min_order > 0 && <span>Min. Rs.{c.min_order.toLocaleString()}</span>}
                          {c.expires_at && (
                            <span style={{ color: isExpired ? '#EF4444' : 'var(--viro-textSub)' }}>
                              {isExpired ? '⚠️ Expired' : '⏰ Expires'}: {new Date(c.expires_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          )}
                          {c.starts_at && new Date(c.starts_at) > new Date() && (
                            <span style={{ color:'#EAB308' }}>
                              ⏳ Starts: {new Date(c.starts_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
                            </span>
                          )}
                          {!c.expires_at && <span>⟾ No expiry</span>}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Enable/disable toggle */}
                      <button onClick={() => toggleEnabled(c)} title={c.enabled ? 'Disable' : 'Enable'}
                        className="w-10 h-5 rounded-full relative transition-all"
                        style={{ background: c.enabled ? '#10B981' : '#334155' }}>
                        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                          style={{ left: c.enabled ? '22px' : '2px' }} />
                      </button>
                      <button onClick={() => startEdit(c)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                        ✏️
                      </button>
                      <button onClick={() => deleteCoupon(c)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Usage stats */}
                  <div className="mt-3 pt-3 border-t flex items-center gap-4" style={{ borderColor:'var(--viro-border)' }}>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color:'var(--viro-textSub)' }}>
                          Used: <strong style={{ color:'var(--viro-text)' }}>{c.used_count}</strong>
                          {c.max_uses && <span style={{ color:'var(--viro-textSub)' }}> / {c.max_uses}</span>}
                        </span>
                        {c.max_uses && (
                          <span style={{ color: usageRatio > 0.8 ? '#EF4444' : 'var(--viro-textSub)' }}>
                            {Math.round(usageRatio * 100)}% used
                          </span>
                        )}
                      </div>
                      {c.max_uses ? (
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, usageRatio * 100)}%`,
                              background: usageRatio > 0.8 ? '#EF4444' : usageRatio > 0.5 ? '#F97316' : '#10B981'
                            }} />
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Unlimited uses</p>
                      )}
                    </div>
                    <div className="text-xs text-right flex-shrink-0" style={{ color:'var(--viro-textSub)' }}>
                      Created<br/>{new Date(c.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ReviewsTab — moderation panel + global settings
// ══════════════════════════════════════════════════════════════

export default CouponsTab
