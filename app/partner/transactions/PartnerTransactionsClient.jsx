'use client'
import React, { useState } from 'react'
import { usePartner } from '../../../context/PartnerContext'

const CARD = { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 16 }

export default function PartnerTransactionsClient() {
  const { data } = usePartner()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  if (!data) return null

  // Orders and bonuses are conceptually different things — a bonus isn't a
  // referred order, so it's kept out of order-counting stats below, but
  // still shows in the same chronological list (tagged "🎁 Bonus") so a
  // partner can see exactly where every rupee of their balance came from.
  const orders = data.ledger.filter(r => !r.is_adjustment)
  const bonuses = data.ledger.filter(r => r.is_adjustment)

  let filtered = data.ledger
  if (filter !== 'all') {
    filtered = filter === 'bonus' ? bonuses : orders.filter(r => r.commission_status === filter)
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter(r => (r.order_short_id?.toLowerCase().includes(q)) || (r.note?.toLowerCase().includes(q)))
  }

  const totals = {
    all: data.ledger.length,
    released: orders.filter(r => r.commission_status === 'released').length,
    pending: orders.filter(r => r.commission_status === 'pending').length,
    voided: orders.filter(r => r.commission_status === 'voided').length,
    bonus: bonuses.length,
  }

  function downloadStatement() {
    const headers = ['Type', 'Order ID', 'Date', 'Order Total', 'Amount', 'Status', 'Note']
    const rows = data.ledger.map(r => [
      r.is_adjustment ? 'Bonus/Adjustment' : 'Order',
      r.order_short_id || '', r.order_date ? new Date(r.order_date).toISOString().slice(0, 10) : '',
      r.order_total ?? '', r.commission_amount, r.commission_status, r.note || '',
    ])
    const csv = [headers, ...rows].map(row => row.map(f => {
      const str = String(f ?? '')
      return (str.includes(',') || str.includes('"')) ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `viro-partner-statement-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const totalEarned = data.ledger.filter(r => r.commission_status === 'released').reduce((s, r) => s + Number(r.commission_amount || 0), 0)
  const totalRevenue = orders.filter(r => r.commission_status !== 'voided').reduce((s, r) => s + Number(r.order_total || 0), 0)

  const FILTERS = [
    ['all', 'All', totals.all],
    ['released', '✅ Released', totals.released],
    ['pending', '⏳ Pending', totals.pending],
    ['voided', '✕ Voided', totals.voided],
    ['bonus', '🎁 Bonuses & Spends', totals.bonus],
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--viro-text)' }}>📊 Transaction History</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Every order and bonus that's added to your balance</p>
        </div>
        {data.ledger.length > 0 && (
          <button onClick={downloadStatement}
            className="text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 flex-shrink-0"
            style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', color: '#8B5CF6' }}>
            ⬇ <span className="hidden sm:inline">Download</span>
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3.5 text-center rounded-2xl" style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
          <p className="text-xl font-extrabold" style={{ color: 'var(--viro-text)' }}>{orders.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Orders</p>
        </div>
        <div className="p-3.5 text-center rounded-2xl" style={{ background: '#7C3AED10', border: '1px solid #7C3AED30' }}>
          <p className="text-xl font-extrabold" style={{ color: '#7C3AED' }}>Rs.{totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Revenue Driven</p>
        </div>
        <div className="p-3.5 text-center rounded-2xl" style={{ background: '#10B98110', border: '1px solid #10B98130' }}>
          <p className="text-xl font-extrabold" style={{ color: '#10B981' }}>Rs.{totalEarned.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'var(--viro-textSub)' }}>Total Earned</p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {FILTERS.map(([k, l, count]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors"
            style={{ background: filter === k ? '#8B5CF6' : 'var(--viro-bgCard)', color: filter === k ? '#fff' : 'var(--viro-textSub)', border: '1px solid ' + (filter === k ? '#8B5CF6' : 'var(--viro-border)') }}>
            {l} ({count})
          </button>
        ))}
        {data.ledger.length > 5 && (
          <input type="text" placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="text-xs ml-auto" style={{ width: 140, padding: '6px 10px' }} />
        )}
      </div>

      {/* List */}
      <div className="p-3.5 rounded-2xl" style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
        {data.ledger.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">🛍️</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--viro-text)' }}>No transactions yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--viro-textSub)' }}>Share your coupon to get started!</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--viro-textSub)' }}>No transactions match this filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((row, i) => (
              <div key={row.order_short_id || `${row.order_date}-${i}`}
                className="flex items-center justify-between px-3.5 py-3 rounded-xl"
                style={{ background: row.is_adjustment ? '#F59E0B0d' : 'var(--viro-bgDeep)', border: row.is_adjustment ? '1px dashed #F59E0B40' : '1px solid transparent' }}>
                {row.is_adjustment ? (
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: Number(row.commission_amount) < 0 ? '#EF4444' : '#B45309' }}>
                      {Number(row.commission_amount) < 0 ? '🛒' : '🎁'} {row.note || 'Bonus / Adjustment'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>
                      {row.order_date ? new Date(row.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>#{row.order_short_id || '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>
                      {row.order_date ? new Date(row.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} · Order total Rs.{Number(row.order_total || 0).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-extrabold" style={{ color: Number(row.commission_amount) < 0 ? '#EF4444' : row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B' }}>
                    {Number(row.commission_amount) >= 0 ? '+' : ''}Rs.{Number(row.commission_amount || 0).toLocaleString()}
                  </p>
                  <p className="text-[10.5px] font-semibold" style={{ color: row.commission_status === 'released' ? '#10B981' : row.commission_status === 'voided' ? '#94A3B8' : '#F59E0B' }}>
                    {row.is_adjustment
                      ? (Number(row.commission_amount) >= 0 ? '✅ Credited' : '✕ Deducted')
                      : (row.commission_status === 'released' ? '✅ Released' : row.commission_status === 'voided' ? '✕ Voided' : `⏳ ${row.order_status || 'Pending'}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
