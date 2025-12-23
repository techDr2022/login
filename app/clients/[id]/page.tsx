export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ClientDetail } from '@/components/clients/client-detail'

export default async function ClientDetailPage({
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
      <ClientDetail clientId={params.id} />
    </LayoutWrapper>
  )
}

