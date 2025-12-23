import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ClientOnboardingWizard } from '@/components/clients/client-onboarding-wizard-edit'

export default async function EditOnboardingPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <LayoutWrapper>
      <ClientOnboardingWizard clientId={params.id} />
    </LayoutWrapper>
  )
}

