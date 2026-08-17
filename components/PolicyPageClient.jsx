'use client'
export default function PolicyPageClient({ content, icon = '📄' }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-4xl mb-3">{icon}</div>
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2" style={{ color:'var(--viro-text)' }}>
          {content.title || 'Policy'}
        </h1>
        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
          Last updated: {content.lastUpdated || '2025'}
        </p>
        <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ background:'linear-gradient(90deg,#8B5CF6,#F97316)' }} />
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {(content.sections || []).map((s, i) => (
          <div key={i} className="viro-card p-5">
            <h2 className="font-bold text-base mb-2" style={{ color:'var(--viro-text)' }}>
              {i + 1}. {s.heading}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color:'var(--viro-textMuted)' }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <p className="text-xs text-center mt-8" style={{ color:'var(--viro-textSub)' }}>
        Questions? <a href="/about" className="underline" style={{ color:'#8B5CF6' }}>Contact us</a> anytime.
      </p>
    </div>
  )
}
