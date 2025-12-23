'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChatPanel } from './chat-panel'
import { playChatSound, getSoundEnabled } from '@/lib/chat-sound'

export function StickyChatButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const previousUnreadRef = useRef(0)
  const isOpenRef = useRef(isOpen)

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    // Fetch initial unread count
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/chat/unread')
        if (res.ok) {
          const data = await res.json()
          const count = data.totalUnread || 0
          setUnreadCount(count)
          previousUnreadRef.current = count
        }
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    }

    fetchUnread()

    // Set up SSE connection for real-time updates
    const eventSource = new EventSource('/api/chat/sse')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'unread_update') {
          const newCount = data.totalUnread || 0
          const oldCount = previousUnreadRef.current
          setUnreadCount(newCount)
          // Play sound if unread count increased and chat is closed
          if (newCount > oldCount && getSoundEnabled() && !isOpenRef.current) {
            playChatSound()
            // Show desktop notification if chat is closed
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Message', {
                body: 'You have a new message',
                icon: '/favicon.ico',
              })
            }
          }
          previousUnreadRef.current = newCount
        } else if (data.type === 'new_message' && !isOpenRef.current) {
          // Trigger notification for new message (unread count will be updated via unread_update)
          if (getSoundEnabled()) {
            playChatSound()
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Message', {
                body: data.message?.message || 'You have a new message',
                icon: '/favicon.ico',
              })
            }
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Reconnect after 3 seconds
      setTimeout(() => {
        fetchUnread()
      }, 3000)
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    // Refresh unread count when opening chat
    if (!isOpen) {
      fetch('/api/chat/unread')
        .then((res) => res.json())
        .then((data) => {
          const count = data.totalUnread || 0
          setUnreadCount(count)
          previousUnreadRef.current = count
        })
        .catch((error) => console.error('Error fetching unread count:', error))
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleToggle}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg relative"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
      {isOpen && <ChatPanel onClose={() => setIsOpen(false)} />}
    </>
  )
}

