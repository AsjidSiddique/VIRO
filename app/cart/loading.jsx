export default function CartLoading() {
  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'100vh', padding:'16px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:20 }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />)}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading cart…</span>
      </div>
      {[1,2,3].map(i => (
        <div key={i} className="rounded-2xl mb-3" style={{ background:'var(--viro-bgCard)', padding:12, display:'flex', gap:12 }}>
          <div className="skeleton rounded-xl flex-shrink-0" style={{ width:64, height:64, animationDelay:`${i*0.1}s` }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            <div className="skeleton rounded" style={{ height:13, width:'70%', animationDelay:`${i*0.1+0.1}s` }} />
            <div className="skeleton rounded" style={{ height:11, width:'40%', animationDelay:`${i*0.1+0.15}s` }} />
            <div className="skeleton rounded" style={{ height:11, width:'30%', animationDelay:`${i*0.1+0.2}s` }} />
          </div>
        </div>
      ))}
      <div className="skeleton rounded-2xl mt-4" style={{ height:140 }} />
    </div>
  )
}
