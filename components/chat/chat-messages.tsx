'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Message {
  id: string
  message: string
  sender: { id: string; name: string; email: string; role: string }
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

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
            return [...prev, data.message]
          })
          scrollToBottom()
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error in ChatMessages:', error)
      // Connection will be re-established when component remounts
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [threadId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    if (!threadId) {
      console.warn('fetchMessages: threadId is missing')
      return
    }

    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        scrollToBottom()
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch messages:', res.status, errorData)
        if (res.status === 404) {
          console.error(`Thread ${threadId} not found. This might be a temporary issue.`)
          // If thread not found and it's a team thread, the parent component should handle recreating it
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    const messageText = message.trim()
    setMessage('')
    setIsLoading(true)

    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })

      if (res.ok) {
        const data = await res.json()
        // Add the new message to the list
        setMessages((prev) => {
          // Avoid duplicates
          const exists = prev.some((m) => m.id === data.message.id)
          if (exists) return prev
          return [...prev, data.message]
        })
        onMessageSent()
        scrollToBottom()
      } else {
        const error = await res.json()
        console.error('Failed to send message:', error)
        alert(error.error || 'Failed to send message')
        setMessage(messageText) // Restore message on error
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
      setMessage(messageText) // Restore message on error
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isOwnMessage = (senderId: string) => {
    return senderId === session?.user.id
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const own = isOwnMessage(msg.sender.id)
          return (
            <div
              key={msg.id}
              className={`flex ${own ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  own
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {!own && (
                  <p className="text-xs font-semibold mb-1">{msg.sender.name}</p>
                )}
                <p className="text-sm">{msg.message}</p>
                <p
                  className={`text-xs mt-1 ${
                    own ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
          />
          <Button type="submit" disabled={!message.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

