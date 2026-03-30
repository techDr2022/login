'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { createClientService, deleteClientService, createClientUSP, deleteClientUSP } from '@/app/actions/client-onboarding-actions'

interface Step3ServicesProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step3Services({ clientId, data, onComplete, onSave, loading }: Step3ServicesProps) {
  const [services, setServices] = useState<any[]>(data.services || [])
  const [usps, setUsps] = useState<any[]>(data.usps || [])
  const [serviceName, setServiceName] = useState('')
  const [uspText, setUspText] = useState('')

  const handleAddService = async () => {
    if (!serviceName.trim() || !clientId) return

    try {
      const service = await createClientService(clientId, {
        name: serviceName,
        isPriority: false,
      })
      setServices([...services, service])
      setServiceName('')
    } catch (err: any) {
      console.error('Failed to add service:', err)
    }
  }

  const handleRemoveService = async (id: string) => {
    try {
      await deleteClientService(id)
      setServices(services.filter(s => s.id !== id))
    } catch (err: any) {
      console.error('Failed to remove service:', err)
    }
  }

  const handleAddUSP = async () => {
    if (!uspText.trim() || !clientId) return

    try {
      const usp = await createClientUSP(clientId, { uspText })
      setUsps([...usps, usp])
      setUspText('')
    } catch (err: any) {
      console.error('Failed to add USP:', err)
    }
  }

  const handleRemoveUSP = async (id: string) => {
    try {
      await deleteClientUSP(id)
      setUsps(usps.filter(u => u.id !== id))
    } catch (err: any) {
      console.error('Failed to remove USP:', err)
    }
  }

  const handleNext = async () => {
    // Save and then move to next step
    if (onSave) {
      try {
        await onSave({ services, usps })
      } catch (err) {
        return // Error handling is done in parent
      }
    }
    onComplete({ services, usps })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="serviceName">Service Name *</Label>
          <div className="flex gap-2">
            <Input
              id="serviceName"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Consultation, Surgery, etc."
              onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
            />
            <Button type="button" onClick={handleAddService} disabled={!serviceName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {services.length > 0 && (
          <div className="space-y-2">
            <Label>Services</Label>
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span>{service.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveService(service.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="uspText">Unique Selling Point (USP)</Label>
          <div className="flex gap-2">
            <Textarea
              id="uspText"
              value={uspText}
              onChange={(e) => setUspText(e.target.value)}
              placeholder="What makes this client unique?"
              rows={2}
            />
            <Button type="button" onClick={handleAddUSP} disabled={!uspText.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {usps.length > 0 && (
          <div className="space-y-2">
            <Label>USPs</Label>
            {usps.map((usp) => (
              <Card key={usp.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span>{usp.uspText}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUSP(usp.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleNext} disabled={loading || services.length === 0}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </div>
  )
}

