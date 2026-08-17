import PolicyPageClient from '../../components/PolicyPageClient'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

export const metadata = {
  title: 'Return & Refund Policy — Viro.pk',
  description:
    'Return & Refund Policy at Viro.pk. Damaged or incorrect item? Report within 12 hours of delivery. Change of mind returns are not accepted.',
  alternates: { canonical: 'https://www.viro.pk/return-policy' },
  openGraph: {
    title: 'Return & Refund Policy — Viro.pk',
    description: 'Damaged or incorrect item? Report within 12 hours. Change of mind returns not accepted.',
    url: 'https://www.viro.pk/return-policy',
    type: 'website',
    siteName: 'Viro.pk',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Return & Refund Policy — Viro.pk' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@viropk',
    title: 'Return & Refund Policy — Viro.pk',
    description: 'Easy returns and refunds at Viro.pk.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
}

const DEFAULT_CONTENT = {
  title: 'Return & Refund Policy',
  lastUpdated: 'June 2026',
  sections: [
    {
      heading: '1. Damaged / Incorrect Item',
      body: 'If you receive a damaged, defective, incorrect, or incomplete item, you must report it within 12 hours of receiving your order. Contact us immediately on WhatsApp with your order number, clear photos/videos of the item and packaging. Reports made after 12 hours of delivery will not be accepted.',
    },
    {
      heading: '2. Change of Mind — No Return',
      body: 'We do not accept returns for change of mind. Please review your order carefully before placing it. Once an order is confirmed and dispatched, it cannot be returned simply because you changed your mind or no longer want the item.',
    },
    {
      heading: 'Non-Returnable Products',
      body: 'For hygiene and safety reasons, opened cosmetics, skincare, personal care, grooming, and hygiene-related items cannot be returned or exchanged unless they arrive damaged or defective.',
    },
    {
      heading: 'How to Request a Return',
      body: 'To start a return request, contact our support team on WhatsApp or email with your order number, issue details, and clear photos/videos of the product and packaging. Our team will review and respond within 24 hours.',
    },
    {
      heading: 'Replacement & Refund Process',
      body: 'If your request is approved, we may offer a replacement, store credit, or refund depending on the situation and product availability. Refunds are processed within 3–7 business days after successful inspection of the returned item.',
    },
    {
      heading: 'Refund Methods',
      body: 'Approved refunds are issued via EasyPaisa, JazzCash, or bank transfer. Cash refunds are not available.',
    },
    {
      heading: 'Return Shipping',
      body: 'Viro.pk covers return shipping costs only for damaged, defective, incorrect, or incomplete orders. Customers may need to cover shipping charges for other approved returns.',
    },
    {
      heading: 'Order Cancellation',
      body: 'Orders can only be cancelled before dispatch. Once shipped, the order will follow the standard return process.',
    },
    {
      heading: 'Important Conditions',
      body: 'Returned items must include original packaging, accessories, tags, manuals, and free gifts (if applicable). Viro.pk reserves the right to reject returns that do not meet our policy conditions.',
    },
    {
      heading: 'Contact Support',
      body: 'WhatsApp: +92-329-0081469 | Email: support@viro.pk | Support Hours: 9 AM – 9 PM, Monday to Sunday',
    },
  ],
}

async function getContent() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await sb
      .from('site_settings')
      .select('value')
      .eq('key', 'page_return')
      .single()
    return data?.value ? { ...DEFAULT_CONTENT, ...data.value } : DEFAULT_CONTENT
  } catch {
    return DEFAULT_CONTENT
  }
}

export default async function ReturnPolicyPage() {
  const content = await getContent()
  return (
          <PolicyPageClient content={content} icon="↩️" />
  )
}