'use client'

import { ClientDetailTabs } from './client-detail-tabs'

interface ClientDetailProps {
  clientId: string
}

export function ClientDetail({ clientId }: ClientDetailProps) {
  return <ClientDetailTabs clientId={clientId} />
}

