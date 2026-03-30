'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { upsertClientTargeting } from '@/app/actions/client-onboarding-actions'

interface Step6TargetingProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step6Targeting({ clientId, data, onComplete, onSave, loading }: Step6TargetingProps) {
  const [primaryLocation, setPrimaryLocation] = useState(data.targeting?.primaryLocation || '')
  const [nearbyAreas, setNearbyAreas] = useState(data.targeting?.nearbyAreas?.join(', ') || '')
  const [mainKeywords, setMainKeywords] = useState(data.targeting?.mainKeywords?.join(', ') || '')
  const [exampleKeywords, setExampleKeywords] = useState(data.targeting?.exampleKeywords?.join(', ') || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      await upsertClientTargeting(clientId, {
        primaryLocation: primaryLocation || undefined,
        nearbyAreas: nearbyAreas
          ? nearbyAreas.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : undefined,
        mainKeywords: mainKeywords
          ? mainKeywords.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : undefined,
        exampleKeywords: exampleKeywords
          ? exampleKeywords.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : undefined,
      })
      const stepData = {
        targeting: {
          primaryLocation,
          nearbyAreas: nearbyAreas
            ? nearbyAreas.split(',').map((s: string) => s.trim()).filter((s: string) => s)
            : [],
          mainKeywords: mainKeywords
            ? mainKeywords.split(',').map((s: string) => s.trim()).filter((s: string) => s)
            : [],
          exampleKeywords: exampleKeywords
            ? exampleKeywords.split(',').map((s: string) => s.trim()).filter((s: string) => s)
            : [],
        },
      }
      
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
      console.error('Failed to save targeting:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="primaryLocation">Primary Location</Label>
        <Input
          id="primaryLocation"
          value={primaryLocation}
          onChange={(e) => setPrimaryLocation(e.target.value)}
          placeholder="Main location/area"
        />
      </div>

      <div>
        <Label htmlFor="nearbyAreas">Nearby Areas (comma-separated)</Label>
        <Textarea
          id="nearbyAreas"
          value={nearbyAreas}
          onChange={(e) => setNearbyAreas(e.target.value)}
          placeholder="Area 1, Area 2, Area 3"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="mainKeywords">Main Keywords (comma-separated)</Label>
        <Textarea
          id="mainKeywords"
          value={mainKeywords}
          onChange={(e) => setMainKeywords(e.target.value)}
          placeholder="Keyword 1, Keyword 2, Keyword 3"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="exampleKeywords">Example Keywords (comma-separated)</Label>
        <Textarea
          id="exampleKeywords"
          value={exampleKeywords}
          onChange={(e) => setExampleKeywords(e.target.value)}
          placeholder="Example 1, Example 2, Example 3"
          rows={3}
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

