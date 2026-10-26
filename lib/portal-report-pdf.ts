import { jsPDF } from 'jspdf'
import type { PortalReport, PortalReportTask } from '@/lib/portal-report'

const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const PAPER: [number, number, number] = [248, 250, 252]
const TEAL: [number, number, number] = [15, 118, 110]
const WHITE: [number, number, number] = [255, 255, 255]

function formatDay(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function rangeLabel(report: PortalReport) {
  if (report.from && report.to) return `${formatDay(report.from)} – ${formatDay(report.to)}`
  if (report.from) return `From ${formatDay(report.from)}`
  if (report.to) return `Until ${formatDay(report.to)}`
  return 'All dates'
}

function shortStatus(label: string) {
  if (label === 'Finished') return 'Finished'
  if (label.startsWith('Waiting')) return 'Waiting'
  if (label.includes('overdue')) return 'Overdue'
  return 'In progress'
}

function statusColor(label: string): [number, number, number] {
  if (label === 'Finished') return [22, 163, 74]
  if (label.startsWith('Waiting')) return [180, 83, 9]
  if (label.includes('overdue')) return [185, 28, 28]
  return [37, 99, 235]
}

export function portalReportPdf(report: PortalReport): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const open = report.tasks.filter((task) => task.label !== 'Finished').length
  const finished = report.tasks.length - open
  let y = drawCover(doc, report, report.tasks.length, open, finished)

  if (report.tasks.length === 0) {
    y = ensure(doc, report, y, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...MUTED)
    doc.text('No work in this date range or category.', 16, y)
  } else {
    const groups = new Map<string, PortalReportTask[]>()
    for (const task of report.tasks) {
      const list = groups.get(task.category) || []
      list.push(task)
      groups.set(task.category, list)
    }
    for (const [category, tasks] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      y = ensure(doc, report, y, 18)
      doc.setFillColor(...PAPER)
      doc.roundedRect(14, y, 182, 8, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...TEAL)
      doc.text(category, 18, y + 5.4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(String(tasks.length), 190, y + 5.4, { align: 'right' })
      y += 12
      for (const task of tasks) y = drawTask(doc, report, task, y)
    }
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(14, 284, 196, 284)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('TaskFlow', 14, 289)
    doc.text(`Generated ${formatDay(report.generatedOn)}`, 105, 289, { align: 'center' })
    doc.text(`${page} / ${pages}`, 196, 289, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}

function drawCover(doc: jsPDF, report: PortalReport, total: number, open: number, finished: number) {
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, 210, 48, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('WORK REPORT', 16, 14)
  doc.setFontSize(20)
  const name = doc.splitTextToSize(report.clientName, 178)[0]
  doc.text(name, 16, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const clinic = report.clinicName && report.clinicName !== report.clientName ? `${report.clinicName} · ` : ''
  doc.text(`${clinic}${rangeLabel(report)} · ${report.category}`, 16, 36)

  const cards = [
    ['Tasks', String(total)],
    ['Under progress', String(open)],
    ['Finished', String(finished)],
  ] as const
  cards.forEach(([label, value], index) => {
    const x = 14 + index * 62
    doc.setFillColor(...PAPER)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, 56, 58, 22, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...INK)
    doc.text(value, x + 5, 66)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x + 5, 73)
  })
  return 88
}

function ensure(doc: jsPDF, report: PortalReport, y: number, needed: number) {
  if (y + needed <= 278) return y
  doc.addPage()
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, 210, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(`Work report · ${report.clientName}`, 14, 7.5)
  return 20
}

function drawTask(doc: jsPDF, report: PortalReport, task: PortalReportTask, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const titleLines = doc.splitTextToSize(task.title, 128)
  const height = Math.max(12, titleLines.length * 4.4 + 8)
  y = ensure(doc, report, y, height + 2)
  const color = statusColor(task.label)
  doc.setFillColor(...color)
  doc.rect(14, y, 1.4, height - 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text(titleLines, 18, y + 4)

  const status = shortStatus(task.label)
  doc.setFontSize(8)
  const pillWidth = doc.getTextWidth(status) + 6
  doc.setFillColor(...color)
  doc.roundedRect(192 - pillWidth, y + 0.5, pillWidth, 5, 1.2, 1.2, 'F')
  doc.setTextColor(...WHITE)
  doc.text(status, 195 - pillWidth, y + 4)

  const detail = [task.due ? formatDay(task.due) : 'No date', task.label].join('  ·  ')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(detail, 170)[0], 18, y + 4 + titleLines.length * 4.4)
  return y + height
}
