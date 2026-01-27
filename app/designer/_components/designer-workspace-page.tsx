'use client'

import { useEffect, useState, useTransition } from 'react'
import { MonthOverview, MonthRow, getMonthOverview, getApprovals, getSchedulingQueue, getCanvaLinks } from '../actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MonthSelector } from './month-selector'
import { KpiCards } from './kpi-cards'
import { ReadinessTable } from './readiness-table'
import { ApprovalsTab } from './approvals-tab'
import { SchedulingQueueTab } from './scheduling-queue-tab'
import { CanvaLinksTab } from './canva-links-tab'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface DesignerWorkspacePageProps {
  initialMonthKey: string
  initialOverview: MonthOverview
}

export function DesignerWorkspacePage({
  initialMonthKey,
  initialOverview,
}: DesignerWorkspacePageProps) {
  const [monthKey, setMonthKey] = useState(initialMonthKey)
  const [overview, setOverview] = useState<MonthOverview>(initialOverview)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'status' | 'designed' | undefined>('status')

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set('month', monthKey)
    router.replace(`${pathname}?${params.toString()}`)
  }, [monthKey, pathname, router, searchParams])

  useEffect(() => {
    startTransition(async () => {
      const data = await getMonthOverview({ monthKey, search, sortBy })
      setOverview(data)
    })
  }, [monthKey, search, sortBy])

  const handleSearchChange = (value: string) => {
    setSearch(value)
  }

  const handleSortChange = (value: 'status' | 'designed') => {
    setSortBy(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Designer Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Month-wise production view across all clients. No poster-level tracking.
          </p>
        </div>
        <MonthSelector monthKey={monthKey} onMonthChange={setMonthKey} />
      </div>

      <KpiCards overview={overview} loading={isPending} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling Queue</TabsTrigger>
          <TabsTrigger value="canva-links">Canva Links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ReadinessTable
            monthKey={monthKey}
            overview={overview}
            loading={isPending}
            onSearchChange={handleSearchChange}
            onSortChange={handleSortChange}
          />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalsTab monthKey={monthKey} fetchRows={getApprovals} />
        </TabsContent>

        <TabsContent value="scheduling">
          <SchedulingQueueTab monthKey={monthKey} fetchRows={getSchedulingQueue} />
        </TabsContent>

        <TabsContent value="canva-links">
          <CanvaLinksTab monthKey={monthKey} fetchRows={getCanvaLinks} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

