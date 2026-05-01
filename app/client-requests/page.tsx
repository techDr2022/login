export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { getClientRequests } from '@/app/actions/client-request-actions'
import { ClientRequestsPanel } from '@/components/client-requests/client-requests-panel'

export default async function ClientRequestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const rows = await getClientRequests()
  const initialRequests = rows.map((r) => ({
    ...r,
    receivedAt: r.receivedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  return (
    <LayoutWrapper>
      <ClientRequestsPanel initialRequests={initialRequests} />
    </LayoutWrapper>
  )
}
