'use client'

import { useEffect, useState, useTransition } from 'react'
import { MonthRow, markApprovalSent } from '../actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ApprovalsTabProps {
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

export function ApprovalsTab({ monthKey, fetchRows }: ApprovalsTabProps) {
  const [rows, setRows] = useState<MonthRow[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchRows({ monthKey })
      setRows(data)
    })
  }, [monthKey, fetchRows])

  const handleFollowUp = async (row: MonthRow) => {
    const monthLabel = formatMonthLabel(monthKey)
    const message = `Hi team, ${monthLabel} creatives for ${row.clientName} are ready. Please review and approve so we can schedule on time. Thank you.`
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // ignore clipboard errors
    }
    await markApprovalSent({ id: row.id })
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clients where designs are ready but approvals are pending. Follow-up message is copied to
        clipboard automatically.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Pending Since</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No pending approvals for this month.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.clientName}</TableCell>
                  <TableCell>{formatMonthLabel(monthKey)}</TableCell>
                  <TableCell>
                    {row.approvalPendingSince
                      ? new Date(row.approvalPendingSince).toLocaleString()
                      : 'Not sent'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => handleFollowUp(row)}>
                      Send Follow-up
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

