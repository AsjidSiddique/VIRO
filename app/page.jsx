import HomeClient from './HomeClient'
import { createServerSupabaseClient } from '../lib/supabase'

// force-dynamic: prevents ISR 500s in Next.js 14. Homepage has live product data.
// ISR: revalidate every 60s — products served from CDN, not Supabase on every visit
export const revalidate = 60

export const metadata = {
  title: 'Viro.pk — Online Shopping Pakistan | COD, Free Delivery, Best Deals',
  description: "Shop quality products online in Pakistan — bags, electronics, women's fashion, watches & more. FREE delivery in Burewala on Rs.999+. All Pakistan on Rs.2499+. Cash on delivery available everywhere.",
  keywords: [
    'online shopping pakistan', 'buy online cod pakistan', 'free delivery pakistan',
    'cash on delivery shopping', 'burewala online store', 'viro pk',
    'best online store pakistan', 'women fashion pakistan', 'electronics online pakistan',
    'bags online pakistan', 'shop online punjab pakistan', 'new arrivals pakistan',
  ],
  alternates: { canonical: 'https://viro.pk' },
  openGraph: {
    title: 'Viro.pk — Online Shopping Pakistan | COD & Free Delivery',
    description: 'Quality products, free delivery, cash on delivery. Trusted by shoppers across Pakistan. Shop bags, fashion, electronics & more.',
    url: 'https://viro.pk',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Viro.pk — Online Shopping Pakistan' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viro.pk — Online Shopping Pakistan',
    description: 'Free delivery. Cash on delivery. Quality products shipped across Pakistan.',
    images: ['/og-image.jpg'],
  },
}

const HOME_SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Viro.pk',
    url: 'https://viro.pk',
    logo: {
      '@type': 'ImageObject',
      url: 'https://viro.pk/icon-512.png',
      width: 512,
      height: 512,
    },
    sameAs: [
      'https://instagram.com/viro.pk',
      'https://facebook.com/viropk',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Burewala',
      addressRegion: 'Punjab',
      addressCountry: 'PK',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+92-327-7796566',
        contactType: 'customer service',
        areaServed: 'PK',
        availableLanguage: ['English', 'Urdu'],
        contactOption: 'TollFree',
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          opens: '09:00',
          closes: '21:00',
        },
      },
    ],
    foundingDate: '2023',
    numberOfEmployees: { '@type': 'QuantitativeValue', value: 5 },
    slogan: 'Smart Shopping, Better Living',
    description: "Pakistan's trusted online store in Burewala, Punjab. Quality products with cash on delivery, free shipping and easy returns.",
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Viro.pk',
    url: 'https://viro.pk',
    description: "Online shopping Pakistan — bags, electronics, women's fashion, watches & more. Cash on delivery, free delivery.",
    inLanguage: ['en', 'ur'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://viro.pk/shop?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Viro.pk',
    url: 'https://viro.pk',
    image: 'https://viro.pk/og-image.jpg',
    priceRange: 'Rs.500 - Rs.50,000',
    currenciesAccepted: 'PKR',
    paymentAccepted: 'Cash on Delivery',
    openingHours: 'Mo-Su 09:00-21:00',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Burewala',
      addressRegion: 'Punjab',
      addressCountry: 'PK',
    },
    hasMap: 'https://maps.google.com/?q=Burewala+Punjab+Pakistan',
    areaServed: {
      '@type': 'Country',
      name: 'Pakistan',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Do you offer cash on delivery?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes! All orders at Viro.pk are cash on delivery. Pay only when your order arrives at your door.' },
      },
      {
        '@type': 'Question',
        name: 'What is the delivery time?',
        acceptedAnswer: { '@type': 'Answer', text: 'Burewala: 1–2 days. All Pakistan: 2–5 business days. Same-day dispatch for orders confirmed before 4 PM.' },
      },
      {
        '@type': 'Question',
        name: 'What is your return policy?',
        acceptedAnswer: { '@type': 'Answer', text: 'We offer 7-day no-questions-asked returns. Refunds via EasyPaisa, JazzCash, or bank transfer within 3–5 days.' },
      },
      {
        '@type': 'Question',
        name: 'Is free delivery available?',
        acceptedAnswer: { '@type': 'Answer', text: 'FREE delivery in Burewala on orders Rs.999+. FREE delivery across all Pakistan on orders Rs.2499+.' },
      },
    ],
  },
]

export default async function HomePage() {
  // Fetch products server-side so Googlebot sees real content on first crawl.
  // Falls back gracefully if Supabase is unavailable — HomeClient refetches client-side.
  let initialProducts = []
  try {
    const supabase = createServerSupabaseClient()
    if (supabase) {
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon)')
        .or('is_active.eq.true,status.eq.coming_soon')
        .order('created_at', { ascending: false })
        .limit(200)
      initialProducts = data || []
    }
  } catch { /* silent — client-side fetch is the fallback */ }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_SCHEMAS) }}
      />
              <HomeClient initialProducts={initialProducts} />
    </>
  )
}
