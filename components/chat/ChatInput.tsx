'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/store/chatStore'
import { sendMessage, sendTyping } from '@/lib/socket/chatSocket'

let typingTimeout: NodeJS.Timeout | null = null
const TYPING_DEBOUNCE_MS = 3000

export function ChatInput() {
  const { data: session } = useSession()
  const { selectedThreadId } = useChatStore()
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [message])

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!selectedThreadId) return

    // Send typing event
    sendTyping(selectedThreadId, true)

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }

    // Set timeout to stop typing
    typingTimeout = setTimeout(() => {
      sendTyping(selectedThreadId, false)
      typingTimeout = null
    }, TYPING_DEBOUNCE_MS)
  }, [selectedThreadId])

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout)
        sendTyping(selectedThreadId || '', false)
      }
    }
  }, [selectedThreadId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedThreadId || !session?.user) return

    const messageText = message.trim()
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const now = new Date().toISOString()

    // Create optimistic message immediately
    const optimisticMessage = {
      id: tempId,
      threadId: selectedThreadId,
      senderId: session.user.id,
      sender: {
        id: session.user.id,
        name: session.user.name || 'You',
        email: session.user.email || '',
        role: session.user.role || '',
      },
      content: messageText,
      createdAt: now,
      seenBy: [],
    }

    // Add optimistic message to store IMMEDIATELY (before network call)
    useChatStore.getState().addMessage(selectedThreadId, optimisticMessage as any)

    // Clear input immediately for instant feedback
    setMessage('')
    // Don't use loading state - message appears instantly

    // Stop typing indicator
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
    sendTyping(selectedThreadId, false)

    // Send via Socket.IO (non-blocking)
    try {
      const success = sendMessage(selectedThreadId, messageText)

      if (!success) {
        // Fallback to HTTP if Socket.IO fails
        const res = await fetch(`/api/chat/threads/${selectedThreadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        })

        if (!res.ok) {
          throw new Error('Failed to send message')
        }

        const data = await res.json()
        // Replace optimistic message with real one
        const store = useChatStore.getState()
        const currentMessages = store.messages[selectedThreadId] || []
        const updatedMessages = currentMessages
          .filter((m) => m.id !== tempId)
          .concat({
            id: data.message.id,
            threadId: selectedThreadId,
            senderId: data.message.senderId || session.user.id,
            sender: data.message.sender || optimisticMessage.sender,
            content: data.message.message || data.message.content,
            createdAt: data.message.createdAt,
            seenBy: [],
          })
        store.setMessages(selectedThreadId, updatedMessages)
      }
      // If Socket.IO succeeds, the real message will come via receive-message event
      // and the optimistic one will be filtered out automatically
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      const store = useChatStore.getState()
      const currentMessages = store.messages[selectedThreadId] || []
      store.setMessages(selectedThreadId, currentMessages.filter((m) => m.id !== tempId))
      setMessage(messageText) // Restore message on error
      alert('Failed to send message. Please try again.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    if (e.target.value.trim()) {
      handleTyping()
    }
  }

  if (!selectedThreadId) {
    return (
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4">
        <div className="text-sm text-gray-500 text-center">
          Select a conversation to start messaging
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4">
      <form onSubmit={handleSend} className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[52px] max-h-32 resize-none pr-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
            rows={1}
          />
        </div>
        <Button
          type="submit"
          disabled={!message.trim()}
          size="icon"
          className="h-[52px] w-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  )
}

