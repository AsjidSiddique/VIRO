'use client'
import Portal from './Portal'
import React, { useEffect, useState } from 'react'

export default function AdminConfirmDialog() {
  const [dialog, setDialog] = useState(null)
  useEffect(() => {
    function handler(e) { setDialog(e.detail) }
    window.addEventListener('viro-admin-confirm', handler)
    return () => window.removeEventListener('viro-admin-confirm', handler)
  }, [])
  if (!dialog) return null
  return (
    <Portal>
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#1E293B', border: '1px solid #334155' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#334155' }}>
          <p className="font-bold text-white text-sm">{dialog.msg}</p>
        </div>
        <div className="flex gap-2 p-3">
          <button onClick={() => { dialog.resolve(false); setDialog(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0F172A', color: '#94A3B8', border: '1px solid #334155' }}>
            Cancel
          </button>
          <button onClick={() => { dialog.resolve(true); setDialog(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
