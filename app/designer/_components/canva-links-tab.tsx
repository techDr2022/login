'use client'

import { useEffect, useState, useTransition } from 'react'
import { MonthRow } from '../actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface CanvaLinksTabProps {
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

export function CanvaLinksTab({ monthKey, fetchRows }: CanvaLinksTabProps) {
  const [rows, setRows] = useState<MonthRow[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchRows({ monthKey })
      setRows(data)
    })
  }, [monthKey, fetchRows])

  const handleCopy = async (url?: string | null) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
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
        Canva folder URLs for {formatMonthLabel(monthKey)}. Use this as a quick reference for the
        team; no poster-level links here.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Canva Folder URL</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No Canva folders saved for this month.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.clientName}</TableCell>
                  <TableCell>{formatMonthLabel(monthKey)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {row.canvaFolderUrl ? (
                      <a
                        href={row.canvaFolderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        {row.canvaFolderUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.lastSharedAt
                      ? new Date(row.lastSharedAt).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(row.canvaFolderUrl)}
                      disabled={!row.canvaFolderUrl}
                    >
                      Copy Link
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

