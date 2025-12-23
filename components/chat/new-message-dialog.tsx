'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface NewMessageDialogProps {
  open: boolean
  onClose: () => void
  onThreadCreated: (threadId: string) => void
}

export function NewMessageDialog({
  open,
  onClose,
  onThreadCreated,
}: NewMessageDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUsers()
    }
  }, [open])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/chat/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('Failed to fetch users')
    }
  }

  const handleCreate = async () => {
    if (!selectedUserId) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DIRECT',
          targetUserId: selectedUserId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onThreadCreated(data.thread.id)
        setSelectedUserId('')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create thread')
      }
    } catch (error) {
      console.error('Error creating thread:', error)
      alert('Failed to create thread')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Select a user to start a direct conversation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email}) - {user.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!selectedUserId || isLoading}>
              {isLoading ? 'Creating...' : 'Start Conversation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

