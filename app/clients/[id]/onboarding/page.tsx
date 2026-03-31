export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ClientOnboardingWizard } from '@/components/clients/client-onboarding-wizard-edit'

export default async function EditOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  return (
    <LayoutWrapper>
      <ClientOnboardingWizard clientId={id} />
    </LayoutWrapper>
  )
}

