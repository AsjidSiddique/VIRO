'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useUserAuth } from '../../../context/UserAuthContext'
import { rpcAnon } from '../../../lib/authClient'
import AccountShell from '../../../components/AccountShell'
import { PK_CITIES } from '../../../lib/pakistanCities'

const ADDR_ICONS = { Home:'🏠', Office:'🏢', Other:'📍' }

function CityInput({ value, onChange }) {
  const [q, setQ] = useState(value||'')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const hits = q.length>1 ? PK_CITIES.filter(c=>c.toLowerCase().includes(q.toLowerCase())).slice(0,6) : []
  useEffect(() => {
    const fn = e => { if(ref.current&&!ref.current.contains(e.target))setOpen(false) }
    document.addEventListener('mousedown',fn); return ()=>document.removeEventListener('mousedown',fn)
  },[])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input value={q} onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)}
        placeholder="City *" required style={{ width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-text)',fontSize:14 }}/>
      {open&&hits.length>0&&(
        <div style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:99,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',borderRadius:12,marginTop:3,overflow:'hidden',boxShadow:'0 12px 32px rgba(0,0,0,0.4)' }}>
          {hits.map(city=>(
            <button key={city} type="button" onMouseDown={()=>{setQ(city);onChange(city);setOpen(false)}}
              style={{ display:'block',width:'100%',textAlign:'left',padding:'10px 14px',fontSize:13,color:'var(--viro-text)',background:'transparent',border:'none',borderBottom:'1px solid var(--viro-border)',cursor:'pointer' }}>
              📍 {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddressForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ label:initial?.label||'Home', name:initial?.name||'', phone:initial?.phone||'', city:initial?.city||'', address:initial?.address||'', is_default:initial?.is_default||false })
  const s = k => v => setForm(f=>({...f,[k]:v}))
  const INP = { width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-text)',fontSize:14 }
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <div style={{ display:'flex',gap:8 }}>
        {['Home','Office','Other'].map(l=>(
          <button key={l} type="button" onClick={()=>s('label')(l)} style={{ flex:1,padding:'9px',borderRadius:12,fontSize:12,fontWeight:700,border:`1.5px solid ${form.label===l?'#8B5CF6':'var(--viro-border)'}`,background:form.label===l?'#8B5CF620':'var(--viro-bgDeep)',color:form.label===l?'#A78BFA':'var(--viro-textSub)',cursor:'pointer' }}>
            {ADDR_ICONS[l]} {l}
          </button>
        ))}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        <input value={form.name} onChange={e=>s('name')(e.target.value)} placeholder="Full Name *" required style={INP}/>
        <input value={form.phone} onChange={e=>s('phone')(e.target.value)} placeholder="03XXXXXXXXX *" type="tel" required style={INP}/>
      </div>
      <CityInput value={form.city} onChange={s('city')}/>
      <textarea value={form.address} onChange={e=>s('address')(e.target.value)} placeholder="House #, Street, Mohalla, Landmark…" rows={2} required style={{...INP,resize:'none'}}/>
      <label style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,background:'var(--viro-bgDeep)',border:'1px solid var(--viro-border)',cursor:'pointer' }}>
        <input type="checkbox" checked={form.is_default} onChange={e=>s('is_default')(e.target.checked)} style={{ accentColor:'#8B5CF6',width:18,height:18 }}/>
        <div><p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:0 }}>Set as default</p><p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Auto-fills at checkout</p></div>
      </label>
      <div style={{ display:'flex',gap:10 }}>
        <button type="button" onClick={()=>onSave(form)} disabled={saving} style={{ flex:1,padding:'13px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',opacity:saving?0.7:1 }}>{saving?'Saving…':'✓ Save Address'}</button>
        <button type="button" onClick={onCancel} style={{ flex:1,padding:'13px',borderRadius:14,border:'1px solid var(--viro-border)',background:'transparent',color:'var(--viro-textSub)',fontWeight:600,fontSize:14,cursor:'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

export default function AccountAddressesClient() {
  const { user, ready } = useUserAuth()
  const [addresses, setAddresses] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editAddr,  setEditAddr]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)

  useEffect(() => { if(ready&&user) load() }, [ready,user]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try { const d=await rpcAnon('get_customer_addresses',{p_email:user.email}); setAddresses(Array.isArray(d)?d:[]) }
    catch { setAddresses([]) }
    setLoading(false)
  }
  async function save(form) {
    setSaving(true)
    try {
      await rpcAnon('upsert_customer_address',{p_email:user.email,p_label:form.label,p_name:form.name,p_phone:form.phone,p_city:form.city,p_address:form.address,p_default:form.is_default,p_addr_id:editAddr?.id||null})
      setEditAddr(null); await load(); flash('Address saved ✓',true)
    } catch(e) { flash('Error: '+e.message,false) }
    setSaving(false)
  }
  async function del(id) {
    if(!confirm('Delete this address?'))return
    try { await rpcAnon('delete_customer_address',{p_email:user.email,p_addr_id:id}); await load() } catch {}
  }
  function flash(t,ok=true){setToast({text:t,ok});setTimeout(()=>setToast(null),3000)}

  return (
    <AccountShell title="My Addresses">
      {toast&&<div style={{ margin:'10px 16px 0',padding:'10px 16px',borderRadius:14,background:toast.ok?'#10B98115':'#EF444415',border:`1px solid ${toast.ok?'#10B98140':'#EF444440'}`,color:toast.ok?'#10B981':'#EF4444',fontSize:13,fontWeight:700 }}>{toast.ok?'✅':'❌'} {toast.text}</div>}

      <div style={{ padding:'14px' }}>
        {editAddr ? (
          <>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
              <button onClick={()=>setEditAddr(null)} style={{ padding:'6px 10px',borderRadius:10,border:'1px solid var(--viro-border)',background:'transparent',color:'var(--viro-textSub)',fontSize:13,cursor:'pointer' }}>← Back</button>
              <p style={{ fontSize:15,fontWeight:800,color:'var(--viro-text)',margin:0 }}>{editAddr==='new'?'Add Address':'Edit Address'}</p>
            </div>
            <AddressForm initial={editAddr==='new'?null:editAddr} onSave={save} onCancel={()=>setEditAddr(null)} saving={saving}/>
          </>
        ) : (
          <>
            <button onClick={()=>setEditAddr('new')} style={{ width:'100%',padding:'14px',borderRadius:14,border:'1.5px dashed #8B5CF650',background:'#8B5CF608',color:'#A78BFA',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14 }}>
              ＋ Add New Address
            </button>
            {loading ? (
              <div style={{ display:'flex',justifyContent:'center',padding:'40px 0' }}>
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/><path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/></svg>
              </div>
            ) : addresses.length===0 ? (
              <div style={{ textAlign:'center',padding:'40px 24px',border:'1.5px dashed var(--viro-border)',borderRadius:16 }}>
                <div style={{ fontSize:48,marginBottom:10 }}>📭</div>
                <p style={{ fontWeight:700,color:'var(--viro-text)',margin:'0 0 4px' }}>No saved addresses</p>
                <p style={{ fontSize:13,color:'var(--viro-textSub)',margin:0 }}>Add your address to speed up checkout</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {addresses.map(addr=>(
                  <div key={addr.id} style={{ borderRadius:16,border:`1.5px solid ${addr.is_default?'#8B5CF650':'var(--viro-border)'}`,background:addr.is_default?'#8B5CF608':'var(--viro-bgCard)',padding:'14px 16px' }}>
                    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:6 }}>
                          <span style={{ fontSize:20 }}>{ADDR_ICONS[addr.label]||'📍'}</span>
                          <span style={{ fontSize:11,fontWeight:800,padding:'2px 8px',borderRadius:20,background:'#8B5CF620',color:'#A78BFA',border:'1px solid #8B5CF630' }}>{addr.label}</span>
                          {addr.is_default&&<span style={{ fontSize:10,fontWeight:700,color:'#10B981',background:'#10B98115',padding:'2px 8px',borderRadius:20,border:'1px solid #10B98130' }}>✓ Default</span>}
                        </div>
                        <p style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',margin:'0 0 2px' }}>{addr.name}</p>
                        <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:'0 0 2px' }}>{addr.phone}</p>
                        <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>📍 {addr.city} · {addr.address}</p>
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:6,flexShrink:0 }}>
                        <button onClick={()=>setEditAddr(addr)} style={{ padding:'6px 12px',borderRadius:10,border:'1px solid var(--viro-border)',background:'transparent',color:'var(--viro-textSub)',fontSize:12,fontWeight:700,cursor:'pointer' }}>✏️</button>
                        <button onClick={()=>del(addr.id)} style={{ padding:'6px 12px',borderRadius:10,border:'1px solid #EF444430',background:'#EF444410',color:'#EF4444',fontSize:12,fontWeight:700,cursor:'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
                <p style={{ fontSize:11,textAlign:'center',color:'var(--viro-textSub)',marginTop:4 }}>Default address auto-fills at checkout</p>
              </div>
            )}
          </>
        )}
      </div>
    </AccountShell>
  )
}
