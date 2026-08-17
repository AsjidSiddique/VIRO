'use client'
import { PartnerProvider } from '../../context/PartnerContext'
import PartnerShell from '../../components/PartnerShell'

export default function PartnerLayout({ children }) {
  return (
    <PartnerProvider>
      <PartnerShell>{children}</PartnerShell>
    </PartnerProvider>
  )
}
