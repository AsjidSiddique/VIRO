export default function AccountLoading() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', padding:'1rem' }}>
      <div style={{ maxWidth:480, margin:'0 auto' }}>
        <div className="skeleton rounded-2xl mb-4" style={{ height:120 }} />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton rounded-xl mb-3" style={{ height:56 }} />
        ))}
      </div>
    </div>
  )
}
