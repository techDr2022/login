'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { markMessagesAsProcessed } from '@/lib/socket/chatSocket'

interface Message {
  id: string
  message: string
  sender?: { id: string; name: string; email: string; role: string }
  User?: { id: string; name: string; email: string; role: string }
  createdAt: string
}

interface ChatMessagesProps {
  threadId: string
  threadType: 'TEAM' | 'DIRECT'
  onMessageSent: () => void
}

export function ChatMessages({
  threadId,
  threadType,
  onMessageSent,
}: ChatMessagesProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      })
    }, 100)
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!threadId) {
      console.warn('fetchMessages: threadId is missing')
      return
    }

    try {
      setIsFetching(true)
      const res = await fetch(`/api/chat/threads/${threadId}/messages`)
      if (res.ok) {
        const data = await res.json()
        // Transform messages to ensure sender field exists (map User to sender)
        const transformedMessages = (data.messages || []).map((msg: any) => ({
          ...msg,
          sender: msg.sender || msg.User || null,
        })).filter((msg: any) => msg.sender !== null) // Filter out messages without sender
        setMessages(transformedMessages)
        
        // Mark loaded messages as processed to prevent sound on reconnect/refresh
        // These are existing messages from database, not new ones
        const messageIds = transformedMessages.map((msg: any) => msg.id)
        markMessagesAsProcessed(messageIds)
        
        scrollToBottom(false)
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch messages:', res.status, errorData)
        if (res.status === 404) {
          console.error(`Thread ${threadId} not found. This might be a temporary issue.`)
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsFetching(false)
    }
  }, [threadId, scrollToBottom])

  useEffect(() => {
    // Only fetch messages if threadId is valid
    if (!threadId) {
      console.warn('ChatMessages: threadId is missing')
      return
    }

    fetchMessages()

    // Set up SSE for real-time updates
    const eventSource = new EventSource('/api/chat/sse')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message' && data.message.threadId === threadId) {
          setMessages((prev) => {
            // Avoid duplicate messages
            const exists = prev.some((m) => m.id === data.message.id)
            if (exists) return prev
            // Transform message to ensure sender field exists
            const transformedMessage = {
              ...data.message,
              sender: data.message.sender || data.message.User || null,
            }
            // Only add if sender exists
            if (!transformedMessage.sender) {
              console.warn('Received message without sender:', data.message)
              return prev
            }
            return [...prev, transformedMessage]
          })
          scrollToBottom()
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error in ChatMessages:', error)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [threadId, fetchMessages, scrollToBottom])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    const messageText = message.trim()
    const tempId = `temp-${Date.now()}`
    
    // Optimistic update
    const optimisticMessage: Message = {
      id: tempId,
      message: messageText,
      sender: {
        id: session?.user.id || '',
        name: session?.user.name || '',
        email: session?.user.email || '',
        role: session?.user.role || '',
      },
      createdAt: new Date().toISOString(),
    }
    
    setMessages((prev) => [...prev, optimisticMessage])
    setMessage('')
    setIsLoading(true)
    scrollToBottom()

    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })

      if (res.ok) {
        const data = await res.json()
        // Replace optimistic message with real one
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempId)
          const exists = filtered.some((m) => m.id === data.message.id)
          if (exists) return filtered
          const transformedMessage = {
            ...data.message,
            sender: data.message.sender || data.message.User || null,
          }
          if (!transformedMessage.sender) {
            console.warn('Received message without sender:', data.message)
            return filtered
          }
          return [...filtered, transformedMessage]
        })
        onMessageSent()
        scrollToBottom()
      } else {
        const error = await res.json()
        console.error('Failed to send message:', error)
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setMessage(messageText) // Restore message on error
        alert(error.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMessage(messageText) // Restore message on error
      alert('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }, [])

  const isOwnMessage = useCallback((senderId: string) => {
    return senderId === session?.user.id
  }, [session?.user.id])

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [])

  const groupedMessages = useMemo(() => {
    const grouped: Array<{ date: string; messages: Message[] }> = []
    let currentDate = ''
    
    messages.forEach((msg) => {
      const msgDate = formatDate(msg.createdAt)
      if (msgDate !== currentDate) {
        currentDate = msgDate
        grouped.push({ date: currentDate, messages: [msg] })
      } else {
        grouped[grouped.length - 1].messages.push(msg)
      }
    })
    
    return grouped
  }, [messages, formatDate])

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-gray-50/50">
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm font-medium text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation!</p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 bg-gray-100 rounded-full">
                  <span className="text-xs font-medium text-gray-600">{group.date}</span>
                </div>
              </div>
              
              {/* Messages */}
              {group.messages.map((msg, msgIdx) => {
                const sender = msg.sender || msg.User
                if (!sender) {
                  console.warn('Message without sender:', msg)
                  return null
                }
                
                const own = isOwnMessage(sender.id)
                const showAvatar = !own && (msgIdx === 0 || group.messages[msgIdx - 1].sender?.id !== sender.id)
                const showName = !own && showAvatar
                
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${own ? 'flex-row-reverse' : 'flex-row'} items-end group`}
                  >
                    {/* Avatar */}
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sender.name)}`} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                          {getInitials(sender.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8" /> // Spacer for alignment
                    )}
                    
                    {/* Message Bubble */}
                    <div className={`flex flex-col max-w-[75%] ${own ? 'items-end' : 'items-start'}`}>
                      {showName && (
                        <span className="text-xs font-semibold text-gray-700 mb-1 px-1">
                          {sender.name}
                        </span>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                          own
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                        <p
                          className={`text-xs mt-1.5 ${
                            own ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[52px] max-h-32 resize-none pr-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              rows={1}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {message.length > 0 && `${message.length} chars`}
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={!message.trim() || isLoading}
            size="icon"
            className="h-[52px] w-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

