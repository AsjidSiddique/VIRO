export default function HomeLoading() {
  return (
    <div style={{ background:'var(--viro-sectionBg)', minHeight:'100vh', paddingTop:8 }}>
      {/* Bounce loading indicator */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'8px 0 12px' }}>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => (
            <span key={i} className="viro-loading-dot" style={{ animationDelay:`${i*0.18}s` }} />
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--viro-textSub)', fontWeight:600 }}>Loading…</span>
      </div>

      {/* Banner skeleton */}
      <div className="mx-3 mb-4 skeleton rounded-2xl" style={{ height:180 }} />

      {/* Category pills */}
      <div className="flex gap-2 px-3 mb-5 overflow-hidden">
        {[80,70,90,75,85,65].map((w,i) => (
          <div key={i} className="skeleton rounded-2xl flex-shrink-0" style={{ width:w, height:68, animationDelay:`${i*0.07}s` }} />
        ))}
      </div>

      {/* Section title */}
      <div className="px-3 mb-3">
        <div className="skeleton h-5 rounded mb-2" style={{ width:140 }} />
        <div className="skeleton h-3 rounded" style={{ width:200 }} />
      </div>

      {/* Product row */}
      <div className="flex gap-3 px-3 mb-6 overflow-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden flex-shrink-0" style={{ width:160, background:'var(--viro-bgCard)' }}>
            <div className="skeleton" style={{ height:160, borderRadius:0, animationDelay:`${i*0.08}s` }} />
            <div className="p-2.5" style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div className="skeleton rounded" style={{ height:13, width:'80%', animationDelay:`${i*0.08+0.1}s` }} />
              <div className="skeleton rounded" style={{ height:11, width:'55%', animationDelay:`${i*0.08+0.15}s` }} />
              <div className="skeleton rounded-xl" style={{ height:32, animationDelay:`${i*0.08+0.2}s` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Second section */}
      <div className="px-3 mb-3">
        <div className="skeleton h-5 rounded" style={{ width:160 }} />
      </div>
      <div className="grid grid-cols-2 gap-3 px-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-bgCard)' }}>
            <div className="skeleton" style={{ paddingTop:'100%', borderRadius:0, animationDelay:`${i*0.08}s` }} />
            <div className="p-2.5" style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div className="skeleton rounded" style={{ height:13, width:'75%' }} />
              <div className="skeleton rounded" style={{ height:11, width:'50%' }} />
              <div className="skeleton rounded-xl" style={{ height:32 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
