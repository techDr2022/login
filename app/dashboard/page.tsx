export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { SuperAdminDashboard } from '@/components/dashboard/super-admin-dashboard'
import { EmployeeDashboard } from '@/components/dashboard/employee-dashboard'
import { UserRole } from '@prisma/client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const role = session.user.role as UserRole

  return (
    <LayoutWrapper>
      {role === UserRole.SUPER_ADMIN && <SuperAdminDashboard />}
      {role === UserRole.EMPLOYEE && <EmployeeDashboard />}
    </LayoutWrapper>
  )
}

