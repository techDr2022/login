'use client'

import { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EngineStatusButtons } from '@/components/engine/status-buttons'
import { STATUS_LABEL, actionsFor, type Actor } from '@/lib/engine/rules'
import type { DayBucket, DayList, DayTask } from '@/lib/engine/query'
import { cn } from '@/lib/utils'

const PAGE = 20
const STATUS_ORDER = ['Locked', 'ToDo', 'InProgress', 'WaitingOnInput', 'InReview', 'Pending', 'Review']
const PRIORITY_ORDER = ['Urgent', 'High', 'Medium', 'Low']

const timeOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
})
const dayOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
})
const dayLabel = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
})

type Filters = {
  q: string
  when: 'all' | DayBucket
  status: string
  client: string
  priority: string
  team: string
  section: string
}

const EMPTY_FILTERS: Filters = {
  q: '',
  when: 'today',
  status: '',
  client: '',
  priority: '',
  team: '',
  section: '',
}

function ordered(values: string[], rank: string[]) {
  return [...values].sort((a, b) => {
    const ai = rank.indexOf(a)
    const bi = rank.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function unique(tasks: DayTask[], pick: (task: DayTask) => string | null) {
  const values = new Set<string>()
  for (const task of tasks) {
    const value = pick(task)
    if (value) values.add(value)
  }
  return [...values]
}

function matches(task: DayTask, filters: Filters, skipWhen = false) {
  if (!skipWhen && filters.when !== 'all' && task.bucket !== filters.when) return false
  if (filters.status && task.status !== filters.status) return false
  if (filters.client && task.clientName !== filters.client) return false
  if (filters.priority && task.priority !== filters.priority) return false
  if (filters.team && task.team !== filters.team) return false
  if (filters.section && task.section !== filters.section) return false
  if (filters.q) {
    const haystack = `${task.title} ${task.clientName || ''} ${task.team || ''} ${task.section || ''}`.toLowerCase()
    if (!haystack.includes(filters.q.trim().toLowerCase())) return false
  }
  return true
}

function whenLabel(task: DayTask) {
  if (!task.dueDate) return '—'
  const date = new Date(task.dueDate)
  return task.bucket === 'today' ? timeOnly.format(date) : dayOnly.format(date)
}

const TaskRow = memo(function TaskRow({ task, actions }: { task: DayTask; actions: string[] }) {
  const meta = task.clientName || task.section || task.team
  const status = STATUS_LABEL[task.status] || task.status
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 text-sm">
      <time className={cn('w-14 shrink-0 tabular-nums text-muted-foreground', task.bucket === 'overdue' && 'text-destructive')}>
        {whenLabel(task)}
      </time>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <Link href={`/tasks/${task.id}`} className="truncate font-medium hover:underline">
          {task.title}
        </Link>
        {meta && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{meta}</span>}
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
        {status}
        {task.bucket === 'overdue' ? ' · Overdue' : ''}
        {task.priority === 'High' || task.priority === 'Urgent' ? ` · ${task.priority}` : ''}
      </span>
      <EngineStatusButtons taskId={task.id} status={task.status} actions={actions} compact />
    </li>
  )
})

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  if (options.length < 2) return null
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-sm"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {STATUS_LABEL[option] || option}
        </option>
      ))}
    </select>
  )
}

