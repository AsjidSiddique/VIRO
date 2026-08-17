import ShopClient from './ShopClient'
import { createServerSupabaseClient } from '../../lib/supabase'

// force-dynamic: shop page has live filters, stock counts, and user-specific state.
// ISR causes intermittent 500s in Next.js 14 when revalidation clashes with renders.
// ISR: revalidate every 60s
export const revalidate = 60

export const metadata = {
  title: 'Shop Online Pakistan — Viro.pk | Free Delivery, Cash on Delivery',
  description: "Shop bags, electronics, women's fashion, watches, cosmetics & more online in Pakistan. FREE delivery in Burewala on orders Rs.999+. FREE delivery all Pakistan on Rs.2499+. Cash on delivery.",
  keywords: [
    'online shopping pakistan', 'buy online pakistan', 'cash on delivery pakistan',
    'free delivery burewala', 'shop online punjab', 'women fashion online pakistan',
    'bags online pakistan', 'electronics pakistan online', 'best deals pakistan',
    'viro pk shop', 'cod pakistan delivery'
  ],
  alternates: { canonical: 'https://viro.pk/shop' },
  openGraph: {
    title: 'Shop Online — Viro.pk | Quality Products, Fast Delivery',
    description: 'Quality products with FREE delivery. Burewala Rs.999+, All Pakistan Rs.2499+. Cash on delivery.',
    url: 'https://viro.pk/shop',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Viro.pk Online Shop Pakistan' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop Online — Viro.pk',
    description: 'Quality products. Free delivery. Cash on delivery across Pakistan.',
    images: ['/og-image.jpg'],
  },
}

const SHOP_SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://viro.pk' },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://viro.pk/shop' },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Shop — Viro.pk',
    description: "Shop quality products online in Pakistan. Bags, electronics, women's fashion, watches, cosmetics & more. Cash on delivery. Free delivery across Pakistan.",
    url: 'https://viro.pk/shop',
    publisher: { '@type': 'Organization', name: 'Viro.pk', url: 'https://viro.pk' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://viro.pk' },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://viro.pk/shop' },
      ],
    },
  },
]

export default async function ShopPage() {
  // BUGFIX (perf): this page used to render <ShopClient/> with zero data —
  // every visitor saw a blank loading skeleton while JS booted, THEN a
  // client-side fetch of *every* active product (no limit, full columns)
  // even started. Home already solved this exact problem (see app/page.jsx)
  // by fetching the first batch server-side so the page paints with real
  // content immediately; Shop — arguably the more important page for
  // conversion — never got the same treatment. Mirrors that pattern
  // exactly: same fallback-to-client-fetch behavior if this fails.
  let initialProducts = []
  try {
    const supabase = createServerSupabaseClient()
    if (supabase) {
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,image_url,parent_id,status,is_visible)')
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false })
        .limit(200)
      initialProducts = data || []
    }
  } catch { /* silent — ShopClient's own client-side fetch is the fallback */ }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SHOP_SCHEMAS) }} />
              <ShopClient initialProducts={initialProducts} />
    </>
  )
}
