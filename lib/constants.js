export const OTHER_CITIES_FREE_THRESHOLD = 2500
export const DELIVERY_CHARGE = 150

export function getDeliveryCharge(city, subtotal) {
  const c = (city || '').trim().toLowerCase()
  if (c === 'burewala') {
    return subtotal >= 550 ? 0 : DELIVERY_CHARGE
  }
  return subtotal >= OTHER_CITIES_FREE_THRESHOLD ? 0 : DELIVERY_CHARGE
}


// v47 Stock model:
// UNPAID    -> customer placed order, stock-- immediately. Behaves as the queue.
// CONFIRMED -> admin confirms, order is being processed
// CANCELLED -> stock restored via restore_stock RPC
// RETURNED  -> customer returned item, stock restored
export const ORDER_STATUSES = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','RETURNED','CANCELLED']

export const ORDER_STATUS_META = {
  UNPAID:     { icon:'⏳', color:'#F97316', label:'Pending / Queue',  desc:'Order placed and queued, awaiting admin confirmation.' },
  CONFIRMED:  { icon:'✅', color:'#8B5CF6', label:'Confirmed',        desc:'Confirmed! Being prepared for dispatch.' },
  PROCESSING: { icon:'⚙️', color:'#00BFFF', label:'Processing',       desc:'Being packed and prepared for shipping.' },
  SHIPPED:    { icon:'🚚', color:'#3B82F6', label:'Shipped',          desc:'On the way! Expect delivery very soon.' },
  DELIVERED:  { icon:'📦', color:'#10B981', label:'Delivered',        desc:'Delivered! Thank you for shopping with Viro.' },
  RETURNED:   { icon:'↩️', color:'#A855F7', label:'Returned',         desc:'Item returned. Refund/exchange being processed.' },
  CANCELLED:  { icon:'❌', color:'#EF4444', label:'Cancelled',        desc:'Cancelled. Contact us for more details.' },
}

// Note: contact info (phone, whatsapp, email) lives in
// SiteSettingsContext — fetched from site_settings DB table.
// Use useSite().contact everywhere.
