import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Track My Order — Viro.pk | Order Status Pakistan',
  description: 'Track your Viro.pk order status in real time. Enter your phone number to view all past orders, delivery updates, and order history. Fast delivery across Pakistan.',
  keywords: ['track order pakistan', 'viro order status', 'order tracking cod', 'viro pk delivery update'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Track My Order — Viro.pk',
    description: 'Real-time order tracking. Enter your phone to see order history and delivery updates.',
    url: 'https://viro.pk/orders',
    type: 'website',
  },
}

export default function OrdersPage() {
  return (
          <OrdersClient />
  )
}
