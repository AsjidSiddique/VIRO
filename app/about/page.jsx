import AboutClient from './AboutClient'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300 // 5 min ISR — content rarely changes

export const metadata = {
  title: 'About Viro.pk — Trusted Online Shopping, Burewala Punjab Pakistan',
  description: "Learn about Viro.pk — Pakistan's trusted online store based in Burewala, Punjab. Quality products, cash on delivery, same-day dispatch, 7-day easy returns. Real people, real support on WhatsApp and phone.",
  keywords: ['about viro pk', 'online store burewala', 'trusted online shopping pakistan', 'viro pk story', 'cash on delivery store pakistan', 'online shopping punjab'],
  alternates: { canonical: 'https://viro.pk/about' },
  openGraph: {
    title: 'About Viro.pk — Trusted Online Store, Burewala Punjab',
    description: 'Based in Burewala. Quality products, COD, fast delivery. Real team, real support.',
    url: 'https://viro.pk/about',
    type: 'website',
    siteName: 'Viro.pk',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'About Viro.pk' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@viropk',
    title: 'About Viro.pk — Trusted Online Store',
    description: 'Based in Burewala Punjab. COD, fast delivery, real support. 7-day returns.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
}

const DEFAULT_ABOUT = {
  hero_title: 'About Viro',
  hero_subtitle: 'Smart Shopping, Better Living.',
  story: `Viro was founded with one mission — to bring quality products to every doorstep in Pakistan at honest prices.

We started in Burewala, Punjab, and have grown to serve customers across the country. We believe shopping online should be simple, safe, and satisfying.

Every product we carry is hand-picked for quality. Every order is packed with care. And every customer who reaches out gets a real response — not a bot.`,
  values: [
    { icon: '🛡️', title: 'Safe Shopping',      desc: 'Secure checkout. Your data is never shared.' },
    { icon: '📦', title: 'Easy Returns',        desc: 'Simple return process, no questions asked.' },
    { icon: '💵', title: 'Cash on Delivery',    desc: 'Pay only when your order arrives at your door.' },
    { icon: '⭐', title: 'Verified Reviews',     desc: 'Real buyers, honest feedback — always.' },
    { icon: '🚀', title: 'Same-Day Dispatch',   desc: 'Orders confirmed before 4 PM ship the same day.' },
    { icon: '🤝', title: 'Live Support',         desc: 'WhatsApp & call support, 7 days a week.' },
  ],
  team_note: 'We are a small, passionate team based in Punjab, Pakistan — dedicated to making your online shopping experience the best it can be.',
}

async function getAboutContent() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'page_about').single()
    return data?.value ? { ...DEFAULT_ABOUT, ...data.value } : DEFAULT_ABOUT
  } catch { return DEFAULT_ABOUT }
}

export default async function AboutPage() {
  const content = await getAboutContent()
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": content.hero_title || "About Viro",
    "description": content.hero_subtitle || "Smart Shopping, Better Living.",
    "url": "https://viro.pk/about",
    "publisher": { "@type": "Organization", "name": "Viro", "url": "https://viro.pk" }
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />
      <AboutClient content={content} />
    </>
  )
}
