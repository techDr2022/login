'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { upsertClientMarketingRequirement } from '@/app/actions/client-onboarding-actions'

interface Step8MarketingProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onFinalize?: never
  loading: boolean
}

export function Step8Marketing({ clientId, data, onComplete, loading }: Step8MarketingProps) {
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
    notes: data.marketing?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      await upsertClientMarketingRequirement(clientId, requirements)
      onComplete({ marketing: requirements })
    } catch (err: any) {
      console.error('Failed to save marketing requirements:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gmbOptimisation"
            checked={requirements.gmbOptimisation}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, gmbOptimisation: !!checked })
            }
          />
          <Label htmlFor="gmbOptimisation" className="cursor-pointer">
            GMB Optimization
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="websiteSeo"
            checked={requirements.websiteSeo}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, websiteSeo: !!checked })
            }
          />
          <Label htmlFor="websiteSeo" className="cursor-pointer">
            Website SEO
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="googleAds"
            checked={requirements.googleAds}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, googleAds: !!checked })
            }
          />
          <Label htmlFor="googleAds" className="cursor-pointer">
            Google Ads
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="metaAds"
            checked={requirements.metaAds}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, metaAds: !!checked })
            }
          />
          <Label htmlFor="metaAds" className="cursor-pointer">
            Meta Ads
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="reviewManagement"
            checked={requirements.reviewManagement}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, reviewManagement: !!checked })
            }
          />
          <Label htmlFor="reviewManagement" className="cursor-pointer">
            Review Management
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="posters"
            checked={requirements.posters}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, posters: !!checked })
            }
          />
          <Label htmlFor="posters" className="cursor-pointer">
            Posters
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="videos"
            checked={requirements.videos}
            onCheckedChange={(checked) =>
              setRequirements({ ...requirements, videos: !!checked })
            }
          />
          <Label htmlFor="videos" className="cursor-pointer">
            Videos
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="socialPostsPerWeek">Social Posts per Week</Label>
          <Input
            id="socialPostsPerWeek"
            type="number"
            min="0"
            value={requirements.socialPostsPerWeek}
            onChange={(e) =>
              setRequirements({ ...requirements, socialPostsPerWeek: parseInt(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="socialPostsPerMonth">Social Posts per Month</Label>
          <Input
            id="socialPostsPerMonth"
            type="number"
            min="0"
            value={requirements.socialPostsPerMonth}
            onChange={(e) =>
              setRequirements({ ...requirements, socialPostsPerMonth: parseInt(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label htmlFor="reelsPerMonth">Reels per Month</Label>
          <Input
            id="reelsPerMonth"
            type="number"
            min="0"
            value={requirements.reelsPerMonth}
            onChange={(e) =>
              setRequirements({ ...requirements, reelsPerMonth: parseInt(e.target.value) || 0 })
            }
          />
        </div>
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
          Next Step
        </Button>
      </div>
    </form>
  )
}

