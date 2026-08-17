// Emergency cache clearing page — visit viro.pk/clear-cache if site is broken
// This page is purely static, no React hydration needed, works even when JS is broken
export const metadata = {
  title: 'Clear Cache — Viro',
  robots: { index: false, follow: false }, // don't index this utility page
}

export default function ClearCachePage() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fix Site — Viro</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a; color: #f1f5f9;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 20px;
          }
          .card {
            background: #1e293b; border-radius: 16px; padding: 40px 32px;
            max-width: 440px; width: 100%; text-align: center;
          }
          h1 { font-size: 22px; margin-bottom: 10px; }
          p  { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
          button {
            background: #6366f1; color: #fff; border: none;
            padding: 14px 32px; border-radius: 10px; font-size: 16px;
            font-weight: 600; cursor: pointer; width: 100%; margin-bottom: 10px;
          }
          button:hover { background: #4f46e5; }
          .status { font-size: 13px; color: #64748b; margin-top: 16px; min-height: 20px; }
          .ok { color: #34d399; }
          .logo { font-size: 36px; margin-bottom: 16px; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="logo">🔄</div>
          <h1>Fix Viro Site</h1>
          <p>
            If pages are showing blank or errors, tap the button below.
            It clears your browser cache and reloads the site fresh.
          </p>
          <button id="fixBtn">Clear Cache & Reload</button>
          <div className="status" id="status">Ready</div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('fixBtn').addEventListener('click', async function() {
            var btn = this
            var status = document.getElementById('status')
            btn.disabled = true
            btn.textContent = 'Clearing...'
            status.textContent = 'Removing old caches...'
            status.className = 'status'

            try {
              // 1. Clear all caches
              if ('caches' in window) {
                var keys = await caches.keys()
                await Promise.all(keys.map(function(k) {
                  console.log('Deleting cache:', k)
                  return caches.delete(k)
                }))
              }

              // 2. Unregister all service workers
              if ('serviceWorker' in navigator) {
                var regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map(function(r) { return r.unregister() }))
              }

              status.textContent = 'Done! Reloading...'
              status.className = 'status ok'

              // 3. Hard reload to home page
              setTimeout(function() {
                window.location.replace('/?nocache=' + Date.now())
              }, 800)

            } catch(err) {
              status.textContent = 'Error: ' + err.message + ' — try Ctrl+Shift+R'
              btn.disabled = false
              btn.textContent = 'Try Again'
            }
          })
        `}} />
      </body>
    </html>
  )
}
