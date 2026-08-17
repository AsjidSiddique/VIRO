import { createServerSupabaseClient } from '../../../lib/supabase'
import { notFound } from 'next/navigation'
import CategoryPageClient from './CategoryPageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { category: slug } = await Promise.resolve(params)
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return { title: 'Shop | Viro.pk' }
    const { data: cat } = await supabase
      .from('categories')
      .select('name, description, image_url')
      .eq('slug', slug)
      .maybeSingle()
    if (!cat) return { title: 'Category | Viro.pk' }
    return {
      title: `Buy ${cat.name} Online in Pakistan — Best Price, COD | Viro.pk`,
      description: `Shop the best ${cat.name.toLowerCase()} online in Pakistan at Viro.pk. ✅ Cash on delivery. 🚚 FREE delivery in Burewala Rs.999+, all Pakistan Rs.2499+. Quality guaranteed, 7-day easy returns. ${cat.description || ''}`.trim().slice(0, 160),
      keywords: [
        `buy ${cat.name.toLowerCase()} online pakistan`,
        `${cat.name.toLowerCase()} cash on delivery`,
        `best ${cat.name.toLowerCase()} pakistan`,
        `${cat.name.toLowerCase()} online shopping`,
        `cheap ${cat.name.toLowerCase()} pakistan`,
        `${cat.name.toLowerCase()} free delivery pakistan`,
        'online shopping pakistan', 'viro pk',
      ],
      alternates: { canonical: `https://viro.pk/shop/${slug}` },
      openGraph: {
        title: `Buy ${cat.name} Online — Best Price | Viro.pk`,
        description: `Best ${cat.name.toLowerCase()} online. Cash on delivery. Free delivery across Pakistan. Easy returns.`,
        url: `https://viro.pk/shop/${slug}`,
        type: 'website', siteName: 'Viro.pk',
        images: cat.image_url
          ? [{ url: cat.image_url, width: 800, height: 800, alt: cat.name },
             { url: '/og-image.jpg', width: 1200, height: 630, alt: `${cat.name} — Viro.pk` }]
          : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${cat.name} — Viro.pk` }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Buy ${cat.name} Online | Viro.pk`,
        description: `Best ${cat.name.toLowerCase()} online. COD. Free delivery Pakistan.`,
        images: cat.image_url ? [cat.image_url] : ['/og-image.jpg'],
        site: '@viropk',
      },
    }
  } catch {
    return { title: 'Shop | Viro.pk' }
  }
}

export default async function CategoryPage({ params }) {
  const { category: slug } = await Promise.resolve(params)

  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) notFound()

    const { data: cat } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, icon')
      .eq('slug', slug)
      .maybeSingle()

    if (!cat) notFound()

    const { data: products } = await supabase
      .from('products')
      .select('*, categories(id, name, icon, slug)')
      .eq('category_id', cat.id)
      .or('is_active.eq.true,status.eq.coming_soon')
      .order('created_at', { ascending: false })

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://viro.pk' },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://viro.pk/shop' },
        { '@type': 'ListItem', position: 3, name: cat.name, item: `https://viro.pk/shop/${cat.slug}` },
      ],
    }
    const itemListSchema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${cat.name} — Viro.pk`,
      url: `https://viro.pk/shop/${cat.slug}`,
      numberOfItems: (products || []).length,
      itemListElement: (products || []).slice(0, 20).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://viro.pk/product/${p.id}`,
        name: p.name,
      })),
    }

    return (
      <>
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
                  <CategoryPageClient category={cat} initialProducts={products || []} />
      </>
    )
  } catch (err) {
    // If Supabase is down / env vars missing — still render the shell,
    // the client component will handle its own data fetching
    console.error('[Viro] CategoryPage SSR error:', err?.message)
    notFound()
  }
}
