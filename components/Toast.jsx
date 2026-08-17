'use client'
/* eslint-disable react-hooks/exhaustive-deps */
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { getThumb } from '../context/CartContext'

export function showToast(product) {
  window.dispatchEvent(new CustomEvent('viro-cart-toast', { detail: product }))
}

export function showSimpleToast(msg, type = 'info', duration = 3200) {
  window.dispatchEvent(new CustomEvent('viro-simple-toast', { detail: { msg, type, duration } }))
}

function CartPopup({ product, onClose }) {
  const thumb = getThumb(product.images, '/logo.jpg')
  const price = product.discount_price || product.price
  const hasDiscount = product.discount_price && product.discount_price < product.price

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Auto-close in 2 seconds
    const t = setTimeout(onClose, 500)
    return () => clearTimeout(t)
  }, [])

  return (
    // Backdrop click CLOSES it
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
      onClick={onClose}>

      <div className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', animation: 'popIn 0.25s cubic-bezier(.4,0,.2,1)' }}>

        <style>{`
          @keyframes popIn {
            from { opacity:0; transform:scale(0.85) translateY(20px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
        `}</style>

        <div className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">✓</div>
          <p className="text-white font-bold text-sm flex-1">Added to Cart!</p>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold px-1">✕</button>
        </div>

        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: '#334155' }}>
          <Image src={thumb || '/logo.jpg'} alt="" width={52} height={52} style={{ objectFit:"cover", borderRadius:8, width:52, height:52 }} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm line-clamp-2 leading-tight">{product.name}</p>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="font-extrabold text-base" style={{ color: '#7C3AED' }}>Rs.{price?.toLocaleString()}</span>
              {hasDiscount && (
                <span className="text-xs line-through" style={{ color: '#64748B' }}>Rs.{product.price?.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textMuted)', border: '1px solid var(--viro-border)' }}>
            Continue
          </button>
          <a href="/cart"
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white text-center transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
            🛒 View Cart
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Toast() {
  const [popup, setPopup] = useState(null)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function cartHandler(e) { setPopup(e.detail) }
    function simpleHandler(e) {
      const id = Date.now()
      const duration = e.detail?.duration ?? 3200
      setToasts(prev => [...prev, { id, ...e.detail }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }
    window.addEventListener('viro-cart-toast', cartHandler)
    window.addEventListener('viro-simple-toast', simpleHandler)
    return () => {
      window.removeEventListener('viro-cart-toast', cartHandler)
      window.removeEventListener('viro-simple-toast', simpleHandler)
    }
  }, [])

  return (
    <>
      {popup && <CartPopup product={popup} onClose={() => setPopup(null)} />}
      <div className="fixed top-12 left-0 right-0 z-[998] flex flex-col items-center gap-2.5 pointer-events-none px-4">
        {toasts.map(t => (
          <div key={t.id}
            className="px-5 py-4 rounded-2xl text-[15px] font-bold text-white max-w-sm w-full text-center"
            style={{
              background: t.type === 'success'
                ? 'linear-gradient(135deg,#10B981,#059669)'
                : t.type === 'warn'
                ? 'linear-gradient(135deg,#EF4444,#DC2626)'
                : 'linear-gradient(135deg,#7C3AED,#EC4899)',
              boxShadow: t.type === 'success' ? '0 10px 32px rgba(16,185,129,0.4)' : t.type === 'warn' ? '0 10px 32px rgba(239,68,68,0.4)' : '0 10px 32px rgba(124,58,237,0.4)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              lineHeight: 1.4,
              animation: 'toastIn 0.25s cubic-bezier(.4,0,.2,1)',
            }}>
            {t.msg}
          </div>
        ))}
        <style>{`@keyframes toastIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
      </div>
    </>
  )
}
