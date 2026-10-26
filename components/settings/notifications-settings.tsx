'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setSoundEnabled, setTaskSoundEnabled } from '@/lib/chat-sound'
import { requestDesktopNotificationPermission } from '@/lib/desktop-notification'

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
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    loadPreferences()
    setDesktopPermission(
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'unsupported'
    )
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

    if (value && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void requestDesktopNotificationPermission().then(setDesktopPermission)
    }

    if (key === 'notifyTaskUpdates') setTaskSoundEnabled(value)
    if (key === 'notifyChatMentions') setSoundEnabled(value)
    
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
      window.dispatchEvent(new Event('techdr-notification-prefs'))
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error('Error updating preference:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update notification preference. Please try again.'
      setError(errorMessage)
      setPreferences({ ...preferences, [key]: previousValue })
      if (key === 'notifyTaskUpdates') setTaskSoundEnabled(previousValue)
      if (key === 'notifyChatMentions') setSoundEnabled(previousValue)
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
          Each option sends its own Chrome popup.
        </p>
      </div>
      {desktopPermission === 'denied' && (
        <Alert variant="destructive">
          <AlertDescription>
            Chrome is blocking popups. Allow notifications from the lock icon in the address bar.
          </AlertDescription>
        </Alert>
      )}
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
              Popup and sound when a task is assigned, created, or completed.
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
              Popup when a client is added or onboarding is completed.
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
              Popup and sound for new team chat messages.
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

