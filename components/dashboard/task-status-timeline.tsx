'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { subscribeTaskEvents } from '@/lib/task-notification-stream'
import { Clock, CheckSquare2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { EmptyState, Panel, StatusBadge } from './dashboard-ui'

interface StatusChange {
  id: string
  taskId: string
  taskTitle: string
  oldStatus?: string
  newStatus: string
  changedBy: string
  changedByName: string
  timestamp: string
}

export function TaskStatusTimeline() {
  const { data: session } = useSession()
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    const fetchStatusChanges = async () => {
      try {
        const res = await fetch('/api/tasks/status-timeline')
        if (res.ok) {
          const data = await res.json()
          if (!ignore) setStatusChanges(data.statusChanges || [])
        }
      } catch (err) {
        console.error('Failed to fetch status timeline:', err)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchStatusChanges()
    if (!session?.user?.id) return () => { ignore = true }

    const unsubscribe = subscribeTaskEvents((event) => {
      if (event.type === 'status_change' && event.statusChange) {
        setStatusChanges((prev) => [event.statusChange, ...prev].slice(0, 20))
      } else if (event.type === 'task_update' && event.task) {
        fetchStatusChanges()
      }
    })

    return () => {
      ignore = true
      unsubscribe()
    }
  }, [session?.user?.id])

  const memoizedStatusChanges = useMemo(() => statusChanges.slice(0, 20), [statusChanges])

  if (loading) {
    return (
      <Panel title="Recent activity" description="Task updates as they happen" icon={Clock}>
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-slate-400" />
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="Recent activity" description="Task updates as they happen" icon={Clock}>
      {statusChanges.length === 0 ? (
        <EmptyState icon={CheckSquare2} title="No updates yet" hint="Status changes will appear here as the team works." />
      ) : (
        <div className="relative px-2">
          <div className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-200" />
          <div className="space-y-4">
            {memoizedStatusChanges.map((change) => (
              <div key={change.id} className="relative flex items-start gap-3">
                <div className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-white" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/tasks/${change.taskId}`} className="text-sm font-medium hover:text-indigo-700">
                      {change.taskTitle}
                    </Link>
                    {change.oldStatus ? (
                      <span className="text-xs text-muted-foreground line-through">{change.oldStatus}</span>
                    ) : null}
                    <StatusBadge value={change.newStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {change.changedByName} · {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })} ·{' '}
                    {format(new Date(change.timestamp), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

