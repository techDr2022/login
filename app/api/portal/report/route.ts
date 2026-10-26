import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { buildPortalReport } from '@/lib/portal-report'
import { portalReportPdf } from '@/lib/portal-report-pdf'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function filename(name: string, from: string | null, to: string | null) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'
  const range = from && to ? `${from}-to-${to}` : from || to || 'all-dates'
  return `${slug}-work-report-${range}.pdf`
}

export async function GET(request: NextRequest) {
  await cookies()
  try {
    const { searchParams } = request.nextUrl
    const report = await buildPortalReport({
      clientId: searchParams.get('clientId') || '',
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      category: searchParams.get('category') || undefined,
    })
    const pdf = portalReportPdf(report)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename(report.clientName, report.from, report.to)}"`,
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build the report'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
