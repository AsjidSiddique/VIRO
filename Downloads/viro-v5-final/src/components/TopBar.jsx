import React from 'react'

const MESSAGES = [
  '🚚 FREE Delivery in Burewala on orders Rs.550+',
  '🌍 Other Cities — Free Delivery on orders Rs.2500+',
  '⚡ Below threshold: flat Rs.150 delivery charge',
  '📞 Call / WhatsApp: 03277796566',
  '✅ Trusted Quality · Best Prices · Fast Delivery',
  '🛍️ Smart Shopping, Better Living — viro.pk',
]

export default function TopBar() {
  return (
    <div className="sticky top-0 z-50 w-full overflow-hidden"
      style={{ height: '36px', background: 'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316,#8B5CF6,#00BFFF)', backgroundSize: '300% 100%', animation: 'gradShift 8s ease infinite' }}>
      <style>{`
        @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ticker { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
        .ticker { display:flex; white-space:nowrap; animation:ticker 32s linear infinite; gap:3rem; }
        .ticker:hover { animation-play-state:paused; }
      `}</style>
      <div className="flex items-center h-full overflow-hidden">
        <div className="ticker">
          {[...MESSAGES,...MESSAGES].map((m,i) => (
            <span key={i} className="text-white font-semibold text-xs px-6 flex-shrink-0"
              style={{textShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
