'use client'

import { useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useChatStore } from '@/store/chatStore'
import { connectSocket, disconnectSocket, joinRoom, leaveRoom } from '@/lib/socket/chatSocket'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ChatThreadList } from './chat-thread-list'
import { cn } from '@/lib/utils'

export function ChatWidget() {
  const { data: session } = useSession()
  const { isOpen, selectedThreadId, setIsOpen, activeTab, threads, setSelectedThread } = useChatStore()

  // Connect socket on mount
  useEffect(() => {
    if (!session?.user?.id) return

    const socket = connectSocket(session.user.id)
    
    return () => {
      disconnectSocket()
    }
  }, [session?.user?.id])

  // Join/leave room when thread changes
  useEffect(() => {
    if (!selectedThreadId || !isOpen) {
      return
    }

    joinRoom(selectedThreadId)

    return () => {
      leaveRoom(selectedThreadId)
    }
  }, [selectedThreadId, isOpen])

  if (!isOpen) {
    return null
  }

  const directThreads = threads.filter((t) => t.type === 'DIRECT')
  const showThreadList = activeTab === 'direct' && !selectedThreadId && directThreads.length > 0

  return (
    <div
      className={cn(
        'fixed bottom-24 right-6 z-50',
        'w-[420px]',
        'bg-white border border-gray-200 rounded-2xl shadow-2xl',
        'flex flex-col overflow-hidden',
        'backdrop-blur-sm',
        'transform transition-all duration-300 ease-out',
        'animate-in slide-in-from-bottom-4 fade-in'
      )}
      style={{
        height: 'calc(100vh - 140px)',
        maxHeight: 'calc(100vh - 140px)',
        minHeight: '500px',
      }}
    >
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>
      {showThreadList ? (
        <>
          <div className="flex-1 overflow-y-auto bg-gray-50/50 min-h-0">
            <ChatThreadList
              threads={directThreads}
              selectedThreadId={selectedThreadId}
              onSelectThread={(threadId) => {
                setSelectedThread(threadId)
              }}
            />
          </div>
          <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4 flex-shrink-0">
            <div className="text-sm text-gray-500 text-center">
              Select a conversation to start messaging
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0">
            <MessageList />
          </div>
          <div className="flex-shrink-0">
            <ChatInput />
          </div>
        </>
      )}
    </div>
  )
}

