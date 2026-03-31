import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { canAccessDesignerWorkspace } from '@/lib/rbac'
import { getMonthOverview } from './actions'
import { DesignerWorkspacePage } from './_components/designer-workspace-page'

function getMonthKeyForDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getInitialMonth(searchParams?: { month?: string }): string {
  const monthParam = searchParams?.month
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    return monthParam
  }
  return getMonthKeyForDate(new Date())
}

export const dynamic = 'force-dynamic'

export default async function DesignerPage({
  searchParams,
}: {
  searchParams?: { month?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    redirect('/login')
  }

  const role = session.user.role as UserRole
  if (!canAccessDesignerWorkspace(role)) {
    redirect('/dashboard')
  }

  const monthKey = getInitialMonth(searchParams)
  const overview = await getMonthOverview({ monthKey })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <DesignerWorkspacePage initialMonthKey={monthKey} initialOverview={overview} />
    </div>
  )
}

