'use client'

import { memo, useMemo, useState, useTransition } from 'react'
import { ClientRequestType } from '@prisma/client'
import { Download } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { clientTaskLabel } from '@/lib/client-task-label'
import { submitPortalRequest } from '@/app/actions/portal-actions'

type PortalTask = {
  id: string
  title: string
  status: string
  dueDate: string | null
  deliverableurl: string | null
  clientId: string | null
  category: string
}

type PortalClient = { id: string; name: string; doctorOrHospitalName: string }

function istDay(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function thisMonthRange() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [year, month] = today.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${today.slice(0, 8)}01`, to: `${today.slice(0, 8)}${String(last).padStart(2, '0')}` }
}

const TaskList = memo(function TaskList({ tasks }: { tasks: PortalTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No work in this date range or category.</p>
  }
  return (
    <div className="divide-y rounded-xl border bg-card">
      {tasks.map((task) => (
        <article key={task.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">{task.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{task.category}</p>
            </div>
            <p className="shrink-0 text-right text-xs text-muted-foreground">
              {clientTaskLabel(task.status, task.dueDate)}
              {task.dueDate ? <span className="mt-1 block">{istDay(task.dueDate)}</span> : null}
            </p>
          </div>
          {task.deliverableurl && (
            <a className="mt-2 inline-block text-sm text-primary underline" href={task.deliverableurl} target="_blank" rel="noreferrer">
              Open deliverable
            </a>
          )}
        </article>
      ))}
    </div>
  )
})

function RequestForm({ clientId }: { clientId: string }) {
  const [requestType, setRequestType] = useState<ClientRequestType>('OTHER')
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage('')
        startTransition(async () => {
          try {
            await submitPortalRequest({ clientId, requestType, summary, notes })
            setSummary('')
            setNotes('')
            setMessage('Request sent. The team will turn it into a task.')
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not send the request')
          }
        })
      }}
    >
      <h2 className="font-medium">Send a request</h2>
      <select
        className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={requestType}
        onChange={(event) => setRequestType(event.target.value as ClientRequestType)}
      >
        <option value="POSTER">Poster</option>
        <option value="VIDEO">Video</option>
        <option value="POSTER_AND_VIDEO">Poster and video</option>
        <option value="OTHER">Other</option>
      </select>
      <Textarea className="mt-2" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What do you need?" />
      <Input className="mt-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes, optional" />
      {message && <p className="mt-2 text-sm">{message}</p>}
      <Button className="mt-3" type="submit" disabled={pending || !clientId}>
        {pending ? 'Sending…' : 'Send request'}
      </Button>
    </form>
  )
}

export function PortalHome({
  userName,
  clients,
  tasks,
}: {
  userName: string
  clients: PortalClient[]
  tasks: PortalTask[]
}) {
  const month = useMemo(() => thisMonthRange(), [])
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [fromDate, setFromDate] = useState(month.from)
  const [toDate, setToDate] = useState(month.to)
  const [category, setCategory] = useState('all')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const selected = clients.find((client) => client.id === clientId) || clients[0]

  const forClient = useMemo(
    () => tasks.filter((task) => task.clientId === (selected?.id || '')),
    [tasks, selected?.id]
  )
  const categories = useMemo(
    () => Array.from(new Set(forClient.map((task) => task.category))).sort((a, b) => a.localeCompare(b)),
    [forClient]
  )
  const visible = useMemo(() => {
    return forClient.filter((task) => {
      if (category !== 'all' && task.category !== category) return false
      if (!fromDate && !toDate) return true
      const day = istDay(task.dueDate)
      if (!day) return false
      if (fromDate && day < fromDate) return false
      if (toDate && day > toDate) return false
      return true
    })
  }, [forClient, category, fromDate, toDate])
  const openCount = visible.filter((task) => task.status !== 'Approved' && task.status !== 'Done').length

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{selected?.name || 'Your work'}</h1>
          <p className="text-sm text-muted-foreground">
            {userName} · {visible.length === 1 ? '1 task' : `${visible.length} tasks`} · {openCount} under progress
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/client-login' })}>
          Log out
        </Button>
      </header>

      {clients.length > 1 && (
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={selected?.id || ''}
          onChange={(event) => setClientId(event.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      )}

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="fromDate">From</Label>
          <Input id="fromDate" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="toDate">To</Label>
          <Input id="toDate" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <Button type="button" variant="outline" size="sm" onClick={() => { setFromDate(month.from); setToDate(month.to) }}>
            This month
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setFromDate(''); setToDate(''); setCategory('all') }}>
            Clear filters
          </Button>
          <Button
            type="button"
            size="sm"
            className="sm:ml-auto"
            disabled={downloading || !selected}
            onClick={() => {
              if (!selected) return
              setDownloadError('')
              setDownloading(true)
              const params = new URLSearchParams({ clientId: selected.id })
              if (fromDate) params.set('from', fromDate)
              if (toDate) params.set('to', toDate)
              if (category !== 'all') params.set('category', category)
              fetch(`/api/portal/report?${params}`)
                .then(async (response) => {
                  if (!response.ok) throw new Error('Could not download the report')
                  const blob = await response.blob()
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')
                  link.href = url
                  link.download = match?.[1] || 'work-report.pdf'
                  link.click()
                  URL.revokeObjectURL(url)
                })
                .catch(() => setDownloadError('Could not download the report'))
                .finally(() => setDownloading(false))
            }}
          >
            <Download />
            {downloading ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
        </div>
        {downloadError && <p className="text-sm text-destructive sm:col-span-3">{downloadError}</p>}
      </div>

      <TaskList tasks={visible} />
      {selected && <RequestForm key={selected.id} clientId={selected.id} />}
    </div>
  )
}
