import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EngineStatusButtons } from '@/components/engine/status-buttons'
import { STATUS_LABEL, actionsFor, type Actor } from '@/lib/engine/rules'

type Row = {
  id: string
  title: string
  status: string
  dueDate: Date | null
  priority: string
  noinputflag: boolean
  Client: { name: string } | null
  worktemplate: { istimelock: boolean; donewhen: string | null } | null
}

function when(date: Date | null) {
  if (!date) return 'No time'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function EngineTaskCards({
  tasks,
  actor,
  empty,
  warn = false,
}: {
  tasks: Row[]
  actor: Actor
  empty: string
  warn?: boolean
}) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  const now = Date.now()
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const overdue = !!task.dueDate && task.dueDate.getTime() < now && !task.worktemplate?.istimelock && task.status !== 'Done'
        return (
          <Card key={task.id} className={warn ? 'space-y-3 border-amber-300 bg-amber-100/70 p-4' : 'space-y-3 p-4'}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/tasks/${task.id}`} className={warn ? 'font-medium text-amber-950 hover:underline' : 'font-medium hover:underline'}>
                  {task.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {when(task.dueDate)}
                  {task.Client?.name ? ` · ${task.Client.name}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{STATUS_LABEL[task.status] || task.status}</Badge>
                {overdue && <Badge variant="destructive">Overdue</Badge>}
                {task.noinputflag && <Badge variant="secondary">No input task found</Badge>}
              </div>
            </div>
            <EngineStatusButtons
              taskId={task.id}
              status={task.status}
              actions={actionsFor(task.status, actor, !!task.worktemplate?.istimelock)}
            />
          </Card>
        )
      })}
    </div>
  )
}
