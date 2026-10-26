import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { getAutomationData } from '@/app/actions/automation-actions'
import { AutomationPage } from '@/components/automation/automation-page'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    redirect('/dashboard')
  }
  const data = await getAutomationData()
  return (
    <LayoutWrapper>
      <AutomationPage data={JSON.parse(JSON.stringify(data))} />
    </LayoutWrapper>
  )
}
