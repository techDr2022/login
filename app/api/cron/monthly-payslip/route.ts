export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildPayslipData, generatePayslipPDF, resolvePayslipMonthKey } from '@/lib/payslip'
import { sendMail } from '@/lib/mailer'

function getCurrentMonthKeyInIST(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || '1970'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  return `${year}-${month}`
}

/**
 * Monthly Payslip Cron Job
 *
 * Suggested Vercel schedule:
 * - "30 15 * * *" (runs daily at 9:00 PM IST, UTC+5:30)
 *   Route safety-check ensures it sends only on month last day at 9 PM IST.
 *
 * Manual test:
 * - GET /api/cron/monthly-payslip?secret=<CRON_SECRET>&monthKey=2026-03&force=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const force = searchParams.get('force') === 'true'
    const inputMonthKey = searchParams.get('monthKey') || undefined
    // Default behavior: send current month payslip on month-end run.
    // If caller explicitly passes monthKey, respect it.
    const monthKey = inputMonthKey || getCurrentMonthKeyInIST()
    const employeeQuery = searchParams.get('employee')?.trim().toLowerCase()
    const recipientOverride = searchParams.get('to')?.trim()

    // Safety: default cron should run on month last day at 9 PM IST only
    // (unless forced for manual backfills).
    if (!force) {
      const today = new Date()
      const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(today)

      const year = Number(parts.find((part) => part.type === 'year')?.value || '0')
      const month = Number(parts.find((part) => part.type === 'month')?.value || '0')
      const day = Number(parts.find((part) => part.type === 'day')?.value || '0')
      const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0')
      const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0')
      const isTargetTimeWindow = hour === 21 && minute <= 20
      const lastDayOfMonth = new Date(year, month, 0).getDate()

      if (day !== lastDayOfMonth || !isTargetTimeWindow) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Skipped - payslip cron runs on month last day at 9 PM IST unless force=true',
          monthKey,
        })
      }
    }

    let employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        OR: [{ payslipEmail: { not: null } }, { email: { not: '' } }],
      },
      select: { id: true, name: true, email: true, payslipEmail: true },
      orderBy: { name: 'asc' },
    })

    if (employeeQuery) {
      employees = employees.filter((employee) => {
        const name = employee.name.toLowerCase()
        const email = employee.email?.toLowerCase() || ''
        const payslipEmail = employee.payslipEmail?.toLowerCase() || ''
        return name.includes(employeeQuery) || email.includes(employeeQuery) || payslipEmail.includes(employeeQuery)
      })
    }

    const results: Array<{ employeeId: string; employeeName: string; email: string; status: string; reason?: string }> = []
    const payrollSummaryRows: Array<{
      employeeName: string
      workingDays: number
      presentDays: number
      leaves: number
      payableAmount: number
    }> = []

    for (const employee of employees) {
      const email = (recipientOverride || employee.payslipEmail || employee.email || '').trim()
      if (!email) {
        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          email: '',
          status: 'skipped',
          reason: 'Missing employee email',
        })
        continue
      }

      try {
        const payslipData = await buildPayslipData(employee.id, monthKey)
        if (!payslipData) {
          results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            email,
            status: 'skipped',
            reason: 'No active salary or no payable data for this month',
          })
          continue
        }

        payrollSummaryRows.push({
          employeeName: employee.name,
          workingDays: payslipData.workingDays,
          presentDays: payslipData.presentDays,
          leaves: payslipData.absentDays,
          payableAmount: payslipData.payableSalary,
        })

        const pdfBytes = await generatePayslipPDF(payslipData)
        const monthLabel = new Date(`${monthKey}-01`).toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric',
        })

        await sendMail({
          to: email,
          subject: `Payslip for ${monthLabel}`,
          text: `Hi ${employee.name},\n\nPlease find attached your payslip for ${monthLabel}.\n\nRegards,\nHR Team`,
          html: `<p>Hi ${employee.name},</p><p>Please find attached your payslip for <strong>${monthLabel}</strong>.</p><p>Regards,<br/>HR Team</p>`,
          attachments: [
            {
              filename: `payslip-${monthKey}-${employee.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`,
              content: Buffer.from(pdfBytes),
              contentType: 'application/pdf',
            },
          ],
        })

        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          email,
          status: 'sent',
        })
      } catch (error: any) {
        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          email,
          status: 'failed',
          reason: error?.message || 'Unknown error',
        })
      }
    }

    // Send payroll summary email to all super admins
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        email: { not: '' },
      },
      select: {
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    })

    const monthLabel = new Date(`${monthKey}-01`).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })

    const summaryHeader = `Payroll summary for ${monthLabel}`
    const summaryTextRows =
      payrollSummaryRows.length > 0
        ? payrollSummaryRows
            .map(
              (row, index) =>
                `${index + 1}. ${row.employeeName} | Working: ${row.workingDays.toFixed(2)} | Present: ${row.presentDays.toFixed(2)} | Leaves: ${row.leaves.toFixed(2)} | Payable: Rs. ${row.payableAmount.toFixed(2)}`
            )
            .join('\n')
        : 'No payroll rows available for this run.'

    const summaryHtmlRows =
      payrollSummaryRows.length > 0
        ? payrollSummaryRows
            .map(
              (row) =>
                `<tr>
                  <td style="padding:8px;border:1px solid #d1d5db;">${row.employeeName}</td>
                  <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${row.workingDays.toFixed(2)}</td>
                  <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${row.presentDays.toFixed(2)}</td>
                  <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${row.leaves.toFixed(2)}</td>
                  <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">Rs. ${row.payableAmount.toFixed(2)}</td>
                </tr>`
            )
            .join('')
        : `<tr><td colspan="5" style="padding:8px;border:1px solid #d1d5db;text-align:center;">No payroll rows available for this run.</td></tr>`

    for (const admin of superAdmins) {
      await sendMail({
        to: admin.email,
        subject: `Payroll Summary - ${monthLabel}`,
        text: `Hi ${admin.name},\n\n${summaryHeader}\n\n${summaryTextRows}\n\nRegards,\nHR System`,
        html: `
          <p>Hi ${admin.name},</p>
          <p><strong>${summaryHeader}</strong></p>
          <table style="border-collapse:collapse;width:100%;max-width:900px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;background:#f3f4f6;">Employee</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:right;background:#f3f4f6;">Working Days</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:right;background:#f3f4f6;">Present Days</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:right;background:#f3f4f6;">Leaves</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:right;background:#f3f4f6;">Payable Amount</th>
              </tr>
            </thead>
            <tbody>
              ${summaryHtmlRows}
            </tbody>
          </table>
          <p style="margin-top:12px;">Regards,<br/>HR System</p>
        `,
      })
    }

    const sentCount = results.filter((r) => r.status === 'sent').length
    const skippedCount = results.filter((r) => r.status === 'skipped').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      monthKey,
      employeeFilter: employeeQuery || null,
      recipientOverride: recipientOverride || null,
      employeesChecked: employees.length,
      sentCount,
      skippedCount,
      failedCount,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
