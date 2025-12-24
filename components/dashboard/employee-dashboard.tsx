import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmployeeDashboardData } from '@/lib/dashboard-queries'
import { EmployeeDashboardClient } from './employee-dashboard-client'

export async function EmployeeDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const data = await getEmployeeDashboardData(session.user.id)
  
  return <EmployeeDashboardClient data={data} userName={session.user.name || 'Employee'} />
}
