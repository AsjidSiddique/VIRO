import PartnerDashboardClient from './PartnerDashboardClient'

export const metadata = {
  title: 'Partner Dashboard — Viro.pk',
  description: 'Join the Viro.pk Partner Program — for content creators and loyal customers alike. Get your own discount coupon, share it, and earn commission on every completed order.',
  robots: { index: false, follow: false },
}

export default function PartnerPage() {
  return <PartnerDashboardClient />
}
