export default function CategoryLoading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)', padding: '1rem' }}>
      <div className="skeleton rounded-2xl mb-4" style={{ height: 120 }} />
      <div className="skeleton rounded-xl mb-4" style={{ height: 40 }} />
      <div className="grid grid-cols-2 gap-3">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="skeleton rounded-2xl" style={{ height: 220 }} />
        ))}
      </div>
    </div>
  )
}
