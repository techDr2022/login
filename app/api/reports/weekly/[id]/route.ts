import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canStaffClient } from '@/app/actions/portal-actions'
import { weeklyReportPdf } from '@/lib/weekly-report-pdf'
import type { WeekReportSnapshot } from '@/lib/weekly-report'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role === UserRole.CLIENT) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const report = await prisma.clientweeklyreport.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canStaffClient(report.clientid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const pdf = weeklyReportPdf(report.snapshot as WeekReportSnapshot)
  const snap = report.snapshot as WeekReportSnapshot
  const filename = `work-report-${snap.weekstart}-to-${snap.weekend}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
