import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { canAccessDesignerWorkspace } from '@/lib/rbac'
import { getMonthOverview } from './actions'
import { DesignerWorkspacePage } from './_components/designer-workspace-page'
import { TaskAssignmentAlerts } from '@/components/tasks/task-assignment-alerts'

function getMonthKeyForDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getInitialMonth(monthParam?: string | string[]): string {
  const month = Array.isArray(monthParam) ? monthParam[0] : monthParam
  if (month && /^\d{4}-\d{2}$/.test(month)) return month
  return getMonthKeyForDate(new Date())
}

export const dynamic = 'force-dynamic'

export default async function DesignerPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>
}) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    redirect('/login')
  }

  const role = session.user.role as UserRole
  if (!canAccessDesignerWorkspace(role)) {
    redirect('/dashboard')
  }

  const query = searchParams ? await searchParams : undefined
  const monthKey = getInitialMonth(query?.month)
  const overview = await getMonthOverview({ monthKey })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <TaskAssignmentAlerts />
      <DesignerWorkspacePage initialMonthKey={monthKey} initialOverview={overview} />
    </div>
  )
}

