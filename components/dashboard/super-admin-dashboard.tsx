import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSuperAdminDashboardData } from '@/lib/dashboard-queries'
import { Users, CheckSquare2, Clock, AlertCircle, Briefcase, Calendar, TrendingUp, UserPlus, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TaskStatusTimeline } from './task-status-timeline'
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

const ATTENDANCE_BAR: Record<string, string> = {
  Present: 'bg-emerald-500',
  Absent: 'bg-rose-500',
  HalfDay: 'bg-orange-500',
  Late: 'bg-amber-400',
}

function taskMeta(task: {
  Client?: { name: string } | null
  User_Task_assignedToIdToUser?: { name: string | null } | null
  dueDate?: Date | string | null
}) {
  return [
    task.Client?.name,
    task.User_Task_assignedToIdToUser?.name
      ? `With ${task.User_Task_assignedToIdToUser.name}`
      : 'Unassigned',
    task.dueDate ? `Due ${format(new Date(task.dueDate), 'MMM d, h:mm a')}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export async function SuperAdminDashboard() {
  const session = await getServerSession(authOptions)
  const data = await getSuperAdminDashboardData(session?.user?.id)
  const todayLabel = format(new Date(), 'EEEE, MMM d')
  const attendanceTotal = data.teamAttendance.reduce((sum, item) => sum + item._count.status, 0)
  const workloadMax = Math.max(1, ...data.clientWorkload.map((client) => client._count.Task))

  return (
    <div className="space-y-6">
      <WelcomeBanner
        kicker={`${timeGreeting()} · ${todayLabel}`}
        title="Here's how the team is doing"
        subtitle="Who is in today, what is due, and which reviews are still waiting."
      >
        <QuickLink href="/tasks" icon={ClipboardList}>
          Tasks
        </QuickLink>
        <QuickLink href="/clients/new" icon={UserPlus}>
          Add client
        </QuickLink>
        <QuickLink href="/attendance" icon={Clock}>
          Attendance
        </QuickLink>
        <QuickLink href="/employees" icon={Users}>
          Team
        </QuickLink>
      </WelcomeBanner>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Logged in today" value={data.loggedInToday} hint="People already in" icon={Users} tone="emerald" />
        <StatCard label="Completed today" value={data.tasksCompletedToday} hint="Tasks approved" icon={TrendingUp} tone="sky" />
        <StatCard label="Late logins" value={data.lateLogins} hint="Office arrivals" icon={Clock} tone="amber" />
        <StatCard label="Needs review" value={data.pendingApprovals} hint="Waiting on you" icon={AlertCircle} tone="orange" />
        <StatCard label="Clients" value={data.totalClients} hint="Active accounts" icon={Briefcase} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Due today"
          description={data.todaysTasks.length ? 'Finish these before the day ends' : 'Nothing left that is due today'}
          icon={Calendar}
          href="/tasks"
          actionLabel="Open tasks"
          tone={data.todaysTasks.length ? 'warning' : 'default'}
        >
          {data.todaysTasks.length === 0 ? (
            <EmptyState icon={Calendar} title="Nothing due today" hint="The day is clear. New work will show up here." />
          ) : (
            <div className="space-y-2">
              {data.todaysTasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  tone="warning"
                  title={task.title}
                  meta={taskMeta(task)}
                  badges={<StatusBadge value={task.status} />}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Latest work" description="Tasks added most recently" icon={CheckSquare2} href="/tasks" actionLabel="Open tasks">
          {data.recentTasks.length === 0 ? (
            <EmptyState icon={CheckSquare2} title="No recent tasks" hint="Assigned work will land here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentTasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  title={task.title}
                  meta={taskMeta(task)}
                  badges={<StatusBadge value={task.status} />}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Who is in" description="Today's attendance at a glance" icon={Users} href="/attendance" actionLabel="Open attendance">
          {data.teamAttendance.length === 0 ? (
            <EmptyState icon={Users} title="No check-ins yet" hint="Attendance updates as the team clocks in." />
          ) : (
            <div className="space-y-3 px-2 py-1">
              {data.teamAttendance.map((item) => {
                const count = item._count.status
                const width = attendanceTotal ? Math.max(8, Math.round((count / attendanceTotal) * 100)) : 0
                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge value={item.status} />
                      <span className="text-sm font-medium tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${ATTENDANCE_BAR[item.status] || 'bg-slate-400'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Assigned by you"
          description="Work you handed to the team"
          icon={CheckSquare2}
          href="/tasks?assignedByMe=true"
          actionLabel="See everything you assigned"
        >
          {data.assignedByMeTasks.length === 0 ? (
            <EmptyState icon={CheckSquare2} title="You have not assigned anything yet" hint="Tasks you create for others will show up here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.assignedByMeTasks.map((task) => (
                <TaskLinkRow
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  title={task.title}
                  meta={taskMeta(task)}
                  badges={<StatusBadge value={task.status} />}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Client workload" description="Where the current work is sitting" icon={Briefcase} href="/clients" actionLabel="Open clients">
        {data.clientWorkload.length === 0 ? (
          <EmptyState icon={Briefcase} title="No clients yet" hint="Add a client to start tracking their work." />
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {data.clientWorkload.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{client.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{client._count.Task} tasks</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(6, (client._count.Task / workloadMax) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <TaskStatusTimeline />
    </div>
  )
}
