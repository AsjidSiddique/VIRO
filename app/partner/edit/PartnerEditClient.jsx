'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserAuth } from '../../../context/UserAuthContext'
import { usePartner } from '../../../context/PartnerContext'

const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'WhatsApp Group', "None — I'm just a loyal customer", 'Other']
const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

export default function PartnerEditClient() {
  const { user } = useUserAuth()
  const { data, reload } = usePartner()
  const router = useRouter()
  const [form, setForm] = useState({ phone: '', platform: 'Instagram', handle: '', followers: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (data?.influencer) {
      setForm({
        phone: data.influencer.phone || '', platform: data.influencer.social_platform || 'Instagram',
        handle: data.influencer.social_handle || '', followers: data.influencer.followers_estimate || '',
      })
    }
  }, [data?.influencer])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/influencer-update-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...form }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to save')
      showToast('✅ Profile updated')
      reload()
    } catch (e) {
      showToast(e.message || 'Something went wrong', 'error')
    }
    setSaving(false)
  }

  if (!data) return null

  return (
    <div className="max-w-lg mx-auto">
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg text-white text-center"
          style={{ background: toast.type === 'error' ? '#EF4444' : '#10B981', top: 'calc(env(safe-area-inset-top, 0px) + 190px)', maxWidth: '85vw', width: 'max-content' }}>
          {toast.msg}
        </div>
      )}
      <h1 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--viro-text)' }}>✏️ Edit My Info</h1>

      <div className="p-5 space-y-3.5" style={CARD}>
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)' }}>
          Signed in as <b style={{ color: 'var(--viro-text)' }}>{user?.email}</b> — coupon and commission rate are set by Viro and can't be edited here.
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Phone</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="03XX XXXXXXX" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Platform</label>
          <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Handle</label>
          <input type="text" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="@yourusername" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--viro-textSub)' }}>Rough Follower Count</label>
          <input type="text" value={form.followers} onChange={e => setForm(f => ({ ...f, followers: e.target.value }))} placeholder="e.g. 5k-10k" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => router.push('/partner')}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: '#8B5CF6', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
