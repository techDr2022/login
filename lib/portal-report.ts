import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getISTDateKey } from '@/lib/attendance-config'
import { clientTaskLabel } from '@/lib/client-task-label'

export type PortalReportTask = {
  title: string
  category: string
  label: string
  due: string | null
}

export type PortalReport = {
  clientName: string
  clinicName: string
  from: string | null
  to: string | null
  category: string
  generatedOn: string
  tasks: PortalReportTask[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function dueKey(value: Date | null) {
  if (!value) return null
  const key = getISTDateKey(value)
  return DAY.test(key) ? key : null
}

export async function buildPortalReport(input: {
  clientId: string
  from?: string
  to?: string
  category?: string
}): Promise<PortalReport> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== UserRole.CLIENT) {
    throw new Error('Unauthorized')
  }
  const clientId = input.clientId.trim()
  const from = input.from?.trim() || ''
  const to = input.to?.trim() || ''
  const category = (input.category?.trim() || 'all').slice(0, 80)
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) throw new Error('Choose a valid date')
  if (from && to && to < from) throw new Error('End date must be on or after the start date')

  const access = await prisma.clientportalaccess.findUnique({
    where: { userid_clientid: { userid: session.user.id, clientid: clientId } },
    include: { client: { select: { name: true, doctorOrHospitalName: true } } },
  })
  if (!access) throw new Error('Forbidden')

  const rows = await prisma.task.findMany({
    where: { clientId, status: { notIn: ['Rejected', 'Cancelled'] } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      title: true,
      status: true,
      dueDate: true,
      worktemplate: { select: { section: true } },
    },
  })

  const tasks = rows.flatMap((task) => {
    const section = task.worktemplate?.section?.trim() || 'Other'
    if (category !== 'all' && section !== category) return []
    const due = dueKey(task.dueDate)
    if ((from || to) && !due) return []
    if (from && due && due < from) return []
    if (to && due && due > to) return []
    return [{
      title: task.title.trim() || 'Untitled',
      category: section,
      label: clientTaskLabel(task.status, task.dueDate),
      due,
    }]
  })

  return {
    clientName: access.client.name,
    clinicName: access.client.doctorOrHospitalName,
    from: from || null,
    to: to || null,
    category: category === 'all' ? 'All categories' : category,
    generatedOn: getISTDateKey(new Date()),
    tasks,
  }
}
