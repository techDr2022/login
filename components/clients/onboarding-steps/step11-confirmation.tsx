'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Step11ConfirmationProps {
  clientId: string | null
  data: any
  onComplete?: never
  onFinalize: (startDate: Date, accountManagerId?: string) => void
  loading: boolean
}

export function Step11Confirmation({ clientId, data, onFinalize, loading }: Step11ConfirmationProps) {
  const [startDate, setStartDate] = useState<Date | null>(
    data.startDate ? new Date(data.startDate) : null
  )
  const [accountManagerId, setAccountManagerId] = useState<string>(data.accountManagerId || '')
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchManagers()
  }, [])

  const fetchManagers = async () => {
    try {
      const res = await fetch('/api/users?role=EMPLOYEE')
      const data = await res.json()
      setManagers(data.users || [])
    } catch (err) {
      console.error('Failed to fetch managers:', err)
    }
  }

  const handleFinalize = () => {
    if (!startDate) {
      alert('Please select a start date')
      return
    }
    onFinalize(startDate as Date, accountManagerId || undefined)
  }

  const completionChecklist = [
    { label: 'Basic Information', completed: !!data.basicInfo },
    { label: 'Doctors', completed: !!(data.doctors && data.doctors.length > 0) },
    { label: 'Services', completed: !!(data.services && data.services.length > 0) },
    { label: 'Branding', completed: !!data.branding },
    { label: 'Access Credentials', completed: !!(data.accesses && data.accesses.length > 0) },
    { label: 'Targeting', completed: !!data.targeting },
    { label: 'Competitors', completed: !!(data.competitors && data.competitors.length > 0) },
    { label: 'Marketing Requirements', completed: !!data.marketing },
    { label: 'Approval Settings', completed: !!data.approvals },
    { label: 'KPIs', completed: !!(data.kpis && data.kpis.length > 0) },
  ]

  const completedCount = completionChecklist.filter(c => c.completed).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Completion: {completedCount} of {completionChecklist.length} sections
            </p>
            <div className="space-y-2">
              {completionChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={item.completed ? 'text-sm' : 'text-sm text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Finalize Onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Start Date *</Label>
            <DatePicker
              date={startDate}
              onSelect={setStartDate}
              placeholder="Select start date"
            />
            <p className="text-sm text-muted-foreground mt-1">
              This will mark the client as ACTIVE and generate monthly tasks automatically.
            </p>
          </div>

          <div>
            <Label htmlFor="accountManagerId">Account Manager</Label>
            <Select
              value={accountManagerId || undefined}
              onValueChange={(value) => setAccountManagerId(value || '')}
            >
              <SelectTrigger id="accountManagerId">
                <SelectValue placeholder="Select account manager (optional)" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Select an employee to assign as the account manager for this client.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Once you confirm onboarding, the client status will change to ACTIVE
              and monthly task templates will be automatically generated. This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleFinalize}
              disabled={loading || !startDate || completedCount < 3}
              size="lg"
            >
              {loading ? 'Finalizing...' : 'Confirm Onboarding'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

