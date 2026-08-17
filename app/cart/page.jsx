import CartClient from './CartClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your Cart — Viro.pk | Review & Checkout',
  description: 'Review your selected products and proceed to secure checkout. Cash on delivery available across Pakistan. Free delivery on Rs.2499+ orders.',
  keywords: ['shopping cart pakistan', 'checkout viro', 'cod pakistan', 'buy online pakistan'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Your Cart — Viro.pk',
    description: 'Review your items and checkout. Cash on delivery. Free delivery Pakistan.',
    url: 'https://viro.pk/cart',
    type: 'website',
  },
}

export default function CartPage() {
  return (
          <CartClient />
  )
}
