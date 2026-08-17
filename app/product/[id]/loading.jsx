export default function ProductLoading() {
  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0 8px' }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />)}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading product…</span>
      </div>
      <div className="skeleton" style={{ height:320, borderRadius:0 }} />
      <div style={{ padding:'16px 12px', display:'flex', flexDirection:'column', gap:12 }}>
        <div className="skeleton rounded" style={{ height:22, width:'80%' }} />
        <div className="skeleton rounded" style={{ height:16, width:'50%' }} />
        <div className="skeleton rounded" style={{ height:14, width:'35%' }} />
        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton rounded-full" style={{ width:36, height:36 }} />)}
        </div>
        <div className="skeleton rounded-2xl" style={{ height:52, marginTop:8 }} />
        <div className="skeleton rounded-2xl" style={{ height:52 }} />
        <div className="skeleton rounded" style={{ height:13, width:'60%', marginTop:4 }} />
        <div className="skeleton rounded" style={{ height:13, width:'45%' }} />
        <div className="skeleton rounded" style={{ height:13, width:'55%' }} />
      </div>
    </div>
  )
}
