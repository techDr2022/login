'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { getSoundEnabled, setSoundEnabled } from '@/lib/chat-sound'

interface ChatSettingsProps {
  open: boolean
  onClose: () => void
}

export function ChatSettings({ open, onClose }: ChatSettingsProps) {
  const [soundEnabled, setSoundEnabledState] = useState(false)

  useEffect(() => {
    // Load sound setting
    setSoundEnabledState(getSoundEnabled())
  }, [open])

  const handleSoundToggle = () => {
    const newValue = !soundEnabled
    setSoundEnabledState(newValue)
    setSoundEnabled(newValue)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
          <DialogDescription>Manage your chat preferences</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sound">Sound Notifications</Label>
            <Button
              variant={soundEnabled ? 'default' : 'outline'}
              onClick={handleSoundToggle}
            >
              {soundEnabled ? 'On' : 'Off'}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

