export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { getInvoicesUnlockUserIdFromRequest } from '@/lib/invoices-unlock'
import ExcelJS from 'exceljs'

function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function planLabel(plan: string | null): string {
  if (!plan) return '-'
  if (plan === 'ONE_MONTH') return '1 Month'
  if (plan === 'THREE_MONTHS') return '3 Months'
  if (plan === 'SIX_MONTHS') return '6 Months'
  return plan
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const unlockedUserId = await getInvoicesUnlockUserIdFromRequest(request)
    if (unlockedUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unlock the Invoices tab first (password or OTP).' },
        { status: 403 }
      )
    }

    const [clients, officeExpenses] = await Promise.all([
      prisma.client.findMany({
        select: {
          id: true,
          name: true,
          doctorOrHospitalName: true,
          startDate: true,
          endDate: true,
          monthlyAmount: true,
          planDuration: true,
          nextPaymentDate: true,
          lastPaymentDate: true,
          status: true,
          isGST: true,
          gstNumber: true,
          discountPercent: true,
          User: { select: { name: true } },
        },
        orderBy: [{ nextPaymentDate: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      }),
      prisma.officeExpense.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Invoice Export'

    // Sheet 1: Client Invoices
    const invoicesSheet = workbook.addWorksheet('Client Invoices', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    const invoiceHeaders = [
      'Client Name',
      'Doctor / Hospital',
      'Project Start',
      'Project End',
      'Plan',
      'Monthly Amount (₹)',
      'Next Payment',
      'Last Payment',
      'Status',
      'GST',
      'Account Manager',
    ]

    const headerRow = invoicesSheet.addRow(invoiceHeaders)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    let totalRevenue = 0
    for (const c of clients) {
      const amount = c.monthlyAmount ?? 0
      totalRevenue += amount
      invoicesSheet.addRow([
        c.name,
        c.doctorOrHospitalName,
        formatDate(c.startDate),
        formatDate(c.endDate),
        planLabel(c.planDuration),
        amount,
        formatDate(c.nextPaymentDate),
        formatDate(c.lastPaymentDate),
        c.status,
        c.isGST ? 'Yes' : 'No',
        c.User?.name ?? '-',
      ])
    }

    invoicesSheet.addRow([])
    invoicesSheet.addRow(['Total Monthly Revenue', '', '', '', '', totalRevenue, '', '', '', '', ''])
    invoicesSheet.lastRow!.getCell(6).font = { bold: true }

    // Auto-fit columns
    invoiceHeaders.forEach((_, i) => {
      invoicesSheet.getColumn(i + 1).width = Math.min(
        Math.max(...invoiceHeaders.map((h) => h.length), 12),
        40
      )
    })

    // Sheet 2: Office Expenses
    const expensesSheet = workbook.addWorksheet('Office Expenses', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    const expenseHeaders = ['Expense Name', 'Amount (₹)']
    const expHeaderRow = expensesSheet.addRow(expenseHeaders)
    expHeaderRow.font = { bold: true }
    expHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    let totalExpenses = 0
    for (const e of officeExpenses) {
      totalExpenses += e.amount
      expensesSheet.addRow([e.name, e.amount])
    }

    expensesSheet.addRow([])
    expensesSheet.addRow(['Total Office Expenses', totalExpenses])
    expensesSheet.lastRow!.getCell(2).font = { bold: true }

    expensesSheet.getColumn(1).width = 24
    expensesSheet.getColumn(2).width = 16

    // Sheet 3: Summary
    const summarySheet = workbook.addWorksheet('Summary')
    summarySheet.addRow(['Invoice Summary'])
    summarySheet.getRow(1).font = { bold: true, size: 14 }
    summarySheet.addRow([])
    summarySheet.addRow(['Total Monthly Revenue', totalRevenue])
    summarySheet.addRow(['Total Office Expenses', totalExpenses])
    summarySheet.addRow(['Net Profit', totalRevenue - totalExpenses])
    summarySheet.getRow(3).getCell(2).font = { bold: true }
    summarySheet.getRow(4).getCell(2).font = { bold: true }
    summarySheet.getRow(5).getCell(2).font = { bold: true, color: { argb: 'FF0D9488' } }
    summarySheet.getColumn(1).width = 24
    summarySheet.getColumn(2).width = 20

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `client-invoices-export-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
