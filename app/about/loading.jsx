export default function AboutLoading() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', padding:'1rem' }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div className="skeleton rounded h-8 mb-4" style={{ width:'50%' }} />
        {[1,2,3].map(i => <div key={i} className="skeleton rounded h-4 mb-2" />)}
      </div>
    </div>
  )
}
