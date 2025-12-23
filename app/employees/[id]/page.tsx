import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { EmployeeDetail } from '@/components/employees/employee-detail'
import { UserRole } from '@prisma/client'

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  return (
    <LayoutWrapper>
      <EmployeeDetail employeeId={params.id} />
    </LayoutWrapper>
  )
}

