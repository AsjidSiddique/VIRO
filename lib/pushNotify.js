// ── pushNotify.js ─────────────────────────────────────────────────────────
// Sends order status push via Supabase Edge Function (server-side).
// The OneSignal REST API key NEVER touches the browser — it lives in
// Supabase Secrets as ONESIGNAL_REST_KEY, used only inside the Edge Function.
//
// Setup:
//   supabase secrets set ONESIGNAL_APP_ID=your-app-id
//   supabase secrets set ONESIGNAL_REST_KEY=your-rest-api-key
//
// The Edge Function action 'send_order_push' handles targeting by phone tag.
// ──────────────────────────────────────────────────────────────────────────

import { adminApi } from './adminApi'

/**
 * Send a push notification to the customer when their order status changes.
 * Proxied through the admin Edge Function — REST key stays server-side.
 *
 * @param {object} params
 * @param {string} params.orderId    - Full order UUID
 * @param {string} params.newStatus  - New order status
 * @param {string} params.phone      - Customer phone (OneSignal tag filter)
 * @param {string} params.name       - Customer first name for personalisation
 */
export async function sendOrderPush({ orderId, newStatus, phone, name }) {
  if (!phone) return
  try {
    const result = await adminApi('send_order_push', {
      order_id:   orderId,
      new_status: newStatus,
      phone,
      name: name || '',
    })
    console.debug('[Viro Push]', newStatus, '→', result)
  } catch (e) {
    // Non-critical — push failure must never block admin actions
    console.debug('[Viro Push] Failed (non-critical):', e?.message)
  }
}
