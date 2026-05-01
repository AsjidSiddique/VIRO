export const CITIES = {
  Burewala: { freeThreshold: 550 },
}

export const OTHER_CITIES_FREE_THRESHOLD = 2500
export const DELIVERY_CHARGE = 150

export function getDeliveryCharge(city, subtotal) {
  if (city === 'Burewala') {
    return subtotal >= 550 ? 0 : DELIVERY_CHARGE
  }
  // All other cities: free above 2500, else 150
  return subtotal >= OTHER_CITIES_FREE_THRESHOLD ? 0 : DELIVERY_CHARGE
}

export const CITY_NAMES = ['Burewala']  // only listed city; others typed manually

export const CONTACT = {
  phone: '+923277796566',
  whatsapp: '923277796566',
  email: 'support@viro.pk',
  address: 'Mandi Burewala, Punjab, Pakistan',
}

export const ORDER_STATUSES = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']
