'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileFormProps {
  currentName: string
  currentEmail: string
  currentJobTitle: string
}

export function ProfileForm({ currentName, currentEmail, currentJobTitle }: ProfileFormProps) {
  const [email, setEmail] = useState(currentEmail)
  const [jobTitle, setJobTitle] = useState(currentJobTitle)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!email.trim()) {
      setError('Personal email is required')
      return
    }
    if (!jobTitle.trim()) {
      setError('Designation is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          jobTitle: jobTitle.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setEmail(data.user?.email || email.trim())
      setJobTitle(data.user?.jobTitle || jobTitle.trim())
      setSuccess(true)
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
            Profile updated successfully. Re-login to refresh session email everywhere.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={currentName} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personalEmail">
            Personal Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="personalEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="designation">
          Designation <span className="text-destructive">*</span>
        </Label>
        <Input
          id="designation"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Graphic Designer Intern"
          required
          className="max-w-md"
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Update Profile'}
      </Button>
    </form>
  )
}
