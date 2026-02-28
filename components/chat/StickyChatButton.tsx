'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useChatStore } from '@/store/chatStore'
import { ChatWidget } from './ChatWidget'
import { connectSocket } from '@/lib/socket/chatSocket'
import { useSession } from 'next-auth/react'
import { initChatSound } from '@/lib/chat-sound'

export function StickyChatButton() {
  const { data: session } = useSession()
  const { isOpen, setIsOpen, totalUnread, threads, setThreads, setSelectedThread, activeTab } = useChatStore()
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize socket and load threads
  useEffect(() => {
    if (!session?.user?.id || isInitialized) return

    const initialize = async () => {
      // Connect socket
      connectSocket(session.user.id)

      // Load threads
      try {
        const res = await fetch('/api/chat/threads')
        if (res.ok) {
          const data = await res.json()
          const threadsList = data.threads || []
          setThreads(threadsList)

          // Auto-select team thread if available (only if chat is open)
          if (isOpen) {
            const teamThread = threadsList.find((t: any) => t.type === 'TEAM')
            if (teamThread) {
              setSelectedThread(teamThread.id)
            }
          }
        }
      } catch (error) {
        console.error('Error loading threads:', error)
      }

      setIsInitialized(true)
    }

    initialize()
  }, [session?.user?.id, isInitialized, setThreads, setSelectedThread, isOpen])

  // Load threads periodically to update unread counts
  useEffect(() => {
    if (!isInitialized) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/chat/threads')
        if (res.ok) {
          const data = await res.json()
          setThreads(data.threads || [])
        }
      } catch (error) {
        console.error('Error refreshing threads:', error)
      }
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [isInitialized, setThreads])

  // Initialize sound system and request notification permission
  useEffect(() => {
    // Initialize chat sound system (sets default to enabled)
    initChatSound()
    
    // Request notification permission on page load (once)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Request permission after a short delay to avoid blocking page load
        setTimeout(() => {
          Notification.requestPermission().catch((err) => {
            console.error('Error requesting notification permission:', err)
          })
        }, 1000)
      }
    }
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen(!isOpen)
    
    // Auto-select appropriate thread when opening
    if (!isOpen) {
      const currentThread = threads.find((t) => t.id === useChatStore.getState().selectedThreadId)
      if (!currentThread) {
        const teamThread = threads.find((t) => t.type === 'TEAM')
        if (teamThread) {
          setSelectedThread(teamThread.id)
        }
      }
    }
  }, [isOpen, setIsOpen, threads, setSelectedThread])

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleToggle}
          size="lg"
          className="h-16 w-16 rounded-full shadow-2xl relative bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-7 w-7" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-7 min-w-7 flex items-center justify-center px-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </div>
      {isOpen && <ChatWidget />}
    </>
  )
}

