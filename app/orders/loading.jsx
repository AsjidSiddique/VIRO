export default function OrdersLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--viro-sectionBg)',
      padding: '1rem',
    }}>
      <div style={{ maxWidth: 768, margin: '0 auto' }}>
        <div className="skeleton rounded-xl mb-4"
          style={{ height: 48, width: '60%' }} />
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl"
              style={{ height: 220 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
