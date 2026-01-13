export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every 60 seconds

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { UserRole } from '@prisma/client'
import dynamicImport from 'next/dynamic'

// Lazy load dashboard components for better code splitting
const SuperAdminDashboard = dynamicImport(
  () => import('@/components/dashboard/super-admin-dashboard').then(mod => ({ default: mod.SuperAdminDashboard })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    ),
    ssr: true,
  }
)

const EmployeeDashboard = dynamicImport(
  () => import('@/components/dashboard/employee-dashboard').then(mod => ({ default: mod.EmployeeDashboard })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    ),
    ssr: true,
  }
)

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

