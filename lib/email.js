// Email via Supabase Edge Function proxy
// This avoids the CORS error from calling api.resend.com directly from the browser.
// The Edge Function (supabase/functions/send-email/index.ts) calls Resend server-side.

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function sendOrderEmail({ name, email, orderId, items, subtotal, originalSubtotal, saleDiscount, couponCode, couponDiscount, prepaidDiscount, prepaidDiscountPercent, deliveryCharge, finalTotal, city, contact, paymentMethod, accountNumber, accountName }) {
  if (!email || !SUPABASE_URL) return
  // Use passed contact (from useSite), fall back to hardcoded only as last resort
  const waPhone   = contact?.whatsapp || '923290081469'
  const waDisplay = contact?.phone    || '0327 7796566'
  const emailAddr = contact?.email    || 'support@viro.pk'

  const itemsHtml = items.map(i => {
    const hasDisc = i.original_price && i.original_price > i.price
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;color:#CBD5E1">${i.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;color:#94A3B8;text-align:center">×${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;text-align:right">
        ${hasDisc ? `<span style="color:#94A3B8;text-decoration:line-through;font-size:11px">Rs.${(i.original_price * i.quantity).toLocaleString()}</span> ` : ''}
        <span style="color:#A78BFA;font-weight:700">Rs.${(i.price * i.quantity).toLocaleString()}</span>
      </td>
    </tr>`
  }).join('')

  const deliveryRow = deliveryCharge === 0
    ? `<span style="color:#10B981;font-weight:700">FREE 🎉</span>`
    : `<span style="color:#F97316">Rs.${deliveryCharge}</span>`

  // BUGFIX: this row used to hardcode "Cash on Delivery" for every single
  // order regardless of what was actually selected at checkout — a prepaid
  // JazzCash/EasyPaisa customer got an email telling them it was COD.
  const isPrepaid = paymentMethod && paymentMethod.toLowerCase() !== 'cod'
  const paymentLabel = isPrepaid
    ? `${paymentMethod.charAt(0).toUpperCase()}${paymentMethod.slice(1).toLowerCase()}`
    : 'Cash on Delivery'
  const paymentRow = `
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">Payment</td>
              <td style="color:${isPrepaid ? '#F97316' : '#10B981'};font-size:12px;font-weight:700;text-align:right">${paymentLabel}${isPrepaid ? ' (Prepaid)' : ''}</td>
            </tr>`

  // For prepaid orders, add the same send-money instructions shown on the
  // in-app success screen — without this, a prepaid customer's ONLY record
  // of where to send money is the browser tab they might already have closed.
  const prepaidInstructions = isPrepaid && accountNumber ? `
        <div style="border-radius:12px;padding:14px 16px;margin-bottom:16px;background:#F9731612;border:1px solid #F9731640">
          <p style="margin:0 0 8px;color:#F97316;font-size:13px;font-weight:800">🟠 Payment Verification In Progress</p>
          <p style="margin:0 0 10px;color:#94A3B8;font-size:12px">Amount: Rs.${finalTotal?.toLocaleString()} to:</p>
          <p style="margin:0 0 4px;color:#E2E8F0;font-size:16px;font-weight:800;letter-spacing:1px">${accountNumber}</p>
          <p style="margin:0 0 10px;color:#94A3B8;font-size:12px">Account name: <strong style="color:#E2E8F0">${accountName || ''}</strong></p>
          <p style="margin:0;color:#64748B;font-size:11px">We're confirming your payment now — you'll get a follow-up once it's verified.</p>
        </div>` : ''

  // BUGFIX: this table used to hand-write each row's math independently
  // (subtotal, then a separately-computed "subtotal after coupon", then
  // delivery, then a totally separate finalTotal passed in from outside) —
  // with NO row at all for prepaid discount. That meant for prepaid orders,
  // subtotal − coupon + delivery simply didn't add up to the total shown,
  // because a whole discount step was invisible. Rebuilt using one running
  // total in JS so every row is guaranteed to reconcile to what's charged.
  let runningTotal = subtotal || 0
  const totalsRows = []
  if (saleDiscount > 0) {
    totalsRows.push(`<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Original Price</td><td style="color:#94A3B8;font-size:13px;text-align:right;text-decoration:line-through">Rs.${(originalSubtotal||subtotal)?.toLocaleString()}</td></tr>`)
    totalsRows.push(`<tr><td style="color:#F97316;font-size:13px;padding:4px 0">🏷️ Sale Discount</td><td style="color:#F97316;font-size:13px;text-align:right;font-weight:700">−Rs.${saleDiscount?.toLocaleString()}</td></tr>`)
  }
  totalsRows.push(`<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Subtotal</td><td style="color:#E2E8F0;font-size:13px;text-align:right">Rs.${runningTotal?.toLocaleString()}</td></tr>`)
  if (couponDiscount > 0) {
    runningTotal -= couponDiscount
    totalsRows.push(`<tr><td style="color:#10B981;font-size:13px;padding:4px 0">🎟️ Coupon${couponCode ? ' ('+couponCode+')' : ''}</td><td style="color:#10B981;font-size:13px;text-align:right;font-weight:700">−Rs.${couponDiscount?.toLocaleString()}</td></tr>`)
  }
  if (prepaidDiscount > 0) {
    runningTotal -= prepaidDiscount
    totalsRows.push(`<tr><td style="color:#10B981;font-size:13px;padding:4px 0">💳 Prepaid Discount${prepaidDiscountPercent ? ' ('+prepaidDiscountPercent+'%)' : ''}</td><td style="color:#10B981;font-size:13px;text-align:right;font-weight:700">−Rs.${prepaidDiscount?.toLocaleString()}</td></tr>`)
  }
  if (couponDiscount > 0 || prepaidDiscount > 0) {
    totalsRows.push(`<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Subtotal</td><td style="color:#E2E8F0;font-size:13px;text-align:right">Rs.${Math.max(0, runningTotal).toLocaleString()}</td></tr>`)
  }
  totalsRows.push(`<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Delivery</td><td style="font-size:13px;text-align:right">${deliveryRow}</td></tr>`)
  totalsRows.push(`<tr><td style="color:#fff;font-size:15px;font-weight:800;padding:8px 0 4px;border-top:1px solid #334155">Total to Pay</td><td style="color:#A78BFA;font-size:15px;font-weight:800;text-align:right;border-top:1px solid #334155">Rs.${finalTotal?.toLocaleString()}</td></tr>`)
  const totalsRowsHtml = totalsRows.join('')

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:520px;margin:30px auto;border-radius:20px;overflow:hidden;border:1px solid #1E293B">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316);padding:28px 24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px">VIRO</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Smart Shopping, Better Living</p>
      </div>
      <!-- Body -->
      <div style="background:#0F172A;padding:24px">
        <p style="color:#94A3B8;font-size:14px;margin:0 0 6px">Hi <strong style="color:#E2E8F0">${name}</strong>,</p>
        <p style="color:#94A3B8;font-size:14px;margin:0 0 20px">${isPrepaid ? "We're verifying your payment receipt — you'll be confirmed shortly." : "We've received your order. We'll confirm via phone or WhatsApp shortly."}</p>

        <!-- Order info -->
        <div style="background:#1E293B;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">Order ID</td>
              <td style="color:#A78BFA;font-size:12px;font-weight:700;text-align:right">#${orderId?.slice?.(0,8)?.toUpperCase?.() ?? orderId}</td>
            </tr>
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">City</td>
              <td style="color:#E2E8F0;font-size:12px;text-align:right">${city}</td>
            </tr>${paymentRow}
          </table>
        </div>
        ${prepaidInstructions}
        <!-- Items -->
        <div style="background:#1E293B;border-radius:12px;overflow:hidden;margin-bottom:16px">
          <p style="margin:0;padding:10px 16px;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #334155">Order Items</p>
          <table style="width:100%;border-collapse:collapse">
            ${itemsHtml}
          </table>
        </div>

        <!-- Totals -->
        <div style="background:#1E293B;border-radius:12px;padding:14px 16px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            ${totalsRowsHtml}
          </table>
        </div>

        <!-- Contact -->
        <div style="border-radius:12px;padding:14px 16px;background:linear-gradient(135deg,#00BFFF10,#8B5CF618);border:1px solid #8B5CF630;text-align:center">
          <p style="margin:0 0 8px;color:#94A3B8;font-size:12px">Questions? Reach us anytime</p>
          <p style="margin:0;font-size:13px">
            <a href="https://wa.me/${waPhone}" style="color:#10B981;text-decoration:none;font-weight:700">💬 WhatsApp: ${waDisplay}</a>
            &nbsp;&nbsp;
            <a href="mailto:${emailAddr}" style="color:#00BFFF;text-decoration:none;font-weight:700">✉️ ${emailAddr}</a>
          </p>
        </div>
      </div>
      <!-- Footer -->
      <div style="background:#080E1C;padding:14px;text-align:center">
        <p style="margin:0;color:#334155;font-size:11px">© 2026 Viro · viro.pk · Burewala, Pakistan</p>
      </div>
    </div>
  </body>
  </html>`

  const payload = {
    from: 'Viro <support@viro.pk>',
    to: [email],
    subject: `✅ Order Received — Viro #${orderId?.slice?.(0,8)?.toUpperCase?.() ?? orderId}`,
    html,
  }

  // Fix #18: 8-second timeout so order placement never hangs on email
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    // Call our Edge Function (no CORS issue — same Supabase origin)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // apikey header is sufficient — no Authorization Bearer needed for Edge Functions
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) console.error('Email error:', data)
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Email send timed out after 8s — order was placed successfully')
    } else {
      console.error('Email send failed:', e)
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Partner Program notifications ──────────────────────────────────────────
// Same Edge Function / Resend setup as the order email above — just two
// small transactional emails so a partner isn't stuck refreshing their
// dashboard to find out whether they got approved.
async function sendViaEdgeFunction(payload) {
  if (!SUPABASE_URL) return
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) console.error('Email error:', data)
  } catch (e) {
    if (e.name !== 'AbortError') console.error('Email send failed:', e)
  } finally {
    clearTimeout(timeout)
  }
}

