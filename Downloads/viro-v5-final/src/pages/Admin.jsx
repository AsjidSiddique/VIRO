import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadProductImage, deleteProductImage } from '../lib/storage'
import { ORDER_STATUSES } from '../lib/constants'

const TABS = ['Products', 'Add Product', 'Orders']

// ─────────────────────────────────────────────────────────────
// Image Uploader Component
// ─────────────────────────────────────────────────────────────
function ImageUploader({ images, onChange }) {
  const inputRef              = useRef()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState([])   // per-file status
  const [dragOver, setDragOver]   = useState(false)

  async function handleFiles(files) {
    if (!files?.length) return
    const fileArr = Array.from(files)
    setUploading(true)
    setProgress(fileArr.map(f => ({ name: f.name, status: 'uploading' })))

    const uploaded = []
    for (let i = 0; i < fileArr.length; i++) {
      try {
        const url = await uploadProductImage(fileArr[i])
        uploaded.push(url)
        setProgress(p => p.map((x, idx) => idx === i ? { ...x, status: 'done', url } : x))
      } catch (e) {
        setProgress(p => p.map((x, idx) => idx === i ? { ...x, status: 'error', msg: e.message } : x))
      }
    }

    onChange([...images, ...uploaded])
    setUploading(false)
    setTimeout(() => setProgress([]), 2500)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function removeImage(idx) {
    const removed = images[idx]
    // Optionally delete from bucket too — comment out if you want to keep originals
    deleteProductImage(removed).catch(() => {})
    onChange(images.filter((_, i) => i !== idx))
  }

  function moveLeft(idx) {
    if (idx === 0) return
    const arr = [...images]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChange(arr)
  }
  function moveRight(idx) {
    if (idx === images.length - 1) return
    const arr = [...images]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChange(arr)
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl cursor-pointer transition-all py-8 px-4 text-center"
        style={{
          border: `2px dashed ${dragOver ? '#8B5CF6' : '#1E2A45'}`,
          background: dragOver ? '#8B5CF610' : '#0A0E1A',
        }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
              <path className="opacity-80" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm text-purple-400 font-semibold">Uploading…</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#00BFFF15,#8B5CF620)' }}>
              📸
            </div>
            <p className="text-sm font-semibold text-white">Tap to upload images</p>
            <p className="text-xs text-slate-500">or drag & drop • JPG, PNG, WEBP • multiple allowed</p>
            <p className="text-xs text-slate-600">Uploads to <span className="text-purple-400 font-mono">products_img</span> bucket</p>
          </>
        )}
      </div>

      {/* Per-file progress */}
      {progress.length > 0 && (
        <div className="space-y-1.5">
          {progress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{
                background: p.status === 'done' ? '#10B98115' : p.status === 'error' ? '#EF444415' : '#8B5CF615',
                border: `1px solid ${p.status === 'done' ? '#10B98140' : p.status === 'error' ? '#EF444440' : '#8B5CF640'}`,
              }}>
              <span>{p.status === 'done' ? '✅' : p.status === 'error' ? '❌' : '⏳'}</span>
              <span className="flex-1 truncate text-slate-300">{p.name}</span>
              {p.status === 'error' && <span className="text-red-400">{p.msg}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded images grid */}
      {images.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            {images.length} image{images.length > 1 ? 's' : ''} · drag thumbnails to reorder · first = thumbnail
          </p>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={url} className="relative group flex-shrink-0">
                <img src={url} alt=""
                  className="w-20 h-20 rounded-xl object-cover border-2 transition-all"
                  style={{ borderColor: i === 0 ? '#8B5CF6' : '#1E2A45' }} />

                {/* Badge for first */}
                {i === 0 && (
                  <span className="absolute -top-1.5 -left-1.5 text-xs bg-purple-600 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                    cover
                  </span>
                )}

                {/* Controls */}
                <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <div className="flex gap-1">
                    <button onClick={() => moveLeft(i)} disabled={i === 0}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs disabled:opacity-30 flex items-center justify-center">
                      ←
                    </button>
                    <button onClick={() => moveRight(i)} disabled={i === images.length - 1}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs disabled:opacity-30 flex items-center justify-center">
                      →
                    </button>
                  </div>
                  <button onClick={() => removeImage(i)}
                    className="w-6 h-6 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Admin Login
// ─────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: dbErr } = await supabase
      .from('admin_credentials')
      .select('id, username')
      .eq('username', username.trim())
      .eq('password_hash', password)
      .single()

    if (dbErr || !data) {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }

    const token = crypto.randomUUID()
    await supabase.from('admin_sessions').insert({ token })
    localStorage.setItem('viro_admin_token', token)
    localStorage.setItem('viro_admin_user', data.username)
    onLogin(data.username)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 30% 40%, #00BFFF0A 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, #8B5CF615 0%, transparent 50%), #0A0E1A' }}>
      <div className="w-full max-w-sm slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img src="/logo.jpg" alt="Viro" className="w-20 h-20 rounded-2xl object-cover"
              style={{ boxShadow: '0 0 40px #8B5CF640' }} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>🔐</div>
          </div>
          <h1 className="font-display text-2xl font-extrabold gradient-text">Admin Panel</h1>
          <p className="text-slate-500 text-sm mt-1">viro.pk — Secure Access</p>
        </div>

        <div className="viro-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">👤</span>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="admin" required autoComplete="username"
                  style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔑</span>
                <input type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-red-400 fade-in"
                style={{ background: '#EF444415', border: '1px solid #EF444440' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base font-bold mt-2">
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in...
                  </span>
                : '🔐 Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">VIRO — VALUE | VARIETY | VISION</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Admin export
// ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [authed, setAuthed]     = useState(false)
  const [adminUser, setAdminUser] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const token = localStorage.getItem('viro_admin_token')
      const user  = localStorage.getItem('viro_admin_user')
      if (!token) { setChecking(false); return }

      const { data } = await supabase
        .from('admin_sessions')
        .select('id, expires_at')
        .eq('token', token)
        .single()

      if (data && new Date(data.expires_at) > new Date()) {
        setAuthed(true)
        setAdminUser(user || 'admin')
      } else {
        localStorage.removeItem('viro_admin_token')
        localStorage.removeItem('viro_admin_user')
      }
      setChecking(false)
    }
    checkSession()
  }, [])

  async function handleLogout() {
    const token = localStorage.getItem('viro_admin_token')
    if (token) await supabase.from('admin_sessions').delete().eq('token', token)
    localStorage.removeItem('viro_admin_token')
    localStorage.removeItem('viro_admin_user')
    setAuthed(false)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.jpg" alt="Viro" className="w-16 h-16 rounded-xl object-cover animate-pulse" />
        <p className="text-slate-500 text-sm">Checking session…</p>
      </div>
    </div>
  )

  if (!authed) return <AdminLogin onLogin={u => { setAuthed(true); setAdminUser(u) }} />
  return <AdminDashboard adminUser={adminUser} onLogout={handleLogout} />
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
function AdminDashboard({ adminUser, onLogout }) {
  const [tab, setTab]               = useState('Products')
  const [products, setProducts]     = useState([])
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [stats, setStats]           = useState({ products: 0, orders: 0, revenue: 0, unpaid: 0 })

  const emptyForm = { name: '', description: '', price: '', discount_price: '', stock: '', images: [] }
  const [form, setForm] = useState(emptyForm)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(name))')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const [{ count: pCount }, { count: oCount }, { data: rev }, { count: unpaid }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('final_total').neq('status', 'CANCELLED'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'UNPAID'),
    ])
    const revenue = (rev || []).reduce((s, o) => s + (o.final_total || 0), 0)
    setStats({ products: pCount || 0, orders: oCount || 0, revenue, unpaid: unpaid || 0 })
  }, [])

  useEffect(() => {
    loadStats()
    if (tab === 'Products') loadProducts()
    if (tab === 'Orders')   loadOrders()
  }, [tab])

  function resetForm() {
    setForm(emptyForm)
    setEditProduct(null)
  }

  function startEdit(product) {
    const imgs = Array.isArray(product.images) ? product.images
      : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
    setForm({
      name:           product.name || '',
      description:    product.description || '',
      price:          product.price || '',
      discount_price: product.discount_price || '',
      stock:          product.stock || '',
      images:         imgs,
    })
    setEditProduct(product)
    setTab('Add Product')
    window.scrollTo(0, 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.images.length === 0) {
      alert('Please upload at least one product image.')
      return
    }
    setLoading(true)
    const payload = {
      name:           form.name,
      description:    form.description,
      price:          parseFloat(form.price),
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      stock:          parseInt(form.stock) || 0,
      images:         form.images,
    }
    let err
    if (editProduct) {
      ;({ error: err } = await supabase.from('products').update(payload).eq('id', editProduct.id))
    } else {
      ;({ error: err } = await supabase.from('products').insert(payload))
    }
    setLoading(false)
    if (err) { alert('Error: ' + err.message); return }
    alert(editProduct ? '✅ Product updated!' : '✅ Product added!')
    resetForm()
    setTab('Products')
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    await supabase.from('products').delete().eq('id', id)
    loadProducts()
    loadStats()
  }

  async function updateOrderStatus(orderId, status) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    loadOrders()
    loadStats()
  }

  const statusColors = {
    UNPAID: '#F97316', CONFIRMED: '#8B5CF6', PROCESSING: '#00BFFF',
    SHIPPED: '#3B82F6', DELIVERED: '#10B981', CANCELLED: '#EF4444',
  }

  return (
    <div className="pb-6 min-h-screen">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between sticky top-10 z-30"
        style={{ borderColor: '#1E2A45', background: '#0A0E1A' }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Viro" className="w-9 h-9 rounded-xl object-cover" />
          <div>
            <h1 className="font-display text-base font-bold text-white leading-tight">Admin Panel</h1>
            <p className="text-xs text-slate-500">👤 {adminUser}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#EF444415', color: '#F87171', border: '1px solid #EF444430' }}>
          🚪 Logout
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Products', value: stats.products,                              icon: '📦', color: '#00BFFF' },
            { label: 'Orders',   value: stats.orders,                                icon: '📋', color: '#8B5CF6' },
            { label: 'Revenue',  value: `${(stats.revenue/1000).toFixed(1)}k`,       icon: '💰', color: '#10B981' },
            { label: 'Unpaid',   value: stats.unpaid,                                icon: '⚠️', color: '#F97316' },
          ].map(s => (
            <div key={s.label} className="viro-card p-3 text-center">
              <div className="text-lg">{s.icon}</div>
              <div className="font-extrabold text-base leading-tight" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 pt-3 pb-3 gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => { resetForm(); setTab(t) }}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === t ? {
              background: 'linear-gradient(135deg,#00BFFF,#8B5CF6)', color: '#fff'
            } : { background: '#0F1629', color: '#94A3B8', border: '1px solid #1E2A45' }}>
            {t === 'Products' ? '📦' : t === 'Add Product' ? '➕' : '📋'} {t}
          </button>
        ))}
      </div>

      {/* ── PRODUCTS ── */}
      {tab === 'Products' && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">{products.length} products</p>
            <button onClick={() => setTab('Add Product')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
              ➕ Add New
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">📦</div>
              <p className="font-semibold text-white">No products yet</p>
              <button onClick={() => setTab('Add Product')} className="btn-primary mt-4 mx-auto px-6 py-2 text-sm">
                Add First Product
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(p => {
                const imgs = Array.isArray(p.images) ? p.images
                  : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : [])
                const thumb = imgs[0] || 'https://placehold.co/100x100/0F1629/8B5CF6?text=V'
                const hasDiscount = p.discount_price && p.discount_price < p.price
                return (
                  <div key={p.id} className="viro-card p-3 flex gap-3 items-center">
                    <div className="relative flex-shrink-0">
                      <img src={thumb} alt={p.name} className="w-14 h-14 rounded-xl object-cover" />
                      {imgs.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 text-xs bg-slate-800 text-slate-400 rounded-full w-5 h-5 flex items-center justify-center border border-slate-700">
                          {imgs.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#00BFFF' }}>
                          Rs. {(hasDiscount ? p.discount_price : p.price)?.toLocaleString()}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-slate-500 line-through">Rs. {p.price?.toLocaleString()}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.stock > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                          {p.stock > 0 ? `${p.stock} pcs` : 'Out of stock'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#8B5CF620', border: '1px solid #8B5CF640', color: '#A78BFA' }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => deleteProduct(p.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#EF444415', border: '1px solid #EF444430', color: '#F87171' }}>
                        🗑️ Del
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT PRODUCT ── */}
      {tab === 'Add Product' && (
        <div className="px-4">
          <div className="viro-card p-4">
            <h2 className="font-bold text-white mb-1">
              {editProduct ? '✏️ Edit Product' : '➕ Add New Product'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Images upload directly to your <span className="text-purple-400 font-mono">products_img</span> Supabase bucket
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Images — first so admin thinks about visuals first */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Product Images *
                </label>
                <ImageUploader
                  images={form.images}
                  onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Product Name *</label>
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Samsung Galaxy Buds Pro" required />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the product…" rows={3} style={{ resize: 'none' }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Original Price (Rs.) *
                  </label>
                  <input type="number" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="2000" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Discount Price <span className="normal-case font-normal text-slate-600">(optional)</span>
                  </label>
                  <input type="number" value={form.discount_price}
                    onChange={e => setForm(f => ({ ...f, discount_price: e.target.value }))}
                    placeholder="1500" min="0" step="0.01" />
                </div>
              </div>

              {/* Live price preview */}
              {form.price && (
                <div className="p-3 rounded-xl fade-in" style={{ background: '#080C18', border: '1px solid #1E2A45' }}>
                  <p className="text-xs text-slate-500 mb-2">👁️ Customer sees:</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xl font-extrabold" style={{ color: '#00BFFF' }}>
                      Rs. {parseFloat(form.discount_price || form.price || 0).toLocaleString()}
                    </span>
                    {form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price) && (
                      <>
                        <span className="text-slate-500 line-through text-sm">
                          Rs. {parseFloat(form.price).toLocaleString()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
                          style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
                          -{Math.round((1 - parseFloat(form.discount_price) / parseFloat(form.price)) * 100)}% OFF
                        </span>
                        <span className="text-xs text-emerald-400">
                          Save Rs. {(parseFloat(form.price) - parseFloat(form.discount_price)).toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Stock Quantity *</label>
                <input type="number" value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="50" min="0" required />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3.5 font-bold">
                  {loading
                    ? <span className="flex items-center gap-2 justify-center">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Saving…
                      </span>
                    : editProduct ? '✅ Update Product' : '➕ Add Product'}
                </button>
                {editProduct && (
                  <button type="button" onClick={resetForm} className="btn-ghost px-5 py-3 text-sm">Cancel</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === 'Orders' && (
        <div className="px-4">
          <p className="text-sm text-slate-400 mb-3">{orders.length} total orders</p>

          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">📋</div>
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="viro-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 font-mono">#{order.id?.slice(0,8).toUpperCase()}</p>
                      <p className="font-bold text-white text-sm">{order.customers?.name}</p>
                      <p className="text-xs text-slate-400">{order.customers?.phone} · {order.customers?.city}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">{order.customers?.address}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-lg" style={{ color: '#00BFFF' }}>
                        Rs. {order.final_total?.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.delivery_charges === 0 ? '🎉 Free del.' : `+Rs.${order.delivery_charges} del.`}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'2-digit' })}
                      </div>
                    </div>
                  </div>

                  {order.order_items?.length > 0 && (
                    <div className="mb-3 p-2 rounded-xl" style={{ background: '#080C18' }}>
                      {order.order_items.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-slate-400 py-0.5">
                          <span className="truncate flex-1 mr-2">{item.products?.name || 'Product'} ×{item.quantity}</span>
                          <span className="flex-shrink-0">Rs. {(item.price * item.quantity)?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                      style={{
                        background: (statusColors[order.status] || '#94A3B8') + '20',
                        color: statusColors[order.status] || '#94A3B8',
                        border: `1px solid ${(statusColors[order.status] || '#94A3B8')}40`,
                      }}>
                      {order.status}
                    </span>
                    <select value={order.status}
                      onChange={e => updateOrderStatus(order.id, e.target.value)}
                      className="flex-1 rounded-lg text-xs" style={{ padding: '6px 10px' }}>
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <a href={`tel:${order.customers?.phone}`}
                      className="flex-1 text-center py-2 rounded-xl text-xs font-semibold"
                      style={{ background: '#00BFFF15', color: '#00BFFF', border: '1px solid #00BFFF30' }}>
                      📞 Call
                    </a>
                    <a href={`https://wa.me/92${order.customers?.phone?.replace(/^0/, '')}?text=${encodeURIComponent(`Hi ${order.customers?.name}! Your Viro order #${order.id?.slice(0,8).toUpperCase()} status: ${order.status}`)}`}
                      target="_blank" rel="noopener"
                      className="flex-1 text-center py-2 rounded-xl text-xs font-semibold"
                      style={{ background: '#25D36615', color: '#25D366', border: '1px solid #25D36630' }}>
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
