'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createPortalLogin,
  generateClientWeekReport,
  getClientPortalAdmin,
  setClientTasksVisible,
  setTaskClientVisible,
} from '@/app/actions/portal-actions'

type LoginRow = { id: string; user: { name: string; username: string | null; email: string } }
type TaskRow = {
  id: string
  title: string
  status: string
  clientvisible: boolean
  dueDate: Date | string | null
}
type ReportRow = { id: string; weekstart: Date | string; weekend: Date | string }

function dayKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

const TaskShareList = memo(function TaskShareList({
  tasks,
  sharedCount,
  totalCount,
  pending,
  onToggle,
  onToggleAll,
}: {
  tasks: TaskRow[]
  sharedCount: number
  totalCount: number
  pending: boolean
  onToggle: (taskId: string, visible: boolean) => void
  onToggleAll: (visible: boolean, taskIds: string[] | 'all') => void
}) {
  const [query, setQuery] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((task) => task.title.toLowerCase().includes(q))
  }, [tasks, query])
  const filtering = query.trim().length > 0
  const shownShared = shown.filter((task) => task.clientvisible).length
  const allSelected = filtering
    ? shown.length > 0 && shownShared === shown.length
    : totalCount > 0 && sharedCount === totalCount
  const someSelected = filtering
    ? shownShared > 0 && shownShared < shown.length
    : sharedCount > 0 && sharedCount < totalCount

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  return (
    <section className="rounded-xl border bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Share with the client</h3>
          <p className="text-sm text-muted-foreground">
            {sharedCount} shared · {totalCount} tasks
            {tasks.length < totalCount ? ` · showing latest ${tasks.length}` : ''}
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a task"
          className="max-w-xs"
        />
      </div>
      <div className="mt-3 max-h-80 divide-y overflow-auto rounded-lg border">
        {shown.length > 0 && (
          <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-3 bg-card px-3 py-2 text-sm font-medium">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={pending}
              onChange={(event) => onToggleAll(event.target.checked, filtering ? shown.map((task) => task.id) : 'all')}
            />
            <span>Select all</span>
          </label>
        )}
        {shown.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No tasks match.</p>
        )}
        {shown.map((task) => (
          <label key={task.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              checked={task.clientvisible}
              disabled={pending}
              onChange={(event) => onToggle(task.id, event.target.checked)}
            />
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{task.status}</span>
          </label>
        ))}
      </div>
    </section>
  )
})

function LoginCard({
  clientId,
  logins,
  onCreated,
}: {
  clientId: string
  logins: LoginRow[]
  onCreated: (login: LoginRow) => void
}) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="font-medium">Client login</h3>
      <p className="mt-1 text-sm text-muted-foreground">They sign in at Client login and only see this client’s work.</p>
      <div className="mt-3 grid gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoCapitalize="none" />
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          setError('')
          createPortalLogin({ clientId, name, username, password })
            .then((created) => {
              onCreated({ id: created.id, user: { name: created.name, username: created.username, email: '' } })
              setPassword('')
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not create the login'))
            .finally(() => setSaving(false))
        }}
      >
        {saving ? 'Saving…' : 'Create login'}
      </Button>
      <ul className="mt-3 space-y-1 text-sm">
        {logins.map((login) => (
          <li key={login.id} className="truncate text-muted-foreground">
            {login.user.name} · {login.user.username || login.user.email}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReportCard({
  clientId,
  reports,
  onCreated,
}: {
  clientId: string
  reports: ReportRow[]
  onCreated: (report: ReportRow) => void
}) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="font-medium">Work report PDF</h3>
      <p className="mt-1 text-sm text-muted-foreground">Any date range. The file is grouped by day.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button
        className="mt-3"
        variant="outline"
        disabled={saving || !fromDate || !toDate}
        onClick={() => {
          setSaving(true)
          setError('')
          generateClientWeekReport(clientId, fromDate, toDate)
            .then((report) => onCreated(report))
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not build the report'))
            .finally(() => setSaving(false))
        }}
      >
        {saving ? 'Building…' : 'Build PDF'}
      </Button>
      <ul className="mt-3 space-y-1 text-sm">
        {reports.map((report) => (
          <li key={report.id}>
            <a className="text-primary underline" href={`/api/reports/weekly/${report.id}`}>
              {dayKey(report.weekstart)} to {dayKey(report.weekend)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ClientPortalPanel({ clientId }: { clientId: string }) {
  const [logins, setLogins] = useState<LoginRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [sharedCount, setSharedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pendingAll, setPendingAll] = useState(false)
  const [error, setError] = useState('')
  const tasksRef = useRef(tasks)
  const sharedRef = useRef(sharedCount)
  tasksRef.current = tasks
  sharedRef.current = sharedCount

  useEffect(() => {
    let cancelled = false
    getClientPortalAdmin(clientId)
      .then((next) => {
        if (cancelled) return
        setLogins(next.logins)
        setTasks(next.tasks)
        setReports(next.reports)
        setSharedCount(next.taskShared)
        setTotalCount(next.taskTotal)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load portal settings')
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const toggleTask = useCallback((taskId: string, visible: boolean) => {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, clientvisible: visible } : task)))
    setSharedCount((count) => count + (visible ? 1 : -1))
    setTaskClientVisible(taskId, visible).catch((err) => {
      setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, clientvisible: !visible } : task)))
      setSharedCount((count) => count + (visible ? -1 : 1))
      setError(err instanceof Error ? err.message : 'Could not update sharing')
    })
  }, [])

  const toggleAll = useCallback((visible: boolean, taskIds: string[] | 'all') => {
    const previousTasks = tasksRef.current
    const previousShared = sharedRef.current
    const ids = taskIds === 'all' ? null : new Set(taskIds)
    const changed = ids
      ? previousTasks.filter((task) => ids.has(task.id) && task.clientvisible !== visible).length
      : 0
    setTasks(previousTasks.map((task) => (ids && !ids.has(task.id) ? task : { ...task, clientvisible: visible })))
    setSharedCount(taskIds === 'all' ? (visible ? totalCount : 0) : previousShared + (visible ? changed : -changed))
    setPendingAll(true)
    setClientTasksVisible(clientId, visible, taskIds)
      .catch((err) => {
        setTasks(previousTasks)
        setSharedCount(previousShared)
        setError(err instanceof Error ? err.message : 'Could not update sharing')
      })
      .finally(() => setPendingAll(false))
  }, [clientId, totalCount])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {error && <p className="text-sm text-destructive lg:col-span-2">{error}</p>}
      <LoginCard
        clientId={clientId}
        logins={logins}
        onCreated={(login) =>
          setLogins((current) => {
            const key = (row: LoginRow) => row.user.username || row.user.email
            return [login, ...current.filter((row) => key(row) !== key(login))]
          })
        }
      />
      <ReportCard
        clientId={clientId}
        reports={reports}
        onCreated={(report) => setReports((current) => [report, ...current.filter((row) => row.id !== report.id)])}
      />
      <TaskShareList
        tasks={tasks}
        sharedCount={sharedCount}
        totalCount={totalCount}
        pending={pendingAll}
        onToggle={toggleTask}
        onToggleAll={toggleAll}
      />
    </div>
  )
}
