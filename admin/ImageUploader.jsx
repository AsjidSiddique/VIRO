'use client'
/* eslint-disable @next/next/no-img-element */
import React, { useRef, useState } from 'react'
import { uploadProductImage, deleteProductImage } from '../lib/storage'

// onRemoveUrl(url) — optional callback fired after a thumbnail ✕ is clicked.
// Use it to immediately update the DB record (e.g. update product_colors.images)
// so the removed image doesn't reappear if the page is refreshed before Save.
// productCount: optional — passed from admin to name files as product-18-name.webp
function ImageUploader({ images, onChange, onRemoveUrl, productCount }) {
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
        const url = await uploadProductImage(fileArr[i], productCount)
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
    // 1. Delete file from Supabase storage
    deleteProductImage(removed).catch(() => {})
    const next = images.filter((_, i) => i !== idx)
    // 2. Update parent form state
    onChange(next)
    // 3. Immediately update DB record if caller provided a hook
    //    (e.g. update product_colors.images column so DB stays in sync
    //     even before the admin clicks Save)
    if (onRemoveUrl) {
      try { onRemoveUrl(removed, next) } catch {}
    }
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

export default ImageUploader