function partnerEmailShell(name, bodyHtml) {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:480px;margin:30px auto;border-radius:20px;overflow:hidden;border:1px solid #1E293B">
      <div style="background:linear-gradient(135deg,#8B5CF6,#7C3AED);padding:26px 24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">🤝 Viro Partner Program</h1>
      </div>
      <div style="background:#0F172A;padding:24px">
        <p style="color:#94A3B8;font-size:14px;margin:0 0 16px">Hi <strong style="color:#E2E8F0">${name}</strong>,</p>
        ${bodyHtml}
      </div>
      <div style="background:#080E1C;padding:14px;text-align:center">
        <p style="margin:0;color:#334155;font-size:11px">© 2026 Viro · viro.pk · Burewala, Pakistan</p>
      </div>
    </div>
  </body>
  </html>`
}

export async function sendPartnerApprovedEmail({ name, email, couponCode, commissionPercent }) {
  if (!email) return
  const html = partnerEmailShell(name, `
    <p style="color:#94A3B8;font-size:14px;margin:0 0 20px">🎉 You're approved! Your coupon is live and ready to share.</p>
    <div style="background:#1E293B;border-radius:12px;padding:18px;text-align:center;margin-bottom:16px">
      <p style="margin:0 0 8px;color:#64748B;font-size:11px;text-transform:uppercase;font-weight:700">Your Coupon</p>
      <p style="margin:0;color:#A78BFA;font-size:24px;font-weight:800;letter-spacing:1px">${couponCode}</p>
    </div>
    <p style="color:#94A3B8;font-size:13px;margin:0 0 20px">You'll earn <strong style="color:#10B981">${commissionPercent}%</strong> commission on every order that completes — paid out as Partner Coins you can spend right on Viro.</p>
    <a href="https://viro.pk/partner" style="display:block;text-align:center;background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:14px;border-radius:12px">Open My Dashboard →</a>
  `)
  await sendViaEdgeFunction({ from: 'Viro Partners <support@viro.pk>', to: [email], subject: '🎉 You\'re approved — Viro Partner Program', html })
}

export async function sendPartnerRejectedEmail({ name, email, reason }) {
  if (!email) return
  const html = partnerEmailShell(name, `
    <p style="color:#94A3B8;font-size:14px;margin:0 0 16px">Thanks for your interest in the Viro Partner Program — we're not able to approve your request right now.</p>
    ${reason ? `<div style="background:#1E293B;border-radius:12px;padding:14px 16px;margin-bottom:16px"><p style="margin:0;color:#94A3B8;font-size:13px">${reason}</p></div>` : ''}
    <p style="color:#64748B;font-size:12px;margin:0">You're welcome to apply again in the future.</p>
  `)
  await sendViaEdgeFunction({ from: 'Viro Partners <support@viro.pk>', to: [email], subject: 'Update on your Viro Partner request', html })
}
