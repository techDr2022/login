import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { MyDayView } from '@/components/engine/my-day-view'
import { myDayTasks } from '@/lib/engine/query'
import { engineActor } from '@/lib/engine/rules'

export const dynamic = 'force-dynamic'

function actorFor(role: string) {
  return engineActor(role, true) || 'assignee'
}

export default async function MyDayPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const list = await myDayTasks(session.user.id)

  return (
    <LayoutWrapper>
      <MyDayView list={list} actor={actorFor(session.user.role)} />
    </LayoutWrapper>
  )
}
