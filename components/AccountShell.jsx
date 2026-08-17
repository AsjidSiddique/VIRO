'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUserAuth } from '../context/UserAuthContext'
import GoogleSignInButton from './GoogleSignInButton'

const ACCOUNT_NAV = [
  { href:'/account',                  icon:'🏠', label:'Home',      exact:true },
  { href:'/account/orders',           icon:'📦', label:'Orders'              },
  { href:'/account/reviews',          icon:'⭐', label:'Reviews'             },
  { href:'/account/addresses',        icon:'📍', label:'Addresses'           },
  { href:'/account/recently-viewed',  icon:'👁️', label:'Viewed'              },
  { href:'/account/profile',          icon:'👤', label:'Profile'             },
  { href:'/account/help',             icon:'💬', label:'Help'                },
]

function AccountContent({ children, title }) {
  const { user, signIn, signOut, ready } = useUserAuth()
  const pathname = usePathname()
  const router   = useRouter()

  if (ready && !user) return (
    <div style={{ minHeight:'60vh', background:'var(--viro-sectionBg)', paddingBottom:100 }}>
      <div style={{ background:'linear-gradient(160deg,#1e1b4b,#0f172a)', padding:'52px 24px 44px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-60,right:-60,width:220,height:220,borderRadius:'50%',background:'radial-gradient(circle,#8B5CF640,transparent 70%)',pointerEvents:'none' }}/>
        <div style={{ width:76,height:76,borderRadius:'50%',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',margin:'0 auto 18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,boxShadow:'0 8px 32px rgba(139,92,246,0.4)' }}>👤</div>
        <h1 style={{ fontSize:24,fontWeight:900,color:'#fff',margin:'0 0 10px' }}>My Account</h1>
        <p style={{ fontSize:14,color:'#94A3B8',margin:'0 0 30px',lineHeight:1.7 }}>
          Sign in with Google to track orders,<br/>save addresses and manage your profile.
        </p>
        <div style={{ maxWidth:340,margin:'0 auto 12px' }}>
          <GoogleSignInButton onSignIn={()=>signIn(pathname||'/account')} size="lg"/>
        </div>
        <p style={{ fontSize:11,color:'#334155' }}>No account needed for COD checkout</p>
      </div>
      <div style={{ padding:'20px',maxWidth:480,margin:'0 auto' }}>
        {[
          { icon:'📦',title:'Track All Orders',      desc:'Live status across all devices instantly'     },
          { icon:'⭐',title:'Review Products',        desc:'Rate delivered items, help other shoppers'   },
          { icon:'📍',title:'Save Addresses',         desc:'Multiple addresses, auto-fill at checkout'   },
          { icon:'💰',title:'Price Drop Alerts',      desc:'Know when wishlist items go on sale'          },
          { icon:'👁️',title:'Recently Viewed',        desc:'Never lose track of products you liked'      },
          { icon:'🔒',title:'One-tap Google Login',   desc:'No password needed'                          },
        ].map(f => (
          <div key={f.title} style={{ display:'flex',alignItems:'center',gap:14,padding:'13px',marginBottom:8,borderRadius:16,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)' }}>
            <div style={{ fontSize:24,width:44,height:44,borderRadius:12,background:'var(--viro-bgDeep)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{f.icon}</div>
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)',margin:'0 0 1px' }}>{f.title}</p>
              <p style={{ fontSize:12,color:'var(--viro-textSub)',margin:0 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (!ready) return (
    <div style={{ minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3" opacity="0.25"/>
        <path fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z" opacity="0.75"/>
      </svg>
    </div>
  )

  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'60vh' }}>
      {/* Account header bar */}
      <div style={{ background:'linear-gradient(160deg,#1e1b4b,#0f172a)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'radial-gradient(circle,#8B5CF620,transparent 70%)',pointerEvents:'none' }}/>

        {/* Desktop: max-width centred layout */}
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 16px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 0',position:'relative' }}>
            {pathname !== '/account' && (
              <button onClick={()=>router.back()}
                style={{ background:'rgba(255,255,255,0.08)',border:'none',borderRadius:10,padding:'6px 10px',color:'#94A3B8',cursor:'pointer',fontSize:16,flexShrink:0 }}>
                ←
              </button>
            )}
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width:38,height:38,borderRadius:'50%',border:'2px solid #8B5CF6',display:'block',flexShrink:0 }}/>
              : <div style={{ width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:900,color:'#fff',flexShrink:0 }}>
                  {(user.name||user.email||'U')[0].toUpperCase()}
                </div>
            }
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:14,fontWeight:800,color:'#fff',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{title}</p>
              <p style={{ fontSize:11,color:'#64748B',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.name||user.email}</p>
            </div>
            <button onClick={async()=>{await signOut();router.push('/')}}
              style={{ flexShrink:0,padding:'5px 10px',borderRadius:16,border:'1px solid #EF444430',background:'#EF444410',color:'#EF4444',fontSize:10,fontWeight:700,cursor:'pointer' }}>
              Sign Out
            </button>
          </div>

          {/* Scrollable sub-nav */}
          <div style={{ display:'flex',overflowX:'auto',gap:0,scrollbarWidth:'none',msOverflowStyle:'none',marginTop:2 }}>
            {ACCOUNT_NAV.map(n => {
              const isActive = n.exact ? pathname===n.href : pathname.startsWith(n.href)
              return (
                <Link key={n.href} href={n.href} style={{
                  display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                  padding:'8px 14px',flexShrink:0,textDecoration:'none',
                  borderBottom:`2.5px solid ${isActive?'#8B5CF6':'transparent'}`,
                  transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:15 }}>{n.icon}</span>
                  <span style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',color:isActive?'#A78BFA':'#475569',whiteSpace:'nowrap' }}>{n.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Desktop: two-column layout — sidebar + content */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 16px', display:'grid', gridTemplateColumns:'220px 1fr', gap:20, alignItems:'start' }}
        className="account-grid">
        {/* Desktop sidebar */}
        <div className="account-sidebar" style={{ borderRadius:16,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',overflow:'hidden',position:'sticky',top:80 }}>
          {/* User info */}
          <div style={{ padding:'14px',borderBottom:'1px solid var(--viro-border)',display:'flex',alignItems:'center',gap:10 }}>
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width:36,height:36,borderRadius:'50%',border:'2px solid #8B5CF6',flexShrink:0 }}/>
              : <div style={{ width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#8B5CF6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#fff',flexShrink:0 }}>
                  {(user.name||user.email||'U')[0].toUpperCase()}
                </div>
            }
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:12,fontWeight:700,color:'var(--viro-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.name||'My Account'}</p>
              <p style={{ fontSize:10,color:'var(--viro-textSub)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.email}</p>
            </div>
          </div>
          {/* Sidebar nav */}
          {ACCOUNT_NAV.map(n => {
            const isActive = n.exact ? pathname===n.href : pathname.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href}
                style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',textDecoration:'none',
                  borderLeft:`3px solid ${isActive?'#8B5CF6':'transparent'}`,
                  background: isActive?'#8B5CF608':'transparent',
                  borderBottom:'1px solid var(--viro-border)',transition:'all 0.15s' }}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='var(--viro-bgDeep)'}}
                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent'}}>
                <span style={{ fontSize:16 }}>{n.icon}</span>
                <span style={{ fontSize:12,fontWeight:700,color:isActive?'#A78BFA':'var(--viro-textSub)' }}>{n.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Main content */}
        <div className="account-main" style={{ minWidth:0 }}>
          {children}
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .account-grid { grid-template-columns: 1fr !important; padding: 0 !important; gap: 0 !important; }
          .account-sidebar { display: none !important; }
          .account-main { padding: 0; }
        }
      `}</style>
    </div>
  )
}

export default function AccountShell({ children, title = 'My Account' }) {
  // BUGFIX: this used to wrap children in its own <AppShell>, but
  // app/layout.jsx ALREADY wraps the entire site in <AppShell> once,
  // globally. Every /account/* page was rendering the whole shell TWICE —
  // nav, TopBar (hence the duplicate banner), WhatsApp button, all of it —
  // with the inner instance's own nav rail squeezing the actual page
  // content into a much narrower column inside the outer instance's
  // content area. That's also what was producing the badly cut-off/
  // overlapping desktop layout — not a CSS bug, a literal double-mount.
  return <AccountContent title={title}>{children}</AccountContent>
}
