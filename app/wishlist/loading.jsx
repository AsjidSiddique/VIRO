export default function WishlistLoading() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', padding:'16px 12px' }}>
      {/* Bounce loading indicator */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => (
            <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading wishlist…</span>
      </div>
      {/* Title skeleton */}
      <div className="skeleton rounded-xl mb-4" style={{ height:28, width:'50%' }} />
      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)', opacity:1-i*0.05 }}>
            <div className="skeleton" style={{ paddingTop:'100%', borderRadius:0, animationDelay:`${i*0.08}s` }} />
            <div className="p-2.5" style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div className="skeleton rounded" style={{ height:13, width:'75%', animationDelay:`${i*0.08+0.1}s` }} />
              <div className="skeleton rounded" style={{ height:11, width:'50%', animationDelay:`${i*0.08+0.15}s` }} />
              <div className="skeleton rounded-xl" style={{ height:32, animationDelay:`${i*0.08+0.2}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
