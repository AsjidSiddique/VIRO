'use client'
export default function AboutClient({ content }) {
  const c = content
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3" style={{ color:'var(--viro-text)' }}>
          {c.hero_title || 'About Viro'}
        </h1>
        <p className="text-lg" style={{ color:'var(--viro-textMuted)' }}>{c.hero_subtitle || 'Smart Shopping, Better Living.'}</p>
        <div className="w-16 h-1 rounded-full mx-auto mt-4" style={{ background:'linear-gradient(90deg,#8B5CF6,#F97316)' }} />
      </div>

      {/* Story */}
      <div className="viro-card p-6 mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color:'var(--viro-text)' }}>Our Story</h2>
        {(c.story || '').split('\n\n').filter(Boolean).map((para, i) => (
          <p key={i} className="text-sm leading-relaxed mb-3" style={{ color:'var(--viro-textMuted)' }}>{para}</p>
        ))}
      </div>

      {/* Values grid — same card as in screenshot */}
      <div className="viro-card p-6 mb-8">
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
          <img src="/icon-96.png" alt="Viro" className="w-7 h-7 rounded-lg" />
          Why Choose Viro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0" style={{ borderColor:'var(--viro-border)' }}>
          {(c.values || []).map((v, i) => (
            <div key={i} className="flex items-start gap-3 p-4" style={{
              borderBottom: i < (c.values||[]).length - 2 ? `1px solid var(--viro-border)` : undefined,
              borderRight: i % 2 === 0 ? `1px solid var(--viro-border)` : undefined,
            }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background:'var(--viro-bgInput)', border:'1px solid var(--viro-border)' }}>
                {v.icon}
              </span>
              <div>
                <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>{v.title}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team note */}
      <div className="viro-card p-6 text-center">
        <p className="text-2xl mb-3">🇵🇰</p>
        <p className="text-sm leading-relaxed" style={{ color:'var(--viro-textMuted)' }}>{c.team_note || 'We are a passionate team based in Punjab, Pakistan.'}</p>
      </div>

      {/* Note: JSON-LD schema is added in app/about/page.jsx (server component) */}
    </div>
  )
}
