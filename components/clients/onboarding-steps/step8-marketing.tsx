'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { upsertClientMarketingRequirement } from '@/app/actions/client-onboarding-actions'

interface Step8MarketingProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step8Marketing({ clientId, data, onComplete, onSave, loading }: Step8MarketingProps) {
  const [requirements, setRequirements] = useState({
    gmbOptimisation: data.marketing?.gmbOptimisation || false,
    websiteSeo: data.marketing?.websiteSeo || false,
    socialPostsPerWeek: data.marketing?.socialPostsPerWeek || 0,
    socialPostsPerMonth: data.marketing?.socialPostsPerMonth || 0,
    reelsPerMonth: data.marketing?.reelsPerMonth || 0,
    googleAds: data.marketing?.googleAds || false,
    metaAds: data.marketing?.metaAds || false,
    reviewManagement: data.marketing?.reviewManagement || false,
    posters: data.marketing?.posters || false,
    videos: data.marketing?.videos || false,
    postersPerMonth: data.marketing?.postersPerMonth || 0,
    videosPerMonth: data.marketing?.videosPerMonth || 0,
    websiteRequirement: data.marketing?.websiteRequirement || 'NOT_NEEDED',
    appointmentBookingRequired: data.marketing?.appointmentBookingRequired || false,
    telehealthRequired: data.marketing?.telehealthRequired || false,
    gmbStatus: data.marketing?.gmbStatus || 'HAVE_ALREADY',
    socialCreationStatus: data.marketing?.socialCreationStatus || 'HAVE_ALREADY',
    blogsPerMonth: data.marketing?.blogsPerMonth || 0,
    linkedInCreationRequired: data.marketing?.linkedInCreationRequired || false,
    otherServices: data.marketing?.otherServices || '',
    notes: data.marketing?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      const payload = {
        ...requirements,
        posters: requirements.postersPerMonth > 0,
        videos: requirements.videosPerMonth > 0,
      }
      await upsertClientMarketingRequirement(clientId, payload)
      const stepData = { marketing: payload }
      
      // Save and then move to next step
      if (onSave) {
        try {
          await onSave(stepData)
        } catch (_err) {
          return // Error handling is done in parent
        }
      }
      onComplete(stepData)
    } catch (err: any) {
      console.error('Failed to save marketing requirements:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="postersPerMonth">Posters - How many per month</Label>
          <Input
            id="postersPerMonth"
            type="number"
            min="0"
            value={requirements.postersPerMonth}
            onChange={(e) =>
              setRequirements({ ...requirements, postersPerMonth: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="videosPerMonth">Videos - How many per month</Label>
          <Input
            id="videosPerMonth"
            type="number"
            min="0"
            value={requirements.videosPerMonth}
            onChange={(e) =>
              setRequirements({ ...requirements, videosPerMonth: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="websiteRequirement">Website</Label>
          <Select
            value={requirements.websiteRequirement}
            onValueChange={(value) => setRequirements({ ...requirements, websiteRequirement: value })}
          >
            <SelectTrigger id="websiteRequirement">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEEDED">Needed</SelectItem>
              <SelectItem value="NOT_NEEDED">No need</SelectItem>
              <SelectItem value="HAS_OLD_WEBSITE">Old website</SelectItem>
              <SelectItem value="REVAMP">Revamp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="appointmentBookingRequired">Appointment booking system</Label>
          <Select
            value={requirements.appointmentBookingRequired ? 'NEEDED' : 'NOT_NEEDED'}
            onValueChange={(value) =>
              setRequirements({ ...requirements, appointmentBookingRequired: value === 'NEEDED' })
            }
          >
            <SelectTrigger id="appointmentBookingRequired">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEEDED">Needed</SelectItem>
              <SelectItem value="NOT_NEEDED">No need</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="telehealthRequired">Telehealth</Label>
          <Select
            value={requirements.telehealthRequired ? 'NEEDED' : 'NOT_NEEDED'}
            onValueChange={(value) =>
              setRequirements({ ...requirements, telehealthRequired: value === 'NEEDED' })
            }
          >
            <SelectTrigger id="telehealthRequired">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEEDED">Needed</SelectItem>
              <SelectItem value="NOT_NEEDED">No need</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="gmbStatus">GMB</Label>
          <Select
            value={requirements.gmbStatus}
            onValueChange={(value) => setRequirements({ ...requirements, gmbStatus: value })}
          >
            <SelectTrigger id="gmbStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HAVE_ALREADY">Have already</SelectItem>
              <SelectItem value="NEED_TO_CREATE">Need to create</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="socialCreationStatus">Insta/Facebook/YouTube Creation</Label>
          <Select
            value={requirements.socialCreationStatus}
            onValueChange={(value) => setRequirements({ ...requirements, socialCreationStatus: value })}
          >
            <SelectTrigger id="socialCreationStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HAVE_ALREADY">Have already</SelectItem>
              <SelectItem value="NEED_TO_CREATE">Need to create</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="blogsPerMonth">Blogs - How many per month</Label>
          <Input
            id="blogsPerMonth"
            type="number"
            min="0"
            value={requirements.blogsPerMonth}
            onChange={(e) =>
              setRequirements({ ...requirements, blogsPerMonth: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="linkedInCreationRequired">LinkedIn Creation</Label>
          <Select
            value={requirements.linkedInCreationRequired ? 'NEEDED' : 'NOT_NEEDED'}
            onValueChange={(value) =>
              setRequirements({ ...requirements, linkedInCreationRequired: value === 'NEEDED' })
            }
          >
            <SelectTrigger id="linkedInCreationRequired">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEEDED">Needed</SelectItem>
              <SelectItem value="NOT_NEEDED">No need</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="otherServices">Other Services (specific)</Label>
        <Textarea
          id="otherServices"
          value={requirements.otherServices}
          onChange={(e) => setRequirements({ ...requirements, otherServices: e.target.value })}
          placeholder="Mention any specific additional services..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={requirements.notes}
          onChange={(e) => setRequirements({ ...requirements, notes: e.target.value })}
          placeholder="Additional marketing requirements..."
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </form>
  )
}

