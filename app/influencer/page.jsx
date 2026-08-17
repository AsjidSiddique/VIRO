import { redirect } from 'next/navigation'

// Renamed from /influencer to /partner — the program now also welcomes
// loyal repeat customers, not just social-media influencers, so the old
// name/URL stopped fitting. This redirect just protects anyone who already
// bookmarked or shared the old link.
export default function OldInfluencerUrlRedirect() {
  redirect('/partner')
}
