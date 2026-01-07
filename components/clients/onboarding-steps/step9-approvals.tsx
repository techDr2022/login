'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { upsertClientApprovalSettings } from '@/app/actions/client-onboarding-actions'

interface Step9ApprovalsProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onFinalize?: never
  loading: boolean
}

export function Step9Approvals({ clientId, data, onComplete, loading }: Step9ApprovalsProps) {
  const [settings, setSettings] = useState({
    pointOfContactName: data.approvals?.pointOfContactName || '',
    approvalTimeHours: data.approvals?.approvalTimeHours?.toString() || '',
    approvalMode: data.approvals?.approvalMode || 'EMAIL',
    performanceTrackingMode: data.approvals?.performanceTrackingMode || 'MANUAL',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      await upsertClientApprovalSettings(clientId, {
        pointOfContactName: settings.pointOfContactName || undefined,
        approvalTimeHours: settings.approvalTimeHours ? parseInt(settings.approvalTimeHours) : undefined,
        approvalMode: settings.approvalMode as any,
        performanceTrackingMode: settings.performanceTrackingMode as any,
      })
      onComplete({ approvals: settings })
    } catch (err: any) {
      console.error('Failed to save approval settings:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="pointOfContactName">Point of Contact Name</Label>
        <Input
          id="pointOfContactName"
          value={settings.pointOfContactName}
          onChange={(e) => setSettings({ ...settings, pointOfContactName: e.target.value })}
          placeholder="Contact person name"
        />
      </div>

      <div>
        <Label htmlFor="approvalTimeHours">Approval Time (Hours)</Label>
        <Input
          id="approvalTimeHours"
          type="number"
          min="0"
          value={settings.approvalTimeHours}
          onChange={(e) => setSettings({ ...settings, approvalTimeHours: e.target.value })}
          placeholder="24"
        />
      </div>

      <div>
        <Label htmlFor="approvalMode">Approval Mode</Label>
        <Select
          value={settings.approvalMode}
          onValueChange={(value) => setSettings({ ...settings, approvalMode: value })}
        >
          <SelectTrigger id="approvalMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="BOTH">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="performanceTrackingMode">Performance Tracking Mode</Label>
        <Select
          value={settings.performanceTrackingMode}
          onValueChange={(value) => setSettings({ ...settings, performanceTrackingMode: value })}
        >
          <SelectTrigger id="performanceTrackingMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO">Auto</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          Next Step
        </Button>
      </div>
    </form>
  )
}

