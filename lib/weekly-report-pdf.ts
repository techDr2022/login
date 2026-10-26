import { jsPDF } from 'jspdf'
import type { WeekReportDay, WeekReportSnapshot, WeekReportTask } from '@/lib/weekly-report'

function formatDay(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function spent(hours: number | null) {
  if (!hours || hours <= 0) return ''
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (whole && minutes) return `${whole}h ${minutes}m`
  if (whole) return `${whole}h`
  return `${minutes}m`
}

function write(doc: jsPDF, text: string, y: number, size = 10) {
  doc.setFontSize(size)
  const lines = doc.splitTextToSize(text, 180)
  if (y + lines.length * 5 > 280) {
    doc.addPage()
    y = 18
  }
  doc.text(lines, 14, y)
  return y + lines.length * 5
}

function writeTask(doc: jsPDF, task: WeekReportTask, y: number) {
  const time = spent(task.timeSpent)
  y = write(doc, task.title, y + 1, 11)
  y = write(doc, [task.label, task.due ? `due ${formatDay(task.due)}` : '', time].filter(Boolean).join(' · '), y, 9)
  if (task.deliverableurl) y = write(doc, task.deliverableurl, y, 9)
  return y
}

export function weeklyReportPdf(snapshot: WeekReportSnapshot): Buffer {
  const doc = new jsPDF()
  let y = 18
  doc.setFont('helvetica', 'bold')
  y = write(doc, `Work report · ${snapshot.clientName}`, y, 16)
  doc.setFont('helvetica', 'normal')
  if (snapshot.doctorOrHospitalName) y = write(doc, snapshot.doctorOrHospitalName, y + 1, 11)
  y = write(
    doc,
    `${formatDay(snapshot.weekstart)} to ${formatDay(snapshot.weekend)} · ${snapshot.timezone}`,
    y + 1,
    11
  )
  y = write(doc, `Under progress: ${snapshot.openCount}    Finished: ${snapshot.finishedCount}`, y + 2, 11)
  if (snapshot.postersDesigned != null || snapshot.videosEdited != null) {
    y = write(
      doc,
      `Posters designed ${snapshot.postersDesigned ?? '—'} / approved ${snapshot.postersApproved ?? '—'} · Videos edited ${snapshot.videosEdited ?? '—'} / posted ${snapshot.videosPosted ?? '—'}`,
      y + 1,
      10
    )
  }

  const days: WeekReportDay[] = snapshot.days?.length
    ? snapshot.days
    : [{ date: snapshot.weekstart, tasks: snapshot.tasks || [] }]

  if (days.every((day) => day.tasks.length === 0)) {
    y = write(doc, 'No work recorded in this date range.', y + 6, 11)
  }

  for (const day of days) {
    if (day.tasks.length === 0) continue
    y += 4
    doc.setFont('helvetica', 'bold')
    y = write(doc, formatDay(day.date), y + 2, 12)
    doc.setFont('helvetica', 'normal')
    for (const task of day.tasks) y = writeTask(doc, task, y)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
