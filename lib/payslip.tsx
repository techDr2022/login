import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { AttendanceStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildEmployeeCodeMap } from '@/lib/employee-code'

const DEFAULT_PUBLIC_HOLIDAYS: string[] = [
  '2025-01-14',
  '2025-01-26',
  '2025-03-04',
  '2025-03-26',
  '2025-03-30',
  '2025-03-31',
  '2025-06-07',
  '2025-08-09',
  '2025-08-15',
  '2025-10-20',
  '2025-11-08',
  '2025-12-25',
]

export interface PayslipData {
  employeeId: string
  employeeName: string
  employeeEmail: string
  designation: string
  monthKey: string
  workingDays: number
  presentDays: number
  absentDays: number
  perDaySalary: number
  deductionAmount: number
  grossSalary: number
  payableSalary: number
  generatedAt: Date
}

function monthKeyToLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function getPublicHolidays(): Set<string> {
  const extra = (process.env.PAYROLL_PUBLIC_HOLIDAYS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return new Set([...DEFAULT_PUBLIC_HOLIDAYS, ...extra])
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function isPublicHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(formatDateKey(date))
}

function getMonthDateRange(monthKey: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getPreviousMonthKey(base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function getFormattedEmployeeCode(userId: string): Promise<string> {
  // Business requirement: employee codes should start from 005.
  const employees = await prisma.user.findMany({
    where: {
      role: {
        not: UserRole.SUPER_ADMIN,
      },
    },
    select: {
      id: true,
      joiningDate: true,
      createdAt: true,
      name: true,
    },
  })
  const employeeCodeMap = buildEmployeeCodeMap(employees)
  return employeeCodeMap.get(userId) || '---'
}

function getWorkingDaysInMonth(monthKey: string, holidays: Set<string>): number {
  const { start, end } = getMonthDateRange(monthKey)
  const cursor = new Date(start)
  let days = 0
  while (cursor <= end) {
    if (!isSunday(cursor) && !isPublicHoliday(cursor, holidays)) {
      days += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function monthKeyToRange(monthKey: string): string {
  const { start, end } = getMonthDateRange(monthKey)
  return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 10.5, fontFamily: 'Helvetica', color: '#0f172a', backgroundColor: '#f8fafc' },
  shell: {
    borderWidth: 1,
    borderColor: '#dbe5ef',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  companyName: { fontSize: 16, fontWeight: 700, color: '#ffffff' },
  companyMeta: { marginTop: 2, color: '#cbd5e1', fontSize: 9.5 },
  titleWrap: { alignItems: 'flex-end' },
  slipTitle: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.8 },
  slipMonth: { marginTop: 2, color: '#ffffff', fontSize: 11, fontWeight: 600 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, color: '#1e293b' },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { color: '#475569' },
  value: { fontWeight: 600, maxWidth: '58%', textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 6,
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  cellParticular: { width: '45%' },
  cellFormula: { width: '30%', color: '#64748b', fontSize: 9.5 },
  cellAmount: { width: '25%', textAlign: 'right', fontWeight: 600 },
  splitCards: { flexDirection: 'row', gap: 10, marginTop: 2 },
  splitCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  splitTitle: { fontSize: 10.5, fontWeight: 700, color: '#1e293b', marginBottom: 8 },
  netPayWrap: {
    backgroundColor: '#0f766e',
    borderWidth: 1,
    borderColor: '#0f766e',
    padding: 10,
    borderRadius: 4,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netPayLabel: { fontSize: 12, fontWeight: 700, color: '#ffffff' },
  netPayValue: { fontSize: 15, fontWeight: 700, color: '#ffffff' },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: { color: '#64748b', fontSize: 9.5, marginBottom: 2 },
})

function PayslipPdf({ data }: { data: PayslipData }) {
  const companyName = process.env.COMPANY_NAME || 'TechDR'
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <View>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companyMeta}>Employee Salary Statement</Text>
            </View>
            <View style={styles.titleWrap}>
              <Text style={styles.slipTitle}>PAYSLIP</Text>
              <Text style={styles.slipMonth}>{monthKeyToLabel(data.monthKey)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Employee Information</Text>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <View style={styles.row}>
                  <Text style={styles.label}>Employee Name</Text>
                  <Text style={styles.value}>{data.employeeName}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Employee ID</Text>
                  <Text style={styles.value}>{data.employeeId}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Designation</Text>
                  <Text style={styles.value}>{data.designation}</Text>
                </View>
              </View>
              <View style={styles.col}>
                <View style={styles.row}>
                  <Text style={styles.label}>Pay Period</Text>
                  <Text style={styles.value}>{monthKeyToRange(data.monthKey)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{data.employeeEmail}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Generated On</Text>
                  <Text style={styles.value}>{formatDateTime(data.generatedAt)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.splitCards}>
            <View style={styles.splitCard}>
              <Text style={styles.splitTitle}>Attendance Summary</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Working Days</Text>
                <Text style={styles.value}>{data.workingDays.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Present Days</Text>
                <Text style={styles.value}>{data.presentDays.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Absent Days</Text>
                <Text style={styles.value}>{data.absentDays.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.splitCard}>
              <Text style={styles.splitTitle}>Pay Metrics</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Gross Salary</Text>
                <Text style={styles.value}>{formatCurrency(data.grossSalary)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Per Day Salary</Text>
                <Text style={styles.value}>{formatCurrency(data.perDaySalary)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>LOP Deduction</Text>
                <Text style={styles.value}>{formatCurrency(data.deductionAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Salary Breakdown</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.label, styles.cellParticular]}>Particulars</Text>
              <Text style={[styles.label, styles.cellFormula]}>Calculation</Text>
              <Text style={[styles.label, styles.cellAmount]}>Amount</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cellParticular}>Gross Salary</Text>
              <Text style={styles.cellFormula}>Monthly Fixed</Text>
              <Text style={styles.cellAmount}>{formatCurrency(data.grossSalary)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cellParticular}>Deduction (LOP)</Text>
              <Text style={styles.cellFormula}>
                {data.absentDays.toFixed(2)} x {formatCurrency(data.perDaySalary)}
              </Text>
              <Text style={styles.cellAmount}>- {formatCurrency(data.deductionAmount)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cellParticular}>Net Before Rounding</Text>
              <Text style={styles.cellFormula}>Gross - Deduction</Text>
              <Text style={styles.cellAmount}>{formatCurrency(data.payableSalary)}</Text>
            </View>
            <View style={styles.netPayWrap}>
              <Text style={styles.netPayLabel}>Net Payable Salary</Text>
              <Text style={styles.netPayValue}>{formatCurrency(data.payableSalary)}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>This is a system-generated payslip and does not require signature.</Text>
            <Text style={styles.footerText}>For any payroll clarification, please contact HR/Admin.</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generatePayslipPDF(data: PayslipData): Promise<Uint8Array> {
  const pdf = <PayslipPdf data={data} />
  const buffer = await renderToBuffer(pdf)
  return new Uint8Array(buffer)
}

export async function buildPayslipData(userId: string, monthKey: string): Promise<PayslipData | null> {
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, jobTitle: true, isActive: true },
  })

  if (!employee?.isActive || !employee.email) return null

  const salary = await prisma.employeeSalary.findUnique({
    where: { userId_monthKey: { userId, monthKey } },
    select: { amount: true, isActive: true },
  })

  if (!salary?.isActive || salary.amount <= 0) return null

  const holidays = getPublicHolidays()
  const formattedEmployeeCode = await getFormattedEmployeeCode(userId)
  const { start, end } = getMonthDateRange(monthKey)
  const workingDays = getWorkingDaysInMonth(monthKey, holidays)
  if (workingDays <= 0) return null

  const attendances = await prisma.attendances.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { date: true, status: true },
  })

  const attendanceByDay = new Map(attendances.map((a) => [formatDateKey(a.date), a.status]))

  let presentDays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    if (!isSunday(cursor) && !isPublicHoliday(cursor, holidays)) {
      const status = attendanceByDay.get(formatDateKey(cursor))
      if (status === AttendanceStatus.Present || status === AttendanceStatus.Late) {
        presentDays += 1
      } else if (status === AttendanceStatus.HalfDay) {
        presentDays += 0.5
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  const absentDays = Math.max(0, workingDays - presentDays)
  const perDay = salary.amount / workingDays
  const payableSalary = perDay * presentDays
  const deductionAmount = salary.amount - payableSalary

  return {
    employeeId: formattedEmployeeCode,
    employeeName: employee.name,
    employeeEmail: employee.email,
    designation: employee.jobTitle || 'Employee',
    monthKey,
    workingDays,
    presentDays,
    absentDays,
    perDaySalary: perDay,
    deductionAmount,
    grossSalary: salary.amount,
    payableSalary,
    generatedAt: new Date(),
  }
}

export function resolvePayslipMonthKey(inputMonthKey?: string): string {
  return inputMonthKey || getPreviousMonthKey()
}
