export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ClientOnboardingWizard } from '@/components/clients/client-onboarding-wizard'

export default async function NewClientPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <LayoutWrapper>
      <ClientOnboardingWizard />
    </LayoutWrapper>
  )
}

