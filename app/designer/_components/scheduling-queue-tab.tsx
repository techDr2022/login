'use client'

import { useEffect, useState, useTransition } from 'react'
import { MonthRow, markMonthComplete } from '../actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SchedulingQueueTabProps {
  monthKey: string
  fetchRows: (input: { monthKey: string }) => Promise<MonthRow[]>
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const date = new Date(year, month, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function SchedulingQueueTab({ monthKey, fetchRows }: SchedulingQueueTabProps) {
  const [rows, setRows] = useState<MonthRow[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchRows({ monthKey })
      setRows(data)
    })
  }, [monthKey, fetchRows])

  const handleMarkScheduled = async (row: MonthRow) => {
    await markMonthComplete({ id: row.id, field: 'scheduled' })
  }

  if (rows === null || isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="border rounded-md">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b p-3 last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const total = rows.length
  const fullyScheduled = rows.filter((r) => r.scheduledCount >= r.targetCount).length

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Scheduling status for {formatMonthLabel(monthKey)}. {fullyScheduled} of {total} pending
        clients are fully scheduled.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No clients in scheduling queue for this month.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.clientName}</TableCell>
                  <TableCell>
                    {row.approvedCount}/{row.targetCount}
                  </TableCell>
                  <TableCell>
                    {row.scheduledCount}/{row.targetCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkScheduled(row)}
                    >
                      Mark Month Scheduled
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

