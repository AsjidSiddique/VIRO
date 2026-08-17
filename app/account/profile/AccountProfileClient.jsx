'use client'
import React, { useState, useEffect } from 'react'
import { useUserAuth } from '../../../context/UserAuthContext'
import { rpcAnon } from '../../../lib/authClient'
import AccountShell from '../../../components/AccountShell'

const GENDER_OPT = [
  { v:'male',   l:'Male',   icon:'♂️' },
  { v:'female', l:'Female', icon:'♀️' },
]

export default function AccountProfileClient() {
  const { user, profile, ready, signOut, refreshProfile, updateUser } = useUserAuth()
  const [name,    setName]    = useState('')
  const [gender,  setGender]  = useState('')
  const [dob,     setDob]     = useState('')
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)
  const [toast,   setToast]   = useState(null)

  useEffect(() => {
    if (!ready || !user) return
    setName(user.name||'')
    refreshProfile(user.email)
  }, [ready, user]) // eslint-disable-line

  useEffect(() => {
    if (!profile) return
    setGender(profile.gender||'')
    setDob(profile.dob||'')
  }, [profile])

  async function save() {
    setSaving(true)
    try {
      await rpcAnon('update_customer_profile',{ p_email:user.email, p_name:name, p_gender:gender||null, p_dob:dob||null })
      updateUser({ name })
      setDirty(false)
      flash('Profile updated ✓', true)
    } catch(e) { flash('Error: '+e.message, false) }
    setSaving(false)
  }
  function flash(t,ok=true){setToast({text:t,ok});setTimeout(()=>setToast(null),3000)}

  const completeness = [name,gender,dob].filter(Boolean).length
  const pct = Math.round((completeness/3)*100)

  return (
    <AccountShell title="Profile Settings">
      {toast&&<div style={{ margin:'10px 16px 0',padding:'10px 16px',borderRadius:14,background:toast.ok?'#10B98115':'#EF444415',border:`1px solid ${toast.ok?'#10B98140':'#EF444440'}`,color:toast.ok?'#10B981':'#EF4444',fontSize:13,fontWeight:700 }}>{toast.ok?'✅':'❌'} {toast.text}</div>}

      <div style={{ padding:'20px 16px',maxWidth:480 }}>
        {/* Completeness */}
        {pct < 100 && (
          <div style={{ marginBottom:20,padding:'12px 16px',borderRadius:16,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:0 }}>Profile {pct}% complete</p>
              <p style={{ fontSize:11,color:'var(--viro-textSub)',margin:0 }}>Fill all fields</p>
            </div>
            <div style={{ height:6,borderRadius:3,background:'var(--viro-bgDeep)',overflow:'hidden' }}>
              <div style={{ width:`${pct}%`,height:'100%',background:'linear-gradient(90deg,#8B5CF6,#10B981)',borderRadius:3,transition:'width 0.5s' }}/>
            </div>
          </div>
        )}

        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {/* Avatar */}
          <div style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:16,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)' }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width:60,height:60,borderRadius:'50%',border:'2.5px solid #8B5CF6',flexShrink:0 }}/>
              : <div style={{ width:60,height:60,borderRadius:'50%',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,color:'#fff',flexShrink:0 }}>
                  {(name||user?.email||'U')[0].toUpperCase()}
                </div>
            }
            <div>
              <p style={{ fontSize:15,fontWeight:700,color:'var(--viro-text)',margin:'0 0 2px' }}>{name||'My Account'}</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:'0 0 4px' }}>{user?.email}</p>
              <span style={{ fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20,background:'#10B98120',color:'#10B981',border:'1px solid #10B98140' }}>🟢 Google Account</span>
            </div>
          </div>

          {/* Name */}
          <div>
            <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--viro-textSub)',margin:'0 0 6px' }}>Display Name</p>
            <input value={name} onChange={e=>{setName(e.target.value);setDirty(true)}} placeholder="Your full name"
              style={{ width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-text)',fontSize:15,fontWeight:600 }}/>
          </div>

          {/* Email readonly */}
          <div>
            <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--viro-textSub)',margin:'0 0 6px' }}>Google Email</p>
            <div style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span style={{ flex:1,fontSize:14,color:'var(--viro-textSub)' }}>{user?.email}</span>
              <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,background:'#10B98115',color:'#10B981',border:'1px solid #10B98130' }}>✓ Verified</span>
            </div>
          </div>

          {/* Gender */}
          <div>
            <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--viro-textSub)',margin:'0 0 8px' }}>Gender</p>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              {GENDER_OPT.map(g=>(
                <button key={g.v} onClick={()=>{setGender(g.v);setDirty(true)}} type="button"
                  style={{ padding:'13px 14px',borderRadius:14,fontSize:14,fontWeight:700,textAlign:'left',cursor:'pointer',border:`1.5px solid ${gender===g.v?'#8B5CF6':'var(--viro-border)'}`,background:gender===g.v?'#8B5CF618':'var(--viro-bgDeep)',color:gender===g.v?'#A78BFA':'var(--viro-textSub)' }}>
                  <span style={{ marginRight:8,fontSize:16 }}>{g.icon}</span>{g.l}
                  {gender===g.v&&<span style={{ float:'right',color:'#8B5CF6' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* DOB */}
          <div>
            <p style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--viro-textSub)',margin:'0 0 6px' }}>Date of Birth</p>
            <input type="date" value={dob} onChange={e=>{setDob(e.target.value);setDirty(true)}}
              style={{ width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid var(--viro-border)',background:'var(--viro-bgDeep)',color:'var(--viro-text)',fontSize:14 }}/>
          </div>

          <button onClick={save} disabled={saving||!dirty}
            style={{ padding:'14px',borderRadius:14,border:'none',background:dirty?'linear-gradient(135deg,#8B5CF6,#6366f1)':'var(--viro-bgDeep)',color:dirty?'#fff':'var(--viro-textSub)',fontWeight:800,fontSize:15,cursor:dirty?'pointer':'not-allowed',opacity:saving?0.7:1,boxShadow:dirty?'0 6px 20px rgba(139,92,246,0.35)':'none' }}>
            {saving?'⏳ Saving…':dirty?'✓ Save Changes':'No changes'}
          </button>

          <div style={{ paddingTop:8,borderTop:'1px solid var(--viro-border)' }}>
            <button onClick={async()=>{await signOut();window.location.href='/'}}
              style={{ width:'100%',padding:'13px',borderRadius:14,border:'1px solid #EF444430',background:'#EF444412',color:'#EF4444',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>
    </AccountShell>
  )
}
