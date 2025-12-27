'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { X, Plus, Settings, MessageSquare, Users } from 'lucide-react'
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
  const [isLoading, setIsLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const userRole = session?.user.role as UserRole
  const isManagerOrSuperAdmin =
    userRole === UserRole.SUPER_ADMIN

  const fetchThreads = useCallback(async () => {
    try {
      setIsLoading(true)
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
    } finally {
      setIsLoading(false)
    }
  }, [selectedThreadId])

  useEffect(() => {
    fetchThreads()

    // Set up SSE connection (only once, not on every thread change)
    const eventSource = new EventSource('/api/chat/sse')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message') {
          // Optimistically update threads
          setThreads((prev) => {
            return prev.map((thread) => {
              if (thread.id === data.message?.threadId) {
                return {
                  ...thread,
                  lastMessage: {
                    id: data.message.id,
                    message: data.message.message,
                    sender: data.message.sender || data.message.User,
                    createdAt: data.message.createdAt,
                  },
                  unreadCount: thread.id === selectedThreadId ? 0 : thread.unreadCount + 1,
                }
              }
              return thread
            })
          })
        } else if (data.type === 'connected') {
          console.log('SSE connected')
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchThreads, selectedThreadId])

  const handleThreadSelect = useCallback((threadId: string, type: 'TEAM' | 'DIRECT') => {
    setSelectedThreadId(threadId)
    setActiveTab(type === 'TEAM' ? 'team' : 'direct')
    // Mark as read
    fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    }).catch((err) => console.error('Error marking as read:', err))
    // Update local state optimistically
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      )
    )
  }, [])

  const teamThread = useMemo(() => threads.find((t) => t.type === 'TEAM' && t.id), [threads])
  const directThreads = useMemo(() => threads.filter((t) => t.type === 'DIRECT' && t.id), [threads])
  const totalUnreadDirect = useMemo(() => 
    directThreads.reduce((sum, t) => sum + t.unreadCount, 0), 
    [directThreads]
  )

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[420px] h-[650px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm">
      {/* Modern Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Chat</h2>
            <p className="text-xs text-gray-500">Quick messages</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isManagerOrSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewMessageOpen(true)}
              title="New message"
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="h-8 w-8 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Modern Tabs */}
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
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="w-full rounded-none border-b border-gray-200 bg-white/50 backdrop-blur-sm h-12 px-3">
          <TabsTrigger 
            value="team" 
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all text-sm"
          >
            <Users className="h-4 w-4" />
            <span>Team</span>
            {teamThread && teamThread.unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
              >
                {teamThread.unreadCount > 99 ? '99+' : teamThread.unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="direct" 
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Direct</span>
            {totalUnreadDirect > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
              >
                {totalUnreadDirect > 99 ? '99+' : totalUnreadDirect}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="flex-1 flex flex-col m-0 p-0 min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-xs text-gray-500">Loading...</p>
              </div>
            </div>
          ) : teamThread && teamThread.id ? (
            <ChatMessages
              threadId={teamThread.id}
              threadType="TEAM"
              onMessageSent={() => {
                fetchThreads()
                fetch('/api/chat/read', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ threadId: teamThread.id }),
                }).catch((err) => console.error('Error marking as read:', err))
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center space-y-2">
                <MessageSquare className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="text-xs">No team thread</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => fetchThreads()}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 flex flex-col m-0 p-0 min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-xs text-gray-500">Loading...</p>
              </div>
            </div>
          ) : directThreads.length > 0 ? (
            <div className="flex flex-col h-full">
              {selectedThreadId && directThreads.some((t) => t.id === selectedThreadId) ? (
                <>
                  <div className="border-b border-gray-200 px-4 py-2.5 flex items-center gap-2 bg-white/50 backdrop-blur-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThreadId(null)}
                      className="h-7 px-2 text-xs hover:bg-gray-100"
                    >
                      ← Back
                    </Button>
                    <div className="h-4 w-px bg-gray-300" />
                    <span className="text-xs font-semibold text-gray-900">
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
                        fetch('/api/chat/read', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ threadId: selectedThreadId }),
                        }).catch((err) => console.error('Error marking as read:', err))
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto bg-gray-50/50">
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
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="text-xs font-medium text-gray-500">No direct messages</p>
                {isManagerOrSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewMessageOpen(true)}
                    className="mt-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1.5" />
                    Start conversation
                  </Button>
                )}
              </div>
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

