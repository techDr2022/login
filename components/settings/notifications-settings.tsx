'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface NotificationPreferences {
  notifyTaskUpdates: boolean
  notifyClientChanges: boolean
  notifyChatMentions: boolean
}

export function NotificationsSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notifyTaskUpdates: true,
    notifyClientChanges: true,
    notifyChatMentions: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/users/notifications')
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to load notification preferences')
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      setError('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }

  const updatePreference = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    const previousValue = preferences[key]
    
    try {
      // Optimistically update UI
      const updatedPreferences = { ...preferences, [key]: value }
      setPreferences(updatedPreferences)

      const response = await fetch('/api/users/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Revert on error
        setPreferences({ ...preferences, [key]: previousValue })
        throw new Error(errorData.error || 'Failed to update preference')
      }

      setSuccess('Notification preference updated successfully')
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error('Error updating preference:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update notification preference. Please try again.'
      setError(errorMessage)
      // Revert state on error
      setPreferences({ ...preferences, [key]: previousValue })
      // Clear error message after 5 seconds (unless it's a login-related error)
      if (!errorMessage.includes('log in')) {
        setTimeout(() => setError(null), 5000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          <div className="h-16 bg-muted animate-pulse rounded" />
          <div className="h-16 bg-muted animate-pulse rounded" />
          <div className="h-16 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control which alerts you receive.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Task updates</p>
            <p className="text-xs text-muted-foreground">
              Get notified when tasks assigned to you change.
            </p>
          </div>
          <Checkbox
            checked={preferences.notifyTaskUpdates}
            onCheckedChange={(checked) =>
              updatePreference('notifyTaskUpdates', checked === true)
            }
            disabled={saving}
            aria-label="Task updates"
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Client changes</p>
            <p className="text-xs text-muted-foreground">
              Alerts for new clients or major onboarding updates.
            </p>
          </div>
          <Checkbox
            checked={preferences.notifyClientChanges}
            onCheckedChange={(checked) =>
              updatePreference('notifyClientChanges', checked === true)
            }
            disabled={saving}
            aria-label="Client changes"
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Chat mentions</p>
            <p className="text-xs text-muted-foreground">
              Notifications when someone mentions you in team chat.
            </p>
          </div>
          <Checkbox
            checked={preferences.notifyChatMentions}
            onCheckedChange={(checked) =>
              updatePreference('notifyChatMentions', checked === true)
            }
            disabled={saving}
            aria-label="Chat mentions"
          />
        </div>
      </div>
    </div>
  )
}

