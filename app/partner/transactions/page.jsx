import PartnerTransactionsClient from './PartnerTransactionsClient'

export const metadata = {
  title: 'Transaction History — Viro Partner',
  robots: { index: false, follow: false },
}

export default function PartnerTransactionsPage() {
  return <PartnerTransactionsClient />
}
