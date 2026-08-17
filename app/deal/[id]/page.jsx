import DealDetailClient from './DealDetailClient'

export const dynamic = 'force-dynamic'
export function generateStaticParams() { return [] }

export default function DealPage({ params }) {
  return <DealDetailClient dealId={params.id} />
}
