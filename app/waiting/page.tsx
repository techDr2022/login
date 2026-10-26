import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { waitingOnMe } from '@/lib/engine/query'
import { Card } from '@/components/ui/card'
import { STATUS_LABEL } from '@/lib/engine/rules'

export const dynamic = 'force-dynamic'

export default async function WaitingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const rows = await waitingOnMe(session.user.id)

  return (
    <LayoutWrapper>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Waiting on Me</h1>
        {!rows.length && <p className="text-sm text-muted-foreground">Nobody is blocked on your input.</p>}
        {rows.map(({ task, waiters }) => (
          <Card key={task.id} className="space-y-2 p-4">
            <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">{task.title}</Link>
            <p className="text-sm text-muted-foreground">{STATUS_LABEL[task.status] || task.status}</p>
            {waiters.map((waiter) => (
              <p key={waiter.title + (waiter.User_Task_assignedToIdToUser?.name || '')} className="text-sm">
                {waiter.User_Task_assignedToIdToUser?.name || 'Someone'} is waiting · {waiter.title}
              </p>
            ))}
          </Card>
        ))}
      </div>
    </LayoutWrapper>
  )
}