export function MyDayView({ list, actor }: { list: DayList; actor: Actor }) {
  const { tasks, truncated } = list
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [pages, setPages] = useState<Record<string, number>>({})

  const options = useMemo(
    () => ({
      status: ordered(unique(tasks, (task) => task.status), STATUS_ORDER),
      client: unique(tasks, (task) => task.clientName).sort((a, b) => a.localeCompare(b)),
      priority: ordered(unique(tasks, (task) => task.priority), PRIORITY_ORDER),
      team: unique(tasks, (task) => task.team).sort((a, b) => a.localeCompare(b)),
      section: unique(tasks, (task) => task.section).sort((a, b) => a.localeCompare(b)),
    }),
    [tasks]
  )

  const actionsByKey = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const task of tasks) {
      const key = `${task.status}:${task.istimelock ? 1 : 0}`
      if (!map.has(key)) map.set(key, actionsFor(task.status, actor, task.istimelock))
    }
    return map
  }, [tasks, actor])

  const narrowed = useMemo(
    () => tasks.filter((task) => matches(task, filters, true)),
    [tasks, filters]
  )
  const counts = useMemo(() => {
    const tally = { all: narrowed.length, today: 0, overdue: 0, upcoming: 0, undated: 0 }
    for (const task of narrowed) tally[task.bucket] += 1
    return tally
  }, [narrowed])
  const visible = filters.when === 'all' ? narrowed : narrowed.filter((task) => task.bucket === filters.when)

  const filterKey = `${filters.q}|${filters.when}|${filters.status}|${filters.client}|${filters.priority}|${filters.team}|${filters.section}`
  const filtering = Boolean(
    filters.q || filters.when !== 'today' || filters.status || filters.client || filters.priority || filters.team || filters.section
  )

  const today = visible.filter((task) => task.bucket === 'today')
  const overdue = visible.filter((task) => task.bucket === 'overdue')
  const undated = visible.filter((task) => task.bucket === 'undated')
  const upcoming = visible.filter((task) => task.bucket === 'upcoming')

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const chips: Array<{ id: Filters['when']; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Due today' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'upcoming', label: 'Upcoming' },
  ]
  if (counts.undated > 0 || filters.when === 'undated') chips.push({ id: 'undated', label: 'No date' })

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div>
        <h1 className="text-xl font-semibold">My Day</h1>
        <p className="text-sm text-muted-foreground">{dayLabel.format(new Date())}</p>
      </div>

      {tasks.length > 0 && (
        <div className="sticky top-16 z-30 space-y-2 bg-background/95 py-2 backdrop-blur">
          <Input
            value={filters.q}
            onChange={(event) => setFilter('q', event.target.value)}
            placeholder="Search tasks or clients"
            aria-label="Search tasks or clients"
            className="h-8"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => {
              const active = filters.when === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter('when', chip.id)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                  )}
                >
                  {chip.label}
                  <span className={active ? 'opacity-80' : 'text-muted-foreground'}>{counts[chip.id]}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="All clients" value={filters.client} options={options.client} onChange={(value) => setFilter('client', value)} />
            <FilterSelect label="All statuses" value={filters.status} options={options.status} onChange={(value) => setFilter('status', value)} />
            <FilterSelect label="All priorities" value={filters.priority} options={options.priority} onChange={(value) => setFilter('priority', value)} />
            <FilterSelect label="All teams" value={filters.team} options={options.team} onChange={(value) => setFilter('team', value)} />
            <FilterSelect label="All sections" value={filters.section} options={options.section} onChange={(value) => setFilter('section', value)} />
            {filtering && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {truncated && (
        <p className="text-sm text-muted-foreground">Showing the first {tasks.length} open tasks. Clear finished work to see the rest.</p>
      )}

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {tasks.length === 0 ? 'Nothing scheduled for today.' : 'No tasks match these filters.'}
        </p>
      )}

      <Section
        title="Due today"
        rows={today}
        page={pages[`${filterKey}:today`] ?? PAGE}
        onMore={() => setPages((current) => ({ ...current, [`${filterKey}:today`]: (current[`${filterKey}:today`] ?? PAGE) + PAGE }))}
        actionsByKey={actionsByKey}
      />
      <Section
        title="Overdue"
        rows={overdue}
        page={pages[`${filterKey}:overdue`] ?? PAGE}
        onMore={() => setPages((current) => ({ ...current, [`${filterKey}:overdue`]: (current[`${filterKey}:overdue`] ?? PAGE) + PAGE }))}
        actionsByKey={actionsByKey}
      />
      <Section
        title="Upcoming"
        rows={upcoming}
        page={pages[`${filterKey}:upcoming`] ?? PAGE}
        onMore={() => setPages((current) => ({ ...current, [`${filterKey}:upcoming`]: (current[`${filterKey}:upcoming`] ?? PAGE) + PAGE }))}
        actionsByKey={actionsByKey}
      />
      <Section
        title="No date"
        rows={undated}
        page={pages[`${filterKey}:undated`] ?? PAGE}
        onMore={() => setPages((current) => ({ ...current, [`${filterKey}:undated`]: (current[`${filterKey}:undated`] ?? PAGE) + PAGE }))}
        actionsByKey={actionsByKey}
      />
    </div>
  )
}

function Section({
  title,
  rows,
  page,
  onMore,
  actionsByKey,
}: {
  title: string
  rows: DayTask[]
  page: number
  onMore: () => void
  actionsByKey: Map<string, string[]>
}) {
  if (!rows.length) return null
  const shown = rows.slice(0, page)
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{rows.length}</span>
      </h2>
      <ul className="divide-y rounded-lg border bg-card">
        {shown.map((task) => (
          <TaskRow key={task.id} task={task} actions={actionsByKey.get(`${task.status}:${task.istimelock ? 1 : 0}`) || []} />
        ))}
      </ul>
      {shown.length < rows.length && (
        <Button type="button" variant="outline" size="sm" onClick={onMore}>
          Show more ({rows.length - shown.length} left)
        </Button>
      )}
    </section>
  )
}
