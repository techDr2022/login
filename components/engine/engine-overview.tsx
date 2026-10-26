import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { adminEngineOverview } from '@/lib/engine/query'
import { AdminEngineCard } from '@/components/engine/admin-engine-card'
import { STATUS_LABEL } from '@/lib/engine/rules'
import { Card } from '@/components/ui/card'

export async function EngineOverview({ isAdmin }: { isAdmin: boolean }) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const data = await adminEngineOverview()
  const byPerson = new Map<string, number>()
  for (const task of data.overdue) {
    const name = task.User_Task_assignedToIdToUser?.name || 'Shared'
    byPerson.set(name, (byPerson.get(name) ?? 0) + 1)
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold">{data.overdue.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Blocked</p>
          <p className="text-2xl font-semibold">{data.blocked.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Unconfirmed templates</p>
          <p className="text-2xl font-semibold">{data.unconfirmed}</p>
        </Card>
      </div>
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">Overdue by person</h2>
        {[...byPerson.entries()].map(([name, count]) => (
          <p key={name} className="text-sm">{name}: {count}</p>
        ))}
        {!byPerson.size && <p className="text-sm text-muted-foreground">None</p>}
      </Card>
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">Blocked chains</h2>
        {data.stale.length > 0 && <p className="text-sm">Waiting on input for more than 3 working days: {data.stale.length}</p>}
        {data.blocked.slice(0, 8).map((task) => (
          <p key={task.id} className="text-sm">
            <Link href={`/tasks/${task.id}`} className="hover:underline">{task.title}</Link>
            {' · '}{STATUS_LABEL[task.status] || task.status}
          </p>
        ))}
        {!data.blocked.length && <p className="text-sm text-muted-foreground">None</p>}
      </Card>
      {data.lastRun && (
        <p className="text-xs text-muted-foreground">
          Last engine run: {data.lastRun.kind}, created {data.lastRun.created}, {data.lastRun.createdat.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
      )}
      {isAdmin && session.user.role === UserRole.SUPER_ADMIN && (
        <Card className="p-4">
          <AdminEngineCard enabled={data.enabled} boardPath="Open Settings to copy the public board link" />
        </Card>
      )}
    </div>
  )
}
