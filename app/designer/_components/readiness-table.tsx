'use client'

import { MonthOverview, MonthRow } from '../actions'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ClientMonthDrawer } from './client-month-drawer'
import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

interface ReadinessTableProps {
  monthKey: string
  overview: MonthOverview
  loading?: boolean
  onSearchChange: (value: string) => void
  onSortChange: (value: 'status' | 'designed') => void
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const date = new Date(year, month, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getStatusBadge(row: MonthRow) {
  if (row.status === 'DELAY') {
    return <Badge variant="destructive">Delay</Badge>
  }
  if (row.status === 'IN_PROGRESS') {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-700">In Progress</Badge>
  }
  return <Badge variant="outline" className="border-green-500 text-green-700">Ready</Badge>
}

export function ReadinessTable({
  monthKey,
  overview,
  loading,
  onSearchChange,
  onSortChange,
}: ReadinessTableProps) {
  const [selectedRow, setSelectedRow] = useState<MonthRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState('')

  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])

  const handleRowClick = (row: MonthRow) => {
    setSelectedRow(row)
    setDrawerOpen(true)
  }

  const handleSearchInput = (value: string) => {
    setLocalSearch(value)
    onSearchChange(value)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="border rounded-md">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b p-3 last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Search by client name..."
          className="w-full md:max-w-sm"
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onSortChange('status')}>
            Sort by status
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSortChange('designed')}>
            Sort by designed completion
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Designed</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Scheduled</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No clients found for this month.
                </TableCell>
              </TableRow>
            ) : (
              overview.rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell className="font-medium">{row.clientName}</TableCell>
                  <TableCell className="text-right">{row.targetCount}</TableCell>
                  <TableCell className="text-right">{row.designedCount}</TableCell>
                  <TableCell className="text-right">{row.approvedCount}</TableCell>
                  <TableCell className="text-right">{row.scheduledCount}</TableCell>
                  <TableCell>{getStatusBadge(row)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ClientMonthDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        row={selectedRow}
        monthLabel={monthLabel}
      />
    </>
  )
}

