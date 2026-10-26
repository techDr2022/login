import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { EngineTaskCards } from '@/components/engine/engine-task-cards'
import { myEngineTasks } from '@/lib/engine/query'
import { getISTDateKey } from '@/lib/attendance-config'
import type { Actor } from '@/lib/engine/rules'

export const dynamic = 'force-dynamic'

function actorFor(role: string): Actor {
  if (role === 'SUPER_ADMIN') return 'admin'
  if (role === 'COORDINATOR') return 'coordinator'
  return 'assignee'
}

export default async function MyDayPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const tasks = await myEngineTasks(session.user.id)
  const today = getISTDateKey(new Date())
  const now = Date.now()
  const todayTasks = tasks.filter((task) => task.dueDate && getISTDateKey(task.dueDate) === today)
  const overdue = tasks.filter((task) => task.dueDate && getISTDateKey(task.dueDate) < today && task.dueDate.getTime() < now && !task.worktemplate?.istimelock)
  const upcoming = tasks.filter((task) => task.dueDate && getISTDateKey(task.dueDate) > today)
  const actor = actorFor(session.user.role)

  return (
    <LayoutWrapper>
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-2xl font-semibold">My Day</h1>
        <section className={todayTasks.length ? 'space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4' : 'space-y-3'}>
          <div>
            <h2 className={todayTasks.length ? 'text-lg font-semibold text-amber-950' : 'text-lg font-medium'}>Due today</h2>
            {todayTasks.length > 0 ? (
              <p className="text-sm font-medium text-amber-800">Finish these before the day ends</p>
            ) : null}
          </div>
          <EngineTaskCards tasks={todayTasks} actor={actor} empty="Nothing scheduled for today." warn />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Overdue</h2>
          <EngineTaskCards tasks={overdue} actor={actor} empty="No overdue tasks." />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Upcoming</h2>
          <EngineTaskCards tasks={upcoming.slice(0, 30)} actor={actor} empty="Nothing upcoming." />
        </section>
      </div>
    </LayoutWrapper>
  )
}
