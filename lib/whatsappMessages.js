// lib/whatsappMessages.js
// ════════════════════════════════════════════════════════════════════════════
// Shared WhatsApp message builders — three templates, three moments:
//   1. buildOrderConfirmationMessage — order placed, admin confirms details
//      with the customer (Orders tab → 💬 WhatsApp button on an order)
//   2. buildCheckoutNudgeMessage — filled in checkout info but never placed
//      the order (Checkout Activity tab → Send Reminder)
//   3. buildCartNudgeMessage — added to cart but never even reached checkout
//      (Dashboard → In Carts tab)
// Kept in one place so tone and formatting stay consistent instead of
// drifting apart as separate copies across different admin pages.
// ════════════════════════════════════════════════════════════════════════════

export const FREE_DELIVERY_THRESHOLD = 1500

export function normalizePkPhoneForWa(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^\d]/g, '')
  if (digits.startsWith('92') && digits.length === 12) return digits
  if (digits.startsWith('0')  && digits.length === 11) return '92' + digits.slice(1)
  if (digits.length === 10) return '92' + digits
  return digits || null
}

export function buildWaLink(phone, message) {
  const normalized = normalizePkPhoneForWa(phone)
  if (!normalized) return '#'
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

function firstName(name) {
  return name ? name.trim().split(' ')[0] : ''
}

// ── 1. Order confirmation ───────────────────────────────────────────────────
// order: {
//   customerName, address, city,
//   items: [{ name, quantity, price }],   // price = per-unit
//   deliveryCharge, total,
// }
export function buildOrderConfirmationMessage(order) {
  const name = firstName(order.customerName)
  const greeting = name ? `Assalam-o-Alaikum ${name}!` : `Assalam-o-Alaikum!`

  const itemLines = (order.items || []).map(i => {
    const qty = i.quantity || 1
    const lineTotal = Math.round((i.price || 0) * qty)
    return `${i.name} x${qty}  ${lineTotal}PKR`
  }).join('\n')

  const addressLine = [order.address, order.city].filter(Boolean).join(', ')

  return `${greeting} \u{1F60A}\n`
    + `I'm Ayesha from viro.pk. Aap ka order receive ho gaya hai.\n`
    + `Order Breakdown:\n`
    + `\u{1F6CD}\u{FE0F} Products: ${itemLines}\n`
    + `\u{1F69A} Delivery Charges: Rs. ${Math.round(order.deliveryCharge || 0).toLocaleString()}\n`
    + `\u{1F4B3} Total : Rs. ${Math.round(order.total || 0).toLocaleString()}\n\n`
    + `Delivery address: ${addressLine}\n`
    + `Reply "Yes" if this info is correct, & for order confirmation  \u{1F4E6} FOR NEXT PROCESS`
}

// ── 2 & 3. Cart / Checkout nudges ───────────────────────────────────────────
// Both share the same shape and wording — the only real difference is
// whether they'd started filling in checkout info ("cart mein add kiya hai
// lekin order abhi complete nahi hua") vs never got that far ("cart mein add
// kiya hai"). Kept as one internal builder so the two can't drift apart.
function buildNudgeMessage({ name, items, reachedCheckout }) {
  const first = firstName(name)
  const greeting = first ? `Assalam-o-Alaikum ${first}!` : `Assalam-o-Alaikum!`

  const itemLines = (items || []).slice(0, 5).map(i => {
    const qty = i.quantity || 1
    const lineTotal = Math.round((i.price || 0) * qty)
    const qtyLabel = qty > 1 ? ` x${qty}` : ' x1'
    return `${i.name}${qtyLabel} \u2013 Rs. ${lineTotal.toLocaleString()}`
  }).join('\n')
  const more = (items || []).length > 5 ? `\nand ${items.length - 5} more` : ''

  const intro = reachedCheckout
    ? `Aap ne cart mein add kiya hai lekin order abhi complete nahi hua:`
    : `Aap ne cart mein add kiya hai:`

  return `${greeting} \u{1F60A}\n`
    + `I'm Ayesha from Viro.pk. ${intro}\n`
    + `${itemLines}${more}\n\n`
    + `On orders of Rs. ${FREE_DELIVERY_THRESHOLD.toLocaleString()}+, you get FREE Delivery \u{1F381}\n`
    + `Hair Accessories, Jewellery & Handbags dekhne ke liye aur complete your cart here: https://viro.pk/shop\n`
    + `Thank you! \u{1F496}`
}

// customer: { name, phone, products: [{product_name, quantity, unit_price, line_total}], net_value }
export function buildCartNudgeMessage(customer) {
  const items = (customer.products || []).map(p => ({
    name: p.product_name, quantity: p.quantity,
    price: p.unit_price ?? (p.line_total && p.quantity ? p.line_total / p.quantity : 0),
  }))
  return buildNudgeMessage({ name: customer.name, items, reachedCheckout: false })
}

// visit: { name, phone, cart_snapshot: [{name, quantity, price}], cart_value }
export function buildCheckoutNudgeMessage(visit) {
  const items = (visit.cart_snapshot || []).map(p => ({
    name: p.name, quantity: p.quantity, price: p.price,
  }))
  return buildNudgeMessage({ name: visit.name, items, reachedCheckout: true })
}
