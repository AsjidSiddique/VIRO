export default function ShopLoading() {
  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'100vh' }}>
      {/* Sticky header skeleton */}
      <div className="px-3 pt-3 pb-2" style={{ background:'var(--viro-navBg)' }}>
        <div className="flex gap-2 mb-2">
          <div className="skeleton h-10 rounded-2xl flex-1" />
          <div className="skeleton h-10 w-10 rounded-xl flex-shrink-0" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[60,80,70,90,65,75,55].map((w,i) => (
            <div key={i} className="skeleton rounded-full flex-shrink-0" style={{ width:w, height:30, animationDelay:`${i*0.07}s` }} />
          ))}
        </div>
      </div>

      {/* Bounce loading indicator */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'14px 0 10px' }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => (
            <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading products…</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 px-3 pb-6">
        {Array(10).fill(0).map((_,i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)', opacity:1-i*0.04 }}>
            <div className="skeleton" style={{ paddingTop:'100%', borderRadius:0, animationDelay:`${i*0.05}s` }} />
            <div className="p-2.5" style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div className="skeleton rounded" style={{ height:13, width:'75%', animationDelay:`${i*0.05+0.1}s` }} />
              <div className="skeleton rounded" style={{ height:11, width:'50%', animationDelay:`${i*0.05+0.15}s` }} />
              <div style={{ display:'flex', gap:6 }}>
                <div className="skeleton rounded" style={{ height:13, width:'38%', animationDelay:`${i*0.05+0.2}s` }} />
                <div className="skeleton rounded" style={{ height:13, width:'25%', animationDelay:`${i*0.05+0.2}s` }} />
              </div>
              <div className="skeleton" style={{ height:34, width:'100%', borderRadius:10, animationDelay:`${i*0.05+0.25}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
