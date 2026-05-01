import React, { useEffect, useRef } from 'react'

const MESSAGES = [
  '🚚 Free Delivery in Burewala on orders Rs.550+',
  '🏙️ Chichawatni — Free Delivery Rs.2000+',
  '🌆 Vehari — Free Delivery Rs.1500+',
  '🏘️ Gaggo — Free Delivery Rs.1200+',
  '⚡ Otherwise flat Rs.150 delivery charge',
  '📞 Call/WhatsApp: 03277796566',
]

export default function TopBar() {
  const tickerRef = useRef(null)

  return (
    <div className="sticky top-0 z-50 w-full overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, #00BFFF, #8B5CF6, #F97316, #8B5CF6, #00BFFF)',
        backgroundSize: '300% 100%',
        animation: 'gradientShift 6s ease infinite',
        height: '36px',
      }}>
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ticker {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .ticker-track {
          display: flex;
          white-space: nowrap;
          animation: ticker 28s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      <div className="flex items-center h-full overflow-hidden">
        <div className="ticker-track gap-12" style={{ gap: '3rem' }}>
          {[...MESSAGES, ...MESSAGES].map((msg, i) => (
            <span key={i} className="text-white font-semibold text-xs px-6 flex-shrink-0"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              {msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
