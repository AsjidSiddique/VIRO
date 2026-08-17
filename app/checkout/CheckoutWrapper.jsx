'use client'
import dynamic from 'next/dynamic'

// ssr:false must be in a 'use client' component — not allowed in Server Components
// CheckoutClient calls localStorage at render time (loadSaved) which crashes on server
const CheckoutClient = dynamic(() => import('./CheckoutClient'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight:'100vh', background:'var(--viro-sectionBg)', padding:'1rem' }}>
      <div style={{ maxWidth:480, margin:'0 auto' }}>
        <div className="skeleton rounded h-7 mb-6" style={{ width:'40%' }} />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton rounded-xl mb-3" style={{ height:52 }} />
        ))}
        <div className="skeleton rounded-2xl" style={{ height:120 }} />
      </div>
    </div>
  ),
})

export default function CheckoutWrapper() {
  return <CheckoutClient />
}
