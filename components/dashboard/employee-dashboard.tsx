'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckSquare2, Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TaskStatusTimeline } from './task-status-timeline'
import { updateTaskStatus } from '@/app/actions/task-actions'
import { formatDateLocal } from '@/lib/utils'
import {
  EmptyState,
  Panel,
  QuickLink,
  StatCard,
  StatusBadge,
  TaskLinkRow,
  WelcomeBanner,
  timeGreeting,
} from './dashboard-ui'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  client?: {
    id: string
    name: string
  }
  assignedTo?: {
    id: string
    name: string | null
    email?: string | null
  } | null
  assignedBy?: {
    id: string
    name: string | null
    email?: string | null
  } | null
}

interface AttendanceSummary {
  todayStatus?: string
  todayMode?: string
  loginTime?: string
  logoutTime?: string
  totalHours?: number
  thisMonthPresent: number
  thisMonthLate: number
  thisMonthAbsent: number
}

export function EmployeeDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [pendingAssignedByMeTasks, setPendingAssignedByMeTasks] = useState<Task[]>([])
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([])
  const [assignedByMeTasks, setAssignedByMeTasks] = useState<Task[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set())
  const [startingTasks, setStartingTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return
      
      try {
        const today = formatDateLocal(new Date())
        const firstDayOfMonth = formatDateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
        const lastDayOfMonth = formatDateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
        const userId = session.user.id

        // Get today's date range (start and end of today)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        // Fetch all data in parallel
        const [tasksRes, allTasksRes, todaysTasksRes, assignedByMeRes, attendanceRes, monthRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${userId}&limit=5`),
          fetch(`/api/tasks?assignedToId=${userId}&limit=50`), // Fetch more to get all pending/in-progress
          fetch(`/api/tasks?assignedToId=${userId}&limit=10`),
          fetch(`/api/tasks?assignedById=${userId}&limit=5`),
          fetch(`/api/attendance?userId=${userId}&startDate=${today}&endDate=${today}`),
          fetch(`/api/attendance?userId=${userId}&startDate=${firstDayOfMonth}&endDate=${lastDayOfMonth}`),
        ])

        const [tasksData, allTasksData, todaysTasksData, assignedByMeData, attendanceData, monthData] = await Promise.all([
          tasksRes.json(),
          allTasksRes.json(),
          todaysTasksRes.json(),
          assignedByMeRes.json(),
          attendanceRes.json(),
          monthRes.json(),
        ])

        // Filter pending tasks assigned to me (Pending or InProgress status)
        const pending = (allTasksData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedTo?.id === userId
        )

        // Filter pending tasks assigned by me (Pending or InProgress status)
        const pendingAssignedByMe = (assignedByMeData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedBy?.id === userId
        )

        // Filter tasks that are due today
        const todayTasks = (todaysTasksData.tasks || []).filter((task: Task) => {
          if (!task.dueDate) return false
          const dueDate = new Date(task.dueDate)
          return dueDate >= todayStart && dueDate <= todayEnd
        })

        setTasks(tasksData.tasks?.slice(0, 5) || [])
        setPendingTasks(pending.slice(0, 10))
        setPendingAssignedByMeTasks(pendingAssignedByMe.slice(0, 10))
        setTodaysTasks(todayTasks.slice(0, 5))
        setAssignedByMeTasks(assignedByMeData.tasks?.slice(0, 5) || [])

        const todayAttendance = attendanceData.attendances?.[0]
        const monthAttendances = monthData.attendances || []
        const presentCount = monthAttendances.filter((a: any) => a.status === 'Present').length
        const lateCount = monthAttendances.filter((a: any) => a.status === 'Late').length
        const absentCount = monthAttendances.filter((a: any) => a.status === 'Absent').length

        setAttendanceSummary({
          todayStatus: todayAttendance?.status,
          todayMode: todayAttendance?.mode,
          loginTime: todayAttendance?.loginTime,
          logoutTime: todayAttendance?.logoutTime,
          totalHours: todayAttendance?.totalHours,
          thisMonthPresent: presentCount,
          thisMonthLate: lateCount,
          thisMonthAbsent: absentCount,
        })
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Poll less frequently to reduce backend/API load
    const interval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(interval)
  }, [session?.user?.id])

  const handleMarkComplete = async (taskId: string) => {
    setCompletingTasks(prev => new Set(prev).add(taskId))
    try {
      await updateTaskStatus(taskId, { status: 'Approved' })
      // Refresh dashboard data to get latest updates
      const userId = session?.user?.id
      if (userId) {
        const cacheBuster = Date.now()
        const today = formatDateLocal(new Date())
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)
        
        const [tasksRes, allTasksRes, todaysTasksRes, assignedByMeRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${userId}&limit=5&_t=${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/tasks?assignedToId=${userId}&limit=50&_t=${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/tasks?assignedToId=${userId}&limit=10&_t=${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/tasks?assignedById=${userId}&limit=5&_t=${cacheBuster}`, { cache: 'no-store' }),
        ])
        const [tasksData, allTasksData, todaysTasksData, assignedByMeData] = await Promise.all([
          tasksRes.json(),
          allTasksRes.json(),
          todaysTasksRes.json(),
          assignedByMeRes.json(),
        ])
        const pending = (allTasksData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedTo?.id === userId
        )
        const pendingAssignedByMe = (assignedByMeData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedBy?.id === userId
        )
        const todayTasks = (todaysTasksData.tasks || []).filter((task: Task) => {
          if (!task.dueDate) return false
          const dueDate = new Date(task.dueDate)
          return dueDate >= todayStart && dueDate <= todayEnd
        })
        setTasks(tasksData.tasks?.slice(0, 5) || [])
        setPendingTasks(pending.slice(0, 10))
        setPendingAssignedByMeTasks(pendingAssignedByMe.slice(0, 10))
        setTodaysTasks(todayTasks.slice(0, 5))
        setAssignedByMeTasks(assignedByMeData.tasks?.slice(0, 5) || [])
      }
      router.refresh()
    } catch (error) {
      console.error('Failed to mark task as complete:', error)
      alert('Failed to mark task as complete. Please try again.')
    } finally {
      setCompletingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const handleStartTask = async (taskId: string) => {
    setStartingTasks(prev => new Set(prev).add(taskId))
    try {
      await updateTaskStatus(taskId, { status: 'InProgress' })
      // Refresh dashboard data to get latest updates
      const userId = session?.user?.id
      if (userId) {
        const cacheBuster = Date.now()
        const today = formatDateLocal(new Date())
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)
        
        const [tasksRes, allTasksRes, todaysTasksRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${userId}&limit=5&_t=${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/tasks?assignedToId=${userId}&limit=50&_t=${cacheBuster}`, { cache: 'no-store' }),
          fetch(`/api/tasks?assignedToId=${userId}&limit=10&_t=${cacheBuster}`, { cache: 'no-store' }),
        ])
        const [tasksData, allTasksData, todaysTasksData] = await Promise.all([
          tasksRes.json(),
          allTasksRes.json(),
          todaysTasksRes.json(),
        ])
        const pending = (allTasksData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedTo?.id === userId
        )
        const todayTasks = (todaysTasksData.tasks || []).filter((task: Task) => {
          if (!task.dueDate) return false
          const dueDate = new Date(task.dueDate)
          return dueDate >= todayStart && dueDate <= todayEnd
        })
        setTasks(tasksData.tasks?.slice(0, 5) || [])
        setPendingTasks(pending.slice(0, 10))
        setTodaysTasks(todayTasks.slice(0, 5))
      }
      router.refresh()
    } catch (error) {
      console.error('Failed to start task:', error)
      alert('Failed to start task. Please try again.')
    } finally {
      setStartingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'there'
  const todayLabel = format(new Date(), 'EEEE, MMM d')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  const renderPending = (task: Task, actions?: ReactNode) => (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/tasks/${task.id}`} className="font-medium leading-snug hover:text-indigo-700">
          {task.title}
        </Link>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <StatusBadge value={task.priority} />
          <StatusBadge value={task.status} />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {[
          task.client?.name,
          task.assignedBy?.name ? `From ${task.assignedBy.name}` : null,
          task.assignedTo?.name ? `To ${task.assignedTo.name}` : null,
          task.dueDate ? `Due ${format(new Date(task.dueDate), 'MMM d, h:mm a')}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'No extra details'}
      </p>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )

  return (
    <div className="space-y-6">
      <WelcomeBanner
        kicker={`${timeGreeting()} · ${todayLabel}`}
        title={`Welcome back, ${firstName}`}
        subtitle="What is due today, how your attendance looks, and which tasks are still open."
      >
        <QuickLink href="/attendance" icon={Clock}>
          Attendance
        </QuickLink>
        <QuickLink href="/tasks" icon={CheckSquare2}>
          My tasks
        </QuickLink>
        <QuickLink href="/chat" icon={MessageCircle}>
          Team chat
        </QuickLink>
      </WelcomeBanner>

      {(pendingTasks.length > 0 || pendingAssignedByMeTasks.length > 0) && (
        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <AlertCircle className="h-5 w-5 text-indigo-600" />
                Still open
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {pendingTasks.length} assigned to you · {pendingAssignedByMeTasks.length} assigned by you
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned to you
              </p>
              {pendingTasks.length === 0 ? (
                <p className="rounded-xl bg-white/70 px-3 py-6 text-center text-sm text-muted-foreground">
                  You are all caught up.
                </p>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {pendingTasks.map((task) => (
                    <div key={task.id}>
                      {renderPending(
                        task,
                        <>
                          {task.status === 'Pending' && (
                            <Button
                              onClick={() => handleStartTask(task.id)}
                              disabled={startingTasks.has(task.id)}
                              variant="outline"
                              size="sm"
                            >
                              {startingTasks.has(task.id) ? 'Starting...' : 'Start'}
                            </Button>
                          )}
                          <Button
                            onClick={() => handleMarkComplete(task.id)}
                            disabled={completingTasks.has(task.id)}
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            size="sm"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {completingTasks.has(task.id) ? 'Saving...' : 'Mark complete'}
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned by you
              </p>
              {pendingAssignedByMeTasks.length === 0 ? (
                <p className="rounded-xl bg-white/70 px-3 py-6 text-center text-sm text-muted-foreground">
                  Nothing waiting on other people.
                </p>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {pendingAssignedByMeTasks.map((task) => (
                    <div key={task.id}>{renderPending(task)}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Link
            href="/tasks"
            className="mt-4 flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            Open all tasks
          </Link>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={attendanceSummary?.todayStatus || 'Not in yet'}
          hint={attendanceSummary?.todayMode ? `Working ${attendanceSummary.todayMode.toLowerCase()}` : 'Clock in when you start'}
          icon={Clock}
          tone={attendanceSummary?.todayStatus === 'Late' ? 'amber' : attendanceSummary?.todayStatus === 'Absent' ? 'rose' : 'emerald'}
        />
        <StatCard label="Present" value={attendanceSummary?.thisMonthPresent || 0} hint="Days this month" icon={CheckSquare2} tone="emerald" />
        <StatCard label="Late" value={attendanceSummary?.thisMonthLate || 0} hint="Arrivals this month" icon={AlertCircle} tone="amber" />
        <StatCard label="My tasks" value={tasks.length} hint="Latest assigned to you" icon={TrendingUp} tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Due today"
          description={todaysTasks.length ? 'Finish these before the day ends' : 'Nothing left that is due today'}
          icon={Calendar}
          href="/tasks"
          actionLabel="Open tasks"
          tone={todaysTasks.length ? 'warning' : 'default'}
        >
          {todaysTasks.length === 0 ? (
            <EmptyState icon={Calendar} title="Nothing due today" hint="Enjoy the clear list, or pick up something from your queue." />
          ) : (
            <div className="space-y-2">
              {todaysTasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  tone="warning"
                  title={task.title}
                  meta={[task.client?.name, task.dueDate ? format(new Date(task.dueDate), 'h:mm a') : null].filter(Boolean).join(' · ')}
                  badges={
                    <>
                      <StatusBadge value={task.status} />
                      <StatusBadge value={task.priority} />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Assigned to you" description="Your latest tasks" icon={CheckSquare2} href="/tasks" actionLabel="Open tasks">
          {tasks.length === 0 ? (
            <EmptyState icon={CheckSquare2} title="No tasks yet" hint="When someone assigns you work, it will show up here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  title={task.title}
                  meta={task.client?.name}
                  badges={
                    <>
                      <StatusBadge value={task.status} />
                      <StatusBadge value={task.priority} />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Assigned by you"
          description="Work you handed to someone else"
          icon={CheckSquare2}
          href="/tasks?assignedByMe=true"
          actionLabel="See everything you assigned"
        >
          {assignedByMeTasks.length === 0 ? (
            <EmptyState icon={CheckSquare2} title="You have not assigned anything" hint="Tasks you create for others will show up here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {assignedByMeTasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  title={task.title}
                  meta={task.client?.name}
                  badges={
                    <>
                      <StatusBadge value={task.status} />
                      <StatusBadge value={task.priority} />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Today's attendance" description="Your check-in for today" icon={Calendar} href="/attendance" actionLabel="Open attendance">
          {!attendanceSummary?.loginTime ? (
            <EmptyState icon={Clock} title="You have not clocked in" hint="Head to attendance when you are ready to start." />
          ) : (
            <dl className="space-y-2 px-2">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd><StatusBadge value={attendanceSummary.todayStatus} /></dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-sm text-muted-foreground">Mode</dt>
                <dd className="text-sm font-medium">{attendanceSummary.todayMode || '—'}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-sm text-muted-foreground">Check-in</dt>
                <dd className="text-sm font-medium">{format(new Date(attendanceSummary.loginTime), 'h:mm a')}</dd>
              </div>
              {attendanceSummary.logoutTime ? (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Check-out</dt>
                  <dd className="text-sm font-medium">{format(new Date(attendanceSummary.logoutTime), 'h:mm a')}</dd>
                </div>
              ) : null}
              {attendanceSummary.totalHours ? (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Hours</dt>
                  <dd className="text-sm font-medium">{attendanceSummary.totalHours.toFixed(2)}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </Panel>
      </div>

      <TaskStatusTimeline />
    </div>
  )
}
