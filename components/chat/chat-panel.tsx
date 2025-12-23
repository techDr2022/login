'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { X, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ChatThreadList } from './chat-thread-list'
import { ChatMessages } from './chat-messages'
import { NewMessageDialog } from './new-message-dialog'
import { ChatSettings } from './chat-settings'

interface Thread {
  id: string
  type: 'TEAM' | 'DIRECT'
  unreadCount: number
  lastMessage: {
    id: string
    message: string
    sender: { id: string; name: string; email: string }
    createdAt: string
  } | null
  participants: Array<{ id: string; name: string; email: string; role: string }>
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession()
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'team' | 'direct'>('team')
  const eventSourceRef = useRef<EventSource | null>(null)

  const userRole = session?.user.role as UserRole
  const isManagerOrSuperAdmin =
    userRole === UserRole.MANAGER || userRole === UserRole.SUPER_ADMIN

  useEffect(() => {
    fetchThreads()

    // Set up SSE connection (only once, not on every thread change)
    const eventSource = new EventSource('/api/chat/sse')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message') {
          // Refresh threads to get updated last message
          fetchThreads()
        } else if (data.type === 'connected') {
          console.log('SSE connected')
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      // Connection will be re-established automatically on next fetch
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, []) // Only run once on mount

  const fetchThreads = async () => {
    try {
      const res = await fetch('/api/chat/threads')
      if (res.ok) {
        const data = await res.json()
        const threadsList = data.threads || []
        setThreads(threadsList)

        // Auto-select team thread if available and no thread selected
        if (!selectedThreadId) {
          const teamThread = threadsList.find((t: Thread) => t.type === 'TEAM')
          if (teamThread && teamThread.id) {
            setSelectedThreadId(teamThread.id)
            setActiveTab('team')
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch threads:', res.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching threads:', error)
    }
  }

  const handleThreadSelect = (threadId: string, type: 'TEAM' | 'DIRECT') => {
    setSelectedThreadId(threadId)
    setActiveTab(type === 'TEAM' ? 'team' : 'direct')
    // Mark as read
    fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    })
    // Update local state
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      )
    )
  }

  const teamThread = threads.find((t) => t.type === 'TEAM' && t.id)
  const directThreads = threads.filter((t) => t.type === 'DIRECT' && t.id)

  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white border rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Chat</h2>
        <div className="flex items-center gap-2">
          {isManagerOrSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewMessageOpen(true)}
              title="New message"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const newTab = v as 'team' | 'direct'
          setActiveTab(newTab)
          // Auto-select team thread when switching to team tab
          if (newTab === 'team' && teamThread) {
            setSelectedThreadId(teamThread.id)
          }
        }}
      >
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="team" className="flex-1">
            Team
            {teamThread && teamThread.unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 flex items-center justify-center p-0 rounded-full text-xs"
              >
                {teamThread.unreadCount > 99 ? '99+' : teamThread.unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex-1">
            Manager Messages
            {directThreads.some((t) => t.unreadCount > 0) && (
              <Badge
                variant="destructive"
                className="ml-2 h-4 w-4 rounded-full"
              />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="flex-1 flex flex-col m-0 p-0">
          {teamThread && teamThread.id ? (
            <ChatMessages
              threadId={teamThread.id}
              threadType="TEAM"
              onMessageSent={() => {
                fetchThreads()
                // Mark thread as read after sending
                fetch('/api/chat/read', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ threadId: teamThread.id }),
                }).catch((err) => console.error('Error marking as read:', err))
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p>Loading team thread...</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fetchThreads()}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 flex flex-col m-0 p-0">
          {directThreads.length > 0 ? (
            <div className="flex flex-col h-full">
              {selectedThreadId && directThreads.some((t) => t.id === selectedThreadId) ? (
                <>
                  <div className="border-b p-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThreadId(null)}
                    >
                      ← Back
                    </Button>
                    <span className="text-sm font-medium">
                      {directThreads.find((t) => t.id === selectedThreadId)
                        ?.participants[0]?.name || 'Conversation'}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ChatMessages
                      threadId={selectedThreadId}
                      threadType="DIRECT"
                      onMessageSent={() => {
                        fetchThreads()
                        // Mark thread as read after sending
                        fetch('/api/chat/read', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ threadId: selectedThreadId }),
                        })
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <ChatThreadList
                    threads={directThreads}
                    selectedThreadId={selectedThreadId}
                    onSelectThread={(threadId) =>
                      handleThreadSelect(threadId, 'DIRECT')
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No direct messages yet
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {isNewMessageOpen && (
        <NewMessageDialog
          open={isNewMessageOpen}
          onClose={() => setIsNewMessageOpen(false)}
          onThreadCreated={(threadId) => {
            setIsNewMessageOpen(false)
            fetchThreads()
            setSelectedThreadId(threadId)
            setActiveTab('direct')
          }}
        />
      )}
      {isSettingsOpen && (
        <ChatSettings
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  )
}

