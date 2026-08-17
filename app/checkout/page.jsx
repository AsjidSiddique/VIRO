import CheckoutWrapper from './CheckoutWrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Secure Checkout — Viro.pk | Cash on Delivery Pakistan',
  description: 'Complete your order securely. Cash on delivery available across Pakistan. Free delivery in Burewala on orders Rs.999+. All Pakistan Rs.2499+.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Secure Checkout — Viro.pk',
    description: 'Complete your order. Cash on delivery. Free delivery Pakistan.',
    url: 'https://viro.pk/checkout',
    type: 'website',
  },
}

export default function CheckoutPage() {
  return <CheckoutWrapper />
}
