'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { createClientCompetitor, deleteClientCompetitor } from '@/app/actions/client-onboarding-actions'

interface Step7CompetitorsProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onFinalize?: never
  loading: boolean
}

export function Step7Competitors({ clientId, data, onComplete, loading }: Step7CompetitorsProps) {
  const [competitors, setCompetitors] = useState<any[]>(data.competitors || [])
  const [name, setName] = useState('')
  const [googleMapLink, setGoogleMapLink] = useState('')

  const handleAddCompetitor = async () => {
    if (!name.trim() || !clientId) return

    try {
      const competitor = await createClientCompetitor(clientId, {
        name,
        googleMapLink: googleMapLink || undefined,
      })
      setCompetitors([...competitors, competitor])
      setName('')
      setGoogleMapLink('')
    } catch (err: any) {
      console.error('Failed to add competitor:', err)
    }
  }

  const handleRemoveCompetitor = async (id: string) => {
    try {
      await deleteClientCompetitor(id)
      setCompetitors(competitors.filter(c => c.id !== id))
    } catch (err: any) {
      console.error('Failed to remove competitor:', err)
    }
  }

  const handleNext = () => {
    onComplete({ competitors })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="competitorName">Competitor Name *</Label>
            <Input
              id="competitorName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Competitor name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCompetitor()}
            />
          </div>
          <div>
            <Label htmlFor="googleMapLink">Google Map Link</Label>
            <Input
              id="googleMapLink"
              value={googleMapLink}
              onChange={(e) => setGoogleMapLink(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>
        <Button type="button" onClick={handleAddCompetitor} disabled={!name.trim()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Competitor
        </Button>
      </div>

      {competitors.length > 0 && (
        <div className="space-y-2">
          <Label>Competitors</Label>
          {competitors.map((competitor) => (
            <Card key={competitor.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{competitor.name}</p>
                    {competitor.googleMapLink && (
                      <a
                        href={competitor.googleMapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View on Map
                      </a>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCompetitor(competitor.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleNext} disabled={loading}>
          Next Step
        </Button>
      </div>
    </div>
  )
}

