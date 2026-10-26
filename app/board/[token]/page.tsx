import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { publicBoardTasks } from '@/lib/engine/query'
import { STATUS_LABEL } from '@/lib/engine/rules'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Board',
  robots: { index: false, follow: false },
}

function sameToken(stored: string, given: string) {
  const left = Buffer.from(stored)
  const right = Buffer.from(given)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function when(date: Date | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default async function PublicBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ team?: string; person?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const setting = await prisma.appsetting.findUnique({ where: { id: 'PUBLIC_BOARD_TOKEN' } })
  if (!setting || !sameToken(setting.value, token)) notFound()

  const all = await publicBoardTasks()
  const tasks = all.filter((task) => {
    const teamName = task.User_Task_assignedToIdToUser?.team?.name || task.worktemplate?.team?.name || ''
    if (query.team && teamName !== query.team) return false
    if (query.person && task.assignedToId !== query.person) return false
    return true
  })
  const now = Date.now()
  const teams = [...new Set(all.map((task) => task.User_Task_assignedToIdToUser?.team?.name || task.worktemplate?.team?.name || '').filter(Boolean))].sort()
  const people = [...new Map(all.filter((task) => task.assignedToId).map((task) => [task.assignedToId as string, task.User_Task_assignedToIdToUser?.name || 'Person'])).entries()]
  const groups = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const name = task.User_Task_assignedToIdToUser?.name || 'Shared'
    const list = groups.get(name) ?? []
    list.push(task)
    groups.set(name, list)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-5xl">Today</h1>
          <p className="mt-1 text-sm text-slate-300 md:text-base">Read only · refreshes every 60 seconds</p>
        </div>
        <form className="flex flex-wrap gap-2" method="get">
          <select name="team" defaultValue={query.team || ''} className="rounded-md bg-slate-800 px-3 py-2 text-sm">
            <option value="">All teams</option>
            {teams.map((team) => <option key={team}>{team}</option>)}
          </select>
          <select name="person" defaultValue={query.person || ''} className="rounded-md bg-slate-800 px-3 py-2 text-sm">
            <option value="">Everyone</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <button className="rounded-md bg-white px-3 py-2 text-sm text-slate-950" type="submit">Filter</button>
        </form>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([name, rows]) => (
          <section key={name} className="rounded-2xl bg-slate-900 p-4">
            <h2 className="mb-3 text-2xl font-semibold">{name}</h2>
            <ul className="space-y-3">
              {rows.map((task) => {
                const overdue = !!task.dueDate && task.dueDate.getTime() < now && task.status !== 'Done' && task.status !== 'Cancelled' && !task.worktemplate?.istimelock
                return (
                  <li key={task.id} className="border-t border-slate-800 pt-3 first:border-0 first:pt-0">
                    <p className="text-lg">{task.title}</p>
                    <p className="text-sm text-slate-300">
                      {STATUS_LABEL[task.status] || task.status}
                      {task.dueDate ? ` · ${when(task.dueDate)}` : ''}
                      {overdue ? ' · Overdue' : ''}
                      {task.Client?.name ? ` · ${task.Client.name}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {!tasks.length && <p className="text-slate-300">No tasks for this filter.</p>}
    </main>
  )
}
