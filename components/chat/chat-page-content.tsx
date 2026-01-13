'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useRouter } from 'next/navigation'
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

export function ChatPageContent() {
  const router = useRouter()
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
          const teamThread = threadsList.find((t: Thread) => t.type === 'TEAM' && t.id)
          if (teamThread) {
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
    <div className="h-[calc(100vh-12rem)] bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
      {/* Modern Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team Chat</h2>
            <p className="text-xs text-gray-500">Stay connected with your team</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManagerOrSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewMessageOpen(true)}
              title="New message"
              className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/dashboard')}
            className="hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
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
        <TabsList className="w-full rounded-none border-b border-gray-200 bg-white/50 backdrop-blur-sm h-14 px-4">
          <TabsTrigger 
            value="team" 
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all"
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
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Direct Messages</span>
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
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500">Loading team chat...</p>
              </div>
            </div>
          ) : teamThread && teamThread.id ? (
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
              <div className="text-center space-y-3">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="text-sm">No team thread available</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchThreads()}
                  className="mt-2"
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
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500">Loading messages...</p>
              </div>
            </div>
          ) : directThreads.length > 0 ? (
            <div className="flex flex-col h-full">
              {selectedThreadId && directThreads.some((t) => t.id === selectedThreadId) ? (
                <>
                  <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3 bg-white/50 backdrop-blur-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThreadId(null)}
                      className="hover:bg-gray-100"
                    >
                      ← Back
                    </Button>
                    <div className="h-6 w-px bg-gray-300" />
                    <span className="text-sm font-semibold text-gray-900">
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
              <div className="text-center space-y-3">
                <MessageSquare className="h-16 w-16 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-500">No direct messages yet</p>
                {isManagerOrSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewMessageOpen(true)}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start a conversation
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

