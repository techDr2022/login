'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClientAccess, deleteClientAccess } from '@/app/actions/client-onboarding-actions'

interface Step5AccessProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step5Access({ clientId, data, onComplete, onSave, loading }: Step5AccessProps) {
  const [accesses, setAccesses] = useState<any[]>(data.accesses || [])
  const [formData, setFormData] = useState({
    type: 'GMB' as 'GMB' | 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP',
    loginUrl: '',
    username: '',
    password: '',
    notes: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [addingAccess, setAddingAccess] = useState(false)
  const [removingAccessId, setRemovingAccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddAccess = async () => {
    if (!clientId) {
      setError('Client ID is required')
      return
    }

    // Basic validation
    if (!formData.type) {
      setError('Please select an access type')
      return
    }

    setError(null)
    setAddingAccess(true)

    // Create optimistic access with temporary ID
    const tempId = `temp-${Date.now()}`
    const optimisticAccess = {
      id: tempId,
      type: formData.type,
      loginUrl: formData.loginUrl,
      username: formData.username,
      password: formData.password,
      notes: formData.notes,
      isOptimistic: true,
    }

    // Optimistically add to UI immediately
    setAccesses([...accesses, optimisticAccess])
    
    // Clear form immediately for better UX
    const formDataToSave = { ...formData }
    setFormData({
      type: 'GMB',
      loginUrl: '',
      username: '',
      password: '',
      notes: '',
    })

    try {
      // Save to server
      const access = await createClientAccess(clientId, formDataToSave)
      
      // Replace optimistic access with real one
      setAccesses(prev => prev.map(a => a.id === tempId ? access : a))
    } catch (err: any) {
      // Remove optimistic access on error
      setAccesses(prev => prev.filter(a => a.id !== tempId))
      setError(err.message || 'Failed to add access. Please try again.')
      // Restore form data on error
      setFormData(formDataToSave)
    } finally {
      setAddingAccess(false)
    }
  }

  const handleRemoveAccess = async (id: string) => {
    // Skip if it's an optimistic access that failed
    if (id.startsWith('temp-')) {
      setAccesses(accesses.filter(a => a.id !== id))
      return
    }

    setRemovingAccessId(id)
    setError(null)

    // Optimistically remove from UI
    const removedAccess = accesses.find(a => a.id === id)
    setAccesses(accesses.filter(a => a.id !== id))

    try {
      await deleteClientAccess(id)
    } catch (err: any) {
      // Restore on error
      if (removedAccess) {
        setAccesses([...accesses, removedAccess])
      }
      setError(err.message || 'Failed to remove access. Please try again.')
    } finally {
      setRemovingAccessId(null)
    }
  }

  const handleNext = async () => {
    // Save and then move to next step
    if (onSave) {
      try {
        await onSave({ accesses })
      } catch (err) {
        return // Error handling is done in parent
      }
    }
    onComplete({ accesses })
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="accessType">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => {
                setFormData({ ...formData, type: value })
                setError(null)
              }}
              disabled={addingAccess}
            >
              <SelectTrigger id="accessType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GMB">Google My Business</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="loginUrl">Login URL</Label>
            <Input
              id="loginUrl"
              value={formData.loginUrl}
              onChange={(e) => {
                setFormData({ ...formData, loginUrl: e.target.value })
                setError(null)
              }}
              placeholder="https://..."
              disabled={addingAccess}
            />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => {
                setFormData({ ...formData, username: e.target.value })
                setError(null)
              }}
              placeholder="Username or email"
              disabled={addingAccess}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  setError(null)
                }}
                placeholder="Password"
                disabled={addingAccess}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword(!showPassword)}
                disabled={addingAccess}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value })
                setError(null)
              }}
              placeholder="Additional notes..."
              rows={2}
              disabled={addingAccess}
            />
          </div>
        </div>
        <Button 
          type="button" 
          onClick={handleAddAccess}
          disabled={addingAccess || !clientId}
        >
          {addingAccess ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Access
            </>
          )}
        </Button>
      </div>

      {accesses.length > 0 && (
        <div className="space-y-2">
          <Label>Access Credentials</Label>
          {accesses.map((access) => (
            <Card key={access.id} className={access.isOptimistic ? 'opacity-75' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{access.type}</p>
                    {access.username && <p className="text-sm text-muted-foreground">{access.username}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAccess(access.id)}
                    disabled={removingAccessId === access.id}
                  >
                    {removingAccessId === access.id ? (
                      <Loader2 className="w-4 h-4 text-destructive animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleNext} disabled={loading}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </div>
  )
}

