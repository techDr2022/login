export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { EmployeesManagementPage } from '@/components/employees/employees-management-page'
import { UserRole } from '@prisma/client'

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const role = session.user.role as UserRole

  // Only Super Admin can access
  if (role !== UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  return (
    <LayoutWrapper>
      <EmployeesManagementPage />
    </LayoutWrapper>
  )
}

