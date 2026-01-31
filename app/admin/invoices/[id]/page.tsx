export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { UserRole } from '@prisma/client'
import { InvoicePreviewPage } from './invoice-preview-page'

export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
      monthlyAmount: true,
      nextPaymentDate: true,
      planDuration: true,
    },
  })

  if (!client) {
    notFound()
  }

  return (
    <LayoutWrapper>
      <InvoicePreviewPage
        clientId={client.id}
        clientName={client.name}
        doctorOrHospitalName={client.doctorOrHospitalName}
        monthlyAmount={client.monthlyAmount}
        nextPaymentDate={client.nextPaymentDate}
      />
    </LayoutWrapper>
  )
}
