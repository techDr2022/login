'use client'

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { useChatStore, Message } from '@/store/chatStore'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { Loader2 } from 'lucide-react'
import { markMessagesAsProcessed } from '@/lib/socket/chatSocket'

interface GroupedMessage {
  date: string
  messages: Message[]
}

export function MessageList() {
  const { data: session } = useSession()
  const { selectedThreadId, messages, typingUsers, threads } = useChatStore()
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const thread = threads.find((t) => t.id === selectedThreadId)
  const threadMessages = selectedThreadId ? messages[selectedThreadId] || [] : []
  const typingUserIds = selectedThreadId
    ? Array.from(typingUsers[selectedThreadId] || [])
    : []

  // Group messages by date and sender
  const groupedMessages = useMemo((): Array<GroupedMessage | Message> => {
    const groups: GroupedMessage[] = []
    let currentDate = ''
    let currentGroup: Message[] = []

    threadMessages.forEach((msg, index) => {
      const msgDate = format(new Date(msg.createdAt), 'MMM d, yyyy')
      const prevMsg = index > 0 ? threadMessages[index - 1] : null
      const sameDay = msgDate === currentDate
      const sameSender = prevMsg?.senderId === msg.senderId
      const timeDiff = prevMsg
        ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
        : Infinity
      const isGrouped = sameDay && sameSender && timeDiff < 5 * 60 * 1000 // 5 minutes

      if (!sameDay) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup })
        }
        currentDate = msgDate
        currentGroup = [msg]
      } else if (isGrouped) {
        currentGroup.push(msg)
      } else {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup })
        }
        currentGroup = [msg]
      }
    })

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup })
    }

    // Flatten for virtualization
    const flattened: Array<GroupedMessage | Message> = []
    groups.forEach((group) => {
      flattened.push(group) // Date header
      group.messages.forEach((msg) => flattened.push(msg))
    })

    return flattened
  }, [threadMessages])

  // Check if user is at bottom
  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const threshold = 100 // pixels from bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    wasAtBottomRef.current = isAtBottom
  }, [])

  // Auto-scroll to bottom on new messages if user was at bottom
  useEffect(() => {
    if (wasAtBottomRef.current && containerRef.current) {
      // Use requestAnimationFrame for immediate scroll
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [threadMessages.length])

  // Load initial messages
  useEffect(() => {
    if (!selectedThreadId) return

    const loadMessages = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/chat/threads/${selectedThreadId}/messages?limit=50`)
        if (res.ok) {
          const data = await res.json()
          const transformedMessages: Message[] = (data.messages || [])
            .reverse()
            .map((msg: any) => ({
              id: msg.id,
              threadId: selectedThreadId,
              senderId: msg.senderId || msg.User?.id,
              sender: msg.sender || msg.User,
              content: msg.message || msg.content,
              createdAt: msg.createdAt,
              seenBy: msg.seenBy || [],
            }))
          
          useChatStore.getState().setMessages(selectedThreadId, transformedMessages)
          
          // Mark loaded messages as processed to prevent sound on reconnect/refresh
          // These are existing messages from database, not new ones
          const messageIds = transformedMessages.map(msg => msg.id)
          markMessagesAsProcessed(messageIds)
          wasAtBottomRef.current = true

          // Mark thread as read (both API and sessionStorage)
          const { markThreadAsReadAPI } = await import('@/lib/socket/chatSocket')
          markThreadAsReadAPI(selectedThreadId)
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [selectedThreadId])


  if (!selectedThreadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-sm font-medium">Select a conversation</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (threadMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-sm font-medium">No messages yet</p>
          <p className="text-xs text-gray-400">Start the conversation!</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50/50"
      onScroll={checkScrollPosition}
    >
      <div className="px-4 py-6 space-y-4">
        {groupedMessages.map((item, index) => {
          if ('date' in item && 'messages' in item) {
            // Date separator
            return (
              <div key={`date-${item.date}`} className="flex items-center justify-center my-4">
                <div className="px-3 py-1 bg-gray-100 rounded-full">
                  <span className="text-xs font-medium text-gray-600">{item.date}</span>
                </div>
              </div>
            )
          }

          // Message
          const message = item as Message
          const prevItem = index > 0 ? groupedMessages[index - 1] : null
          const prevMessage =
            prevItem && !('date' in prevItem) ? (prevItem as Message) : null

          const isOwn = message.senderId === session?.user.id
          const sameSender = prevMessage?.senderId === message.senderId
          const showAvatar = !isOwn && !sameSender
          const showName = !isOwn && showAvatar

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              showName={showName}
              prevMessageSameSender={sameSender}
            />
          )
        })}
        {typingUserIds.length > 0 && (
          <TypingIndicator userIds={typingUserIds} userNames={{}} />
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>
    </div>
  )
}

