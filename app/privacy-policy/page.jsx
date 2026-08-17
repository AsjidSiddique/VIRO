import PolicyPageClient from '../../components/PolicyPageClient'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

export const metadata = {
  title: 'Privacy Policy — Viro.pk',
  description:
    'Learn how Viro.pk collects, uses, and protects your personal information when you shop with us online.',
  keywords: [
    'privacy policy pakistan',
    'viro pk privacy policy',
    'online shopping privacy',
    'data protection pakistan',
  ],
  alternates: {
    canonical: 'https://www.viro.pk/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy — Viro.pk',
    description:
      'Your privacy matters to us. Learn how we collect, use, and protect your information.',
    url: 'https://www.viro.pk/privacy-policy',
    type: 'website',
    siteName: 'Viro.pk',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Privacy Policy — Viro.pk' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@viropk',
    title: 'Privacy Policy — Viro.pk',
    description: 'Learn how Viro.pk protects and manages your personal information.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
}

const DEFAULT_CONTENT = {
  title: 'Privacy Policy',
  lastUpdated: 'May 2026',
  sections: [
    {
      heading: 'Introduction',
      body: 'At Viro.pk, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our website or place an order.',
    },
    {
      heading: 'Information We Collect',
      body: 'When you place an order or contact us, we may collect your name, phone number, delivery address, email address (if provided), and order details. We do not collect or store debit or credit card information for Cash on Delivery orders.',
    },
    {
      heading: 'How We Use Your Information',
      body: 'Your information is used to process orders, arrange deliveries, provide customer support, improve our services, and communicate important order updates. We only collect information necessary to operate our business effectively.',
    },
    {
      heading: 'Sharing of Information',
      body: 'We do not sell customer information. However, limited information may be shared with trusted service providers such as courier partners, hosting providers, or communication platforms strictly for order fulfillment and business operations.',
    },
    {
      heading: 'WhatsApp, Calls & SMS',
      body: 'By placing an order or contacting us, you agree to receive order confirmations, delivery updates, and customer support communications through WhatsApp, phone calls, or SMS.',
    },
    {
      heading: 'Cookies & Website Usage',
      body: 'Our website may use cookies or similar technologies to improve user experience, remember cart items, maintain login sessions, and analyze website performance. You may disable cookies through your browser settings if preferred.',
    },
    {
      heading: 'Data Security',
      body: 'We implement reasonable technical and organizational security measures to protect your information against unauthorized access, misuse, or disclosure. While we strive to protect your data, no internet transmission or storage system can be guaranteed 100% secure.',
    },
    {
      heading: 'Data Retention',
      body: 'We retain customer information only as long as necessary for order processing, customer support, legal compliance, and business record purposes.',
    },
    {
      heading: 'Your Rights',
      body: 'You may request access, correction, or deletion of your personal information by contacting us. We will make reasonable efforts to respond to verified requests within a reasonable timeframe.',
    },
    {
      heading: 'Third-Party Links',
      body: 'Our website may contain links to third-party websites or services. We are not responsible for the privacy practices or content of external websites.',
    },
    {
      heading: 'Policy Updates',
      body: 'Viro.pk may update this Privacy Policy from time to time to reflect operational, legal, or technical changes. Updated versions will be posted on this page with the revised date.',
    },
    {
      heading: 'Contact Us',
      body: 'If you have questions regarding this Privacy Policy or your personal information, please contact us at support@viro.pk or WhatsApp us at +92-329-0081469.',
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
      .eq('key', 'page_privacy')
      .single()
    return data?.value ? { ...DEFAULT_CONTENT, ...data.value } : DEFAULT_CONTENT
  } catch {
    return DEFAULT_CONTENT
  }
}

export default async function PrivacyPolicyPage() {
  const content = await getContent()
  return (
          <PolicyPageClient content={content} icon="🔒" />
  )
}