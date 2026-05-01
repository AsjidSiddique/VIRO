export const CITIES = {
  Burewala: { freeThreshold: 550 },
  Chichawatni: { freeThreshold: 2000 },
  Vehari: { freeThreshold: 1500 },
  Gaggo: { freeThreshold: 1200 },
}

export const DELIVERY_CHARGE = 150

export function getDeliveryCharge(city, subtotal) {
  const cityData = CITIES[city]
  if (!cityData) return DELIVERY_CHARGE
  return subtotal >= cityData.freeThreshold ? 0 : DELIVERY_CHARGE
}

export const CITY_NAMES = Object.keys(CITIES)

export const CONTACT = {
  phone: '+923277796566',
  whatsapp: '923277796566',
  email: 'support@viro.pk',
  address: 'Mandi Burewala, Punjab, Pakistan',
}

export const ORDER_STATUSES = ['UNPAID','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']
