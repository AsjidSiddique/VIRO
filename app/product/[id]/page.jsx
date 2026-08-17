import { Suspense } from 'react'
import ProductDetailClient from './ProductDetailClient'
import { extractId } from '../../../lib/slugify' // ← added

export const dynamic = 'force-dynamic'
export function generateStaticParams() { return [] }

function clean(s) {
  if (typeof s !== 'string') return s ?? null
  return s.replace(/\u0000/g, '').replace(/\x00/g, '').trim()
}

async function getProductRating(productId) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || !productId) return null
    const res = await fetch(
      `${url}/rest/v1/product_ratings?select=avg_rating,review_count&product_id=eq.${encodeURIComponent(productId)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0] || null
  } catch {
    return null
  }
}

async function getProduct(rawParam) {
  try {
    // param may be "red-leather-shoes-abc123" — extract real id (last segment)
    const id = extractId(rawParam) // ← changed: was just `id` passed directly
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || !id) return null
    const cols = 'id,name,price,discount_price,images,description,stock,category_id,meta_title,meta_description,canonical_url,noindex,categories(id,name,slug,icon)'
    const res = await fetch(
      `${url}/rest/v1/products?select=${encodeURIComponent(cols)}&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const rows = await res.json()
    const p = rows?.[0]
    if (!p) return null
    if (Array.isArray(p.categories)) p.categories = p.categories[0] ?? null
    for (const k of Object.keys(p)) {
      if (typeof p[k] === 'string') p[k] = clean(p[k])
      else if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k])) {
        for (const j of Object.keys(p[k])) {
          if (typeof p[k][j] === 'string') p[k][j] = clean(p[k][j])
        }
      }
    }
    return p
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  try {
    const rawParam = (await params)?.id
    const p = await getProduct(rawParam)
    if (!p) return { title: 'Product | Viro.pk' }

    const name        = p.name || 'Product'
    const title       = p.meta_title || `Buy ${name} Online in Pakistan | Viro.pk`
    const description = p.meta_description || p.description
      ? (p.meta_description || p.description || '').slice(0, 160)
      : `Buy ${name} at Viro.pk. Cash on delivery across Pakistan. Fast delivery.`
    const canonical   = p.canonical_url || `https://www.viro.pk/product/${rawParam}`
    const productId   = extractId(rawParam)

    // Product image — first image from the array
    let productImg = null
    try {
      const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
      productImg = Array.isArray(imgs) ? imgs.find(u => typeof u === 'string' && u.startsWith('http')) : null
    } catch {}

    // OG image URLs — two versions:
    // 1. Portrait 1080×1920 (9:16) — WhatsApp Status fills the full screen
    // 2. Square 1080×1080 (1:1)   — WhatsApp chat link card, Facebook, Twitter
    const ogPortrait = productId
      ? `https://www.viro.pk/api/og?id=${productId}`
      : productImg || 'https://www.viro.pk/og-image.jpg'
    const ogSquare = productId
      ? `https://www.viro.pk/api/og?id=${productId}&m=card`
      : productImg || 'https://www.viro.pk/og-image.jpg'

    // Price for structured data
    const price = p.discount_price && p.discount_price < p.price
      ? p.discount_price
      : p.price

    return {
      title,
      description,
      robots: p.noindex ? { index: false, follow: false } : { index: true, follow: true },
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url:       canonical,
        siteName:  'Viro.pk',
        type:      'website',
        locale:    'en_PK',
        images: [
          // Portrait 9:16 — WhatsApp Status fills the full vertical screen
          {
            url:    ogPortrait,
            width:  1080,
            height: 1920,
            alt:    name,
            type:   'image/jpeg',
          },
          // Square 1:1 — WhatsApp chat cards, Facebook, Twitter
          {
            url:    ogSquare,
            width:  1080,
            height: 1080,
            alt:    name,
            type:   'image/jpeg',
          },
          // Raw product image fallback
          ...(productImg ? [{
            url:    productImg,
            width:  800,
            height: 800,
            alt:    name,
          }] : []),
        ],
      },
      twitter: {
        card:        'summary_large_image',
        title,
        description,
        images:      [ogSquare],
      },
      // WhatsApp uses og: tags — these are critical
      other: {
        'og:price:amount':   price ? String(price) : undefined,
        'og:price:currency': 'PKR',
        'product:price:amount':   price ? String(price) : undefined,
        'product:price:currency': 'PKR',
      },
    }
  } catch {
    return { title: 'Product | Viro.pk' }
  }
}

export default async function ProductPage({ params }) {
  let rawParam = null
  try { rawParam = (await params)?.id } catch {}

  let jsonLd = null
  try {
    const p = await getProduct(rawParam)
    if (p) {
      const price = p.discount_price && p.discount_price < p.price ? p.discount_price : p.price
      let productImages = []
      try {
        const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images
        productImages = Array.isArray(imgs) ? imgs.filter(u => typeof u === 'string' && u.startsWith('http')) : []
      } catch {}
      const rating = await getProductRating(p.id)
      const canonical = p.canonical_url || `https://www.viro.pk/product/${rawParam}`

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        ...(productImages.length ? { image: productImages } : {}),
        description: (p.meta_description || p.description || `Buy ${p.name} at Viro.pk`).slice(0, 500),
        sku: String(p.id),
        brand: { '@type': 'Brand', name: 'Viro.pk' },
        ...(p.categories?.name ? { category: p.categories.name } : {}),
        offers: {
          '@type': 'Offer',
          url: canonical,
          priceCurrency: 'PKR',
          price: String(price ?? ''),
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        ...(rating && rating.review_count > 0 ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(rating.avg_rating),
            reviewCount: String(rating.review_count),
          },
        } : {}),
      }
    }
  } catch { jsonLd = null }

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <Suspense fallback={
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #8B5CF6', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      }>
        {/* initialProduct is always null — client fetches its own data.
            Passing SSR product causes crash during React server-render of
            the full product UI tree (digest: 2206970223). Client already
            has its own fetch fallback built in via useEffect. */}
        <ProductDetailClient initialProduct={null} />
      </Suspense>
    </>
  )
}
