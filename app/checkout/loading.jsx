export default function CheckoutLoading() {
  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'100vh', padding:'16px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:20 }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />)}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading checkout…</span>
      </div>
      <div className="skeleton rounded-2xl mb-3" style={{ height:180 }} />
      <div className="skeleton rounded-2xl mb-3" style={{ height:240 }} />
      <div className="skeleton rounded-2xl" style={{ height:60 }} />
    </div>
  )
}
