import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { getPortalHome } from '@/app/actions/portal-actions'
import { PortalHome } from '@/components/portal/portal-home'

export const dynamic = 'force-dynamic'

export default async function PortalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role !== UserRole.CLIENT) redirect('/dashboard')

  const data = await getPortalHome()
  return (
    <PortalHome
      userName={session.user.name}
      clients={data.clients}
      tasks={data.tasks.map((task) => ({
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        deliverableurl: task.deliverableurl,
        category: task.category,
      }))}
    />
  )
}
