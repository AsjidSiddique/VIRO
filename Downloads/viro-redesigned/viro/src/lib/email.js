export async function sendOrderEmail({ name, email, orderId, items, subtotal, deliveryCharge, finalTotal, city }) {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY
  if (!apiKey || !email) return

  const itemsList = items.map(i => `- ${i.name} x${i.quantity} = Rs. ${i.price * i.quantity}`).join('\n')

  const body = {
    from: 'Viro <support@viro.pk>',
    to: [email],
    subject: 'Order Received - VIRO',
    text: `Hi ${name},\n\nThank you for your order!\n\nOrder #${orderId}\nCity: ${city}\n\nItems:\n${itemsList}\n\nSubtotal: Rs. ${subtotal}\nDelivery: Rs. ${deliveryCharge}\nTotal: Rs. ${finalTotal}\n\nStatus: UNPAID\nWe will confirm your order via phone or WhatsApp.\n\nFor queries:\n📞 +92 327 7796566\n✉️ support@viro.pk\n\n— VIRO Team\nSmart Shopping, Better Living`,
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('Email send failed:', e)
  }
}
