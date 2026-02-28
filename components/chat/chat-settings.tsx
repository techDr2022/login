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
import { Settings, Volume2, VolumeX } from 'lucide-react'

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Chat Settings
          </DialogTitle>
          <DialogDescription>
            Manage your chat preferences and notifications
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-blue-600" />
              ) : (
                <VolumeX className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <Label htmlFor="sound" className="text-sm font-semibold cursor-pointer">
                  Sound Notifications
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Play sound when receiving new messages
                </p>
              </div>
            </div>
            <Button
              id="sound"
              variant={soundEnabled ? 'default' : 'outline'}
              onClick={handleSoundToggle}
              className="min-w-[80px]"
            >
              {soundEnabled ? 'On' : 'Off'}
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

