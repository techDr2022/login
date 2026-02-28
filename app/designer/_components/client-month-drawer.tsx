'use client'

import { MonthRow, markMonthComplete, updateMonthlyCounts, updateCanvaFolder } from '../actions'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface ClientMonthDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: MonthRow | null
  monthLabel: string
}

function ratio(value: number, target: number): number {
  if (!target) return 0
  return Math.round((value / target) * 100)
}

export function ClientMonthDrawer({ open, onOpenChange, row, monthLabel }: ClientMonthDrawerProps) {
  const [isPending, startTransition] = useTransition()
  const [counts, setCounts] = useState({
    designedCount: row?.designedCount ?? 0,
    approvedCount: row?.approvedCount ?? 0,
    scheduledCount: row?.scheduledCount ?? 0,
  })
  const [canvaUrl, setCanvaUrl] = useState(row?.canvaFolderUrl ?? '')

  if (!row) return null

  const handleMark = (field: 'designed' | 'approved' | 'scheduled') => {
    startTransition(async () => {
      await markMonthComplete({ id: row.id, field })
    })
  }

  const handleSubmitCounts = () => {
    startTransition(async () => {
      await updateMonthlyCounts({
        id: row.id,
        designedCount: counts.designedCount,
        approvedCount: counts.approvedCount,
        scheduledCount: counts.scheduledCount,
      })
    })
  }

  const handleUpdateCanva = () => {
    startTransition(async () => {
      await updateCanvaFolder({
        id: row.id,
        canvaFolderUrl: canvaUrl || null,
      })
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md space-y-6">
        <SheetHeader>
          <SheetTitle>
            {row.clientName} &mdash; {monthLabel}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Designed</span>
              <span>
                {row.designedCount}/{row.targetCount}
              </span>
            </div>
            <Progress value={ratio(row.designedCount, row.targetCount)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Approved</span>
              <span>
                {row.approvedCount}/{row.targetCount}
              </span>
            </div>
            <Progress value={ratio(row.approvedCount, row.targetCount)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Scheduled</span>
              <span>
                {row.scheduledCount}/{row.targetCount}
              </span>
            </div>
            <Progress value={ratio(row.scheduledCount, row.targetCount)} />
          </div>

          <div className="space-y-3">
            <Label htmlFor="canvaUrl">Canva Folder URL</Label>
            <div className="flex gap-2">
              <Input
                id="canvaUrl"
                value={canvaUrl}
                onChange={(e) => setCanvaUrl(e.target.value)}
                placeholder="https://..."
              />
              <Button variant="outline" size="sm" onClick={handleUpdateCanva} disabled={isPending}>
                Save
              </Button>
            </div>
            {row.canvaFolderUrl && (
              <Button asChild variant="link" size="sm" className="px-0">
                <a href={row.canvaFolderUrl} target="_blank" rel="noreferrer">
                  Open Canva folder
                </a>
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {row.lastSharedAt && (
              <p>Last shared: {new Date(row.lastSharedAt).toLocaleString()}</p>
            )}
            {row.approvalPendingSince && (
              <p>Approval pending since: {new Date(row.approvalPendingSince).toLocaleString()}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMark('designed')}
              disabled={isPending}
            >
              Mark Month Designed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMark('approved')}
              disabled={isPending}
            >
              Mark Month Approved
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMark('scheduled')}
              disabled={isPending}
            >
              Mark Month Scheduled
            </Button>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                Set counts manually
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set counts</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Designed</Label>
                  <Input
                    type="number"
                    min={0}
                    max={row.targetCount}
                    value={counts.designedCount}
                    onChange={(e) =>
                      setCounts((prev) => ({ ...prev, designedCount: Number(e.target.value || 0) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Approved</Label>
                  <Input
                    type="number"
                    min={0}
                    max={row.targetCount}
                    value={counts.approvedCount}
                    onChange={(e) =>
                      setCounts((prev) => ({ ...prev, approvedCount: Number(e.target.value || 0) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Scheduled</Label>
                  <Input
                    type="number"
                    min={0}
                    max={row.targetCount}
                    value={counts.scheduledCount}
                    onChange={(e) =>
                      setCounts((prev) => ({ ...prev, scheduledCount: Number(e.target.value || 0) }))
                    }
                  />
                </div>
                <Button onClick={handleSubmitCounts} disabled={isPending}>
                  Save counts
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SheetContent>
    </Sheet>
  )
}

