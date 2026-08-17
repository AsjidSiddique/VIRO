import WishlistClient from './WishlistClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My Wishlist — Saved Products | Viro.pk',
  description: 'View and manage your saved products on Viro.pk. Quick order, add to cart, or remove items from your wishlist. Shop quality products with fast delivery across Pakistan.',
  keywords: ['wishlist pakistan', 'saved products viro', 'online shopping wishlist', 'viro pk favourites'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'My Wishlist — Viro.pk',
    description: 'Your saved products on Viro.pk. Fast delivery across Pakistan, cash on delivery.',
    url: 'https://viro.pk/wishlist',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Viro.pk Wishlist' }],
  },
}

export default function WishlistPage() {
  return (
          <WishlistClient />
  )
}
