'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, UserPlus } from 'lucide-react'

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
  const [isFetching, setIsFetching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (open) {
      fetchUsers()
      setSearchQuery('')
      setSelectedUserId('')
    }
  }, [open])

  const fetchUsers = async () => {
    try {
      setIsFetching(true)
      const res = await fetch('/api/chat/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else {
        const error = await res.json()
        console.error('Failed to fetch users:', error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsFetching(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const query = searchQuery.toLowerCase()
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
        onClose()
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            New Message
          </DialogTitle>
          <DialogDescription>
            Select a user to start a direct conversation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* User List */}
          <div className="border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto">
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                      selectedUserId === user.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {user.role.toLowerCase().replace('_', ' ')}
                        </p>
                      </div>
                      {selectedUserId === user.id && (
                        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedUserId || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Start Conversation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

