'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { upsertClientKpiMonthly } from '@/app/actions/client-onboarding-actions'

interface Step10KPIsProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step10KPIs({ clientId, data, onComplete, onSave, loading }: Step10KPIsProps) {
  const [kpi, setKpi] = useState({
    gmbCalls: data.kpis?.[0]?.gmbCalls || 0,
    directionRequests: data.kpis?.[0]?.directionRequests || 0,
    websiteClicks: data.kpis?.[0]?.websiteClicks || 0,
    leadsGenerated: data.kpis?.[0]?.leadsGenerated || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      await upsertClientKpiMonthly(clientId, {
        month,
        gmbCalls: kpi.gmbCalls,
        directionRequests: kpi.directionRequests,
        websiteClicks: kpi.websiteClicks,
        leadsGenerated: kpi.leadsGenerated,
        reportStatus: 'PENDING',
      })
      const stepData = { kpis: [{ ...kpi, month }] }
      
      // Save and then move to next step
      if (onSave) {
        try {
          await onSave(stepData)
        } catch (err) {
          return // Error handling is done in parent
        }
      }
      onComplete(stepData)
    } catch (err: any) {
      console.error('Failed to save KPI:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="gmbCalls">GMB Calls</Label>
          <Input
            id="gmbCalls"
            type="number"
            min="0"
            value={kpi.gmbCalls}
            onChange={(e) => setKpi({ ...kpi, gmbCalls: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="directionRequests">Direction Requests</Label>
          <Input
            id="directionRequests"
            type="number"
            min="0"
            value={kpi.directionRequests}
            onChange={(e) => setKpi({ ...kpi, directionRequests: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="websiteClicks">Website Clicks</Label>
          <Input
            id="websiteClicks"
            type="number"
            min="0"
            value={kpi.websiteClicks}
            onChange={(e) => setKpi({ ...kpi, websiteClicks: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="leadsGenerated">Leads Generated</Label>
          <Input
            id="leadsGenerated"
            type="number"
            min="0"
            value={kpi.leadsGenerated}
            onChange={(e) => setKpi({ ...kpi, leadsGenerated: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </form>
  )
}

