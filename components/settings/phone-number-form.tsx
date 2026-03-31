'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface PhoneNumberFormProps {
  currentPhoneNumber: string | null | undefined
  onUpdate?: () => void
}

export function PhoneNumberForm({ currentPhoneNumber, onUpdate }: PhoneNumberFormProps) {
  const [phoneNumber, setPhoneNumber] = useState(currentPhoneNumber || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const res = await fetch('/api/users/phone-number', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() || null }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update phone number')
      }

      setSuccess(true)
      if (onUpdate) {
        onUpdate()
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Phone number updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number (WhatsApp)</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+91 9876543210"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          Used for WhatsApp notifications when employees clock in/out and when tasks are assigned to you.
          Leave empty to remove.
        </p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Update Phone Number'}
      </Button>
    </form>
  )
}

