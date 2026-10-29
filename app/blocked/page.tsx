import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { EngineTaskCards } from '@/components/engine/engine-task-cards'
import { imWaitingOn } from '@/lib/engine/query'
import { engineActor } from '@/lib/engine/rules'

export const dynamic = 'force-dynamic'

export default async function BlockedPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const tasks = await imWaitingOn(session.user.id)
  const actor = engineActor(session.user.role, true) || 'assignee'

  return (
    <LayoutWrapper>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">I'm Waiting On</h1>
        <EngineTaskCards
          tasks={tasks.map((task) => ({
            ...task,
            Client: task.Client,
            worktemplate: task.worktemplate,
          }))}
          actor={actor}
          empty="You are not blocked on anyone."
        />
        <div className="space-y-2">
          {tasks.map((task) => (
            <p key={task.id} className="text-sm text-muted-foreground">
              {task.title}
              {task.waitingon?.name ? ` · waiting on ${task.waitingon.name}` : ''}
              {task.worktemplate?.dependencies?.length
                ? ` · ${task.worktemplate.dependencies.map((dep) => dep.dependson.title).join(', ')}`
                : ''}
            </p>
          ))}
        </div>
      </div>
    </LayoutWrapper>
  )
}
