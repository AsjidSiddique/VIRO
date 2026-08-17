
import PolicyPageClient from '../../components/PolicyPageClient'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

export const metadata = {
  title: 'Terms & Conditions — Viro.pk',

  description:
    'Read the official Terms & Conditions for shopping on Viro.pk, including order processing, delivery, returns, cancellations, and customer responsibilities.',

  keywords: [
    'viro pk terms',
    'terms and conditions pakistan',
    'online shopping terms',
    'cash on delivery pakistan',
    'ecommerce policy pakistan',
  ],

  alternates: {
    canonical: 'https://viro.pk/terms',
  },

  openGraph: {
    title: 'Terms & Conditions — Viro.pk',

    description:
      'Clear and fair shopping terms for orders, delivery, returns, and customer use of Viro.pk.',

    url: 'https://viro.pk/terms',

    type: 'website',

    siteName: 'Viro.pk',

    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Terms & Conditions — Viro.pk',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',

    site: '@viropk',

    title: 'Terms & Conditions — Viro.pk',

    description:
      'Official terms for shopping, delivery, returns, and order processing at Viro.pk.',

    images: ['/og-image.jpg'],
  },

  robots: {
    index: true,
    follow: true,
  },
}

const DEFAULT_CONTENT = {
  title: 'Terms & Conditions',

  lastUpdated: 'May 2026',

  sections: [
    {
      heading: 'Introduction',

      body:
        'Welcome to Viro.pk. By accessing our website or placing an order, you agree to comply with these Terms & Conditions. Please read them carefully before using our services.',
    },

    {
      heading: 'Products & Availability',

      body:
        'All products displayed on Viro.pk are subject to availability. We reserve the right to limit quantities, discontinue products, or update product information, pricing, and specifications without prior notice.',
    },

    {
      heading: 'Pricing',

      body:
        'All prices on Viro.pk are listed in Pakistani Rupees (PKR). While we strive for accuracy, pricing or typographical errors may occasionally occur. Viro.pk reserves the right to cancel or refuse orders affected by incorrect pricing or product information.',
    },

    {
      heading: 'Orders & Confirmation',

      body:
        'Placing an order does not guarantee acceptance. Orders may require verification through phone call, SMS, or WhatsApp before dispatch. Viro.pk reserves the right to refuse or cancel any order suspected of fraud, abuse, or unauthorized activity.',
    },

    {
      heading: 'Cash on Delivery (COD)',

      body:
        'Most orders are fulfilled through Cash on Delivery (COD). Customers are responsible for ensuring availability at the delivery address to receive and pay for the order.',
    },

    {
      heading: 'Shipping & Delivery',

      body:
        'Estimated delivery times are provided for convenience and may vary depending on city, courier operations, weather conditions, public holidays, or other external factors. Viro.pk is not responsible for delays beyond our reasonable control.',
    },

    {
      heading: 'Returns & Refunds',

      body:
        'Returns and refunds are governed by our Return & Refund Policy. Customers are encouraged to review the policy before placing an order.',
    },

    {
      heading: 'Order Cancellation',

      body:
        'Orders may only be cancelled before dispatch confirmation. Once an order has been shipped, cancellation requests may not be accepted. Repeated fake orders or unjustified refusals may result in future order restrictions.',
    },

    {
      heading: 'User Responsibilities',

      body:
        'Customers agree to provide accurate contact, delivery, and order information. Misuse of the website, fraudulent activity, abusive behavior, or attempts to disrupt operations may result in account or order restrictions.',
    },

    {
      heading: 'Intellectual Property',

      body:
        'All website content including logos, product images, graphics, text, branding, and design elements are the property of Viro.pk or respective content owners and may not be copied, reproduced, or used without permission.',
    },

    {
      heading: 'Limitation of Liability',

      body:
        'To the maximum extent permitted by law, Viro.pk shall not be liable for indirect, incidental, special, or consequential damages arising from the use of our website, products, or services. Our maximum liability shall not exceed the amount paid for the relevant order.',
    },

    {
      heading: 'Privacy',

      body:
        'Customer information is handled in accordance with our Privacy Policy. By using Viro.pk, you consent to the collection and use of information as described in that policy.',
    },

    {
      heading: 'Changes to Terms',

      body:
        'Viro.pk reserves the right to update or modify these Terms & Conditions at any time without prior notice. Continued use of the website after changes constitutes acceptance of the updated terms.',
    },

    {
      heading: 'Governing Law',

      body:
        'These Terms & Conditions shall be governed and interpreted in accordance with the laws of Pakistan. Any disputes shall be subject to the jurisdiction of the courts of Punjab, Pakistan.',
    },

    {
      heading: 'Contact Us',

      body:
        'For questions regarding these Terms & Conditions, contact us at support@viro.pk or WhatsApp +92-329-0081469.',
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
      .eq('key', 'page_terms')
      .single()

    return data?.value
      ? { ...DEFAULT_CONTENT, ...data.value }
      : DEFAULT_CONTENT
  } catch {
    return DEFAULT_CONTENT
  }
}

export default async function TermsPage() {
  const content = await getContent()

  return (
          <PolicyPageClient content={content} icon="📋" />
  )
}
