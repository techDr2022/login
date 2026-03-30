import { io, Socket } from 'socket.io-client'
import { useChatStore } from '@/store/chatStore'
import { Message } from '@/store/chatStore'
import { playChatSound } from '@/lib/chat-sound'

let socket: Socket | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
// Track processed message IDs to avoid playing sound for duplicate/replayed messages
// Use sessionStorage to persist across page refreshes
const STORAGE_KEY = 'chat_processed_message_ids'
const READ_THREADS_KEY = 'chat_read_thread_ids'
const STORAGE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

function getProcessedMessageIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      const now = Date.now()
      
      // Clean up old entries (older than 24 hours)
      const validIds = data.ids.filter((entry: { id: string; timestamp: number }) => 
        now - entry.timestamp < STORAGE_MAX_AGE
      )
      
      // Update storage with cleaned data
      if (validIds.length !== data.ids.length) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: validIds }))
      }
      
      return new Set(validIds.map((entry: { id: string }) => entry.id))
    }
  } catch (error) {
    console.error('Error reading processed message IDs from storage:', error)
  }
  
  return new Set()
}

function addProcessedMessageId(id: string) {
  if (typeof window === 'undefined') return
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const now = Date.now()
    let data: { ids: Array<{ id: string; timestamp: number }> } = { ids: [] }
    
    if (stored) {
      try {
        data = JSON.parse(stored)
        // Clean up old entries
        data.ids = data.ids.filter(entry => now - entry.timestamp < STORAGE_MAX_AGE)
      } catch (e) {
        // Invalid data, start fresh
        data = { ids: [] }
      }
    }
    
    // Add new ID if not already present
    if (!data.ids.some(entry => entry.id === id)) {
      data.ids.push({ id, timestamp: now })
      
      // Limit to last 1000 messages to prevent storage bloat
      if (data.ids.length > 1000) {
        data.ids = data.ids.slice(-1000)
      }
      
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (error) {
    console.error('Error storing processed message ID:', error)
  }
}

const processedMessageIds = getProcessedMessageIds()
// Track when messages were received to prevent sounds for old messages when switching tabs
const messageReceivedTimes = new Map<string, number>()

// Track read threads in sessionStorage
function getReadThreadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  
  try {
    const stored = sessionStorage.getItem(READ_THREADS_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      const now = Date.now()
      
      // Clean up old entries (older than 24 hours)
      const validIds = data.threadIds.filter((entry: { id: string; timestamp: number }) => 
        now - entry.timestamp < STORAGE_MAX_AGE
      )
      
      // Update storage with cleaned data
      if (validIds.length !== data.threadIds.length) {
        sessionStorage.setItem(READ_THREADS_KEY, JSON.stringify({ threadIds: validIds }))
      }
      
      return new Set(validIds.map((entry: { id: string }) => entry.id))
    }
  } catch (error) {
    console.error('Error reading read thread IDs from storage:', error)
  }
  
  return new Set()
}

function addReadThreadId(threadId: string) {
  if (typeof window === 'undefined') return
  
  try {
    const stored = sessionStorage.getItem(READ_THREADS_KEY)
    const now = Date.now()
    let data: { threadIds: Array<{ id: string; timestamp: number }> } = { threadIds: [] }
    
    if (stored) {
      try {
        data = JSON.parse(stored)
        // Clean up old entries
        data.threadIds = data.threadIds.filter(entry => now - entry.timestamp < STORAGE_MAX_AGE)
      } catch (e) {
        // Invalid data, start fresh
        data = { threadIds: [] }
      }
    }
    
    // Add new thread ID if not already present
    if (!data.threadIds.some(entry => entry.id === threadId)) {
      data.threadIds.push({ id: threadId, timestamp: now })
      sessionStorage.setItem(READ_THREADS_KEY, JSON.stringify(data))
    }
  } catch (error) {
    console.error('Error storing read thread ID:', error)
  }
}

const readThreadIds = getReadThreadIds()

// Export function to mark messages as processed (used when loading messages from database)
export function markMessagesAsProcessed(messageIds: string[]) {
  messageIds.forEach(id => {
    addProcessedMessageId(id)
    processedMessageIds.add(id)
  })
}

// Export function to mark thread as read (used when thread is marked as read)
export function markThreadAsRead(threadId: string) {
  addReadThreadId(threadId)
  readThreadIds.add(threadId)
}

// Helper function to mark thread as read via API and sessionStorage
export async function markThreadAsReadAPI(threadId: string) {
  // Mark in sessionStorage immediately
  markThreadAsRead(threadId)
  
  // Also mark via API
  try {
    await fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    })
  } catch (err) {
    console.error('Error marking thread as read:', err)
  }
}

interface SocketMessage {
  id: string
  threadId: string
  senderId: string
  sender?: {
    id: string
    name: string
    email: string
    role: string
  }
  content: string
  createdAt: string
  seenBy?: string[]
}

export function connectSocket(userId: string, token?: string) {
  if (socket?.connected) {
    return socket
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect()
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || ''

  socket = io(socketUrl, {
    path: '/api/socket/io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      userId,
      token,
    },
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id)
    reconnectAttempts = 0
    useChatStore.getState().setIsConnected(true)
    
    // When reconnecting, mark all existing messages as processed
    // This prevents old messages from triggering sounds on reconnect or tab switch
    const store = useChatStore.getState()
    const now = Date.now()
    Object.values(store.messages).flat().forEach(msg => {
      addProcessedMessageId(msg.id)
      // Mark message receive time as old to prevent sounds
      messageReceivedTimes.set(msg.id, now - 60000) // Set to 1 minute ago
    })
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
    useChatStore.getState().setIsConnected(false)
    
    if (reason === 'io server disconnect') {
      // Server disconnected the socket, don't reconnect automatically
      socket?.connect()
    }
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
    reconnectAttempts++
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached')
    }
  })

  // Receive new message
  socket.on('receive-message', (data: SocketMessage) => {
    // Skip if we've already processed this message (prevents replay on reconnect/refresh)
    if (processedMessageIds.has(data.id)) {
      return
    }
    
    // Mark as processed (persists across page refreshes)
    addProcessedMessageId(data.id)
    processedMessageIds.add(data.id)

    const message: Message = {
      id: data.id,
      threadId: data.threadId,
      senderId: data.senderId,
      sender: data.sender,
      content: data.content,
      createdAt: data.createdAt,
      seenBy: data.seenBy || [],
    }

    const store = useChatStore.getState()
    const isOpen = store.isOpen
    const selectedThreadId = store.selectedThreadId
    const isOwnMessage = data.senderId === userId

    // Check if message already exists in store (might have been loaded from DB)
    const existingMessages = store.messages[data.threadId] || []
    const isExistingMessage = existingMessages.some(m => m.id === data.id)
    
    // Check if thread is marked as read (unread count = 0)
    // Check both the store and sessionStorage (which persists across refreshes)
    const thread = store.threads.find(t => t.id === data.threadId)
    const isThreadReadInStore = thread?.unreadCount === 0
    const isThreadReadInStorage = readThreadIds.has(data.threadId)
    const isThreadRead = isThreadReadInStore || isThreadReadInStorage

    // If this is our own message, it might be replacing an optimistic one
    // The addMessage function will handle replacing temp messages automatically
    store.addMessage(data.threadId, message)

    // Mark as seen if viewing the thread
    if (isOpen && selectedThreadId === data.threadId && !isOwnMessage) {
      markMessageAsSeen(data.threadId, message.id)
      // Mark thread as read (both in API and sessionStorage)
      markThreadAsRead(data.threadId)
      fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: data.threadId }),
      }).catch((err) => console.error('Error marking as read:', err))
    }

    // Only play sound and show notification for NEW messages from another user (not existing/replayed messages)
    // Also skip if thread is already marked as read (prevents sounds for already-read messages on refresh)
    if (!isOwnMessage && !isExistingMessage) {
      // If thread is marked as read (unreadCount = 0), don't play sounds
      if (isThreadRead) {
        return // Don't play sound for messages in read threads
      }
      
      const messageTimestamp = new Date(data.createdAt).getTime()
      const now = Date.now()
      const messageAge = now - messageTimestamp
      
      // Only process messages that are less than 5 minutes old (prevents replay on tab switch/refresh)
      // This ensures we only notify about truly new messages, not old ones when switching tabs or refreshing
      const isRecentMessage = messageAge < 5 * 60 * 1000 // 5 minutes
      
      // Play sound and show notification if:
      // 1. Chat is closed OR message is in a different thread
      // 2. Message is recent (not old)
      // 3. Tab is currently visible (don't play sound if tab was hidden and just became visible)
      const isTabVisible = typeof document !== 'undefined' && !document.hidden
      const shouldNotify = (!isOpen || selectedThreadId !== data.threadId) && isRecentMessage && isTabVisible
      
      // Track when message was received
      messageReceivedTimes.set(data.id, now)
      
      if (shouldNotify) {
        // Play sound (will check if enabled internally)
        try {
          playChatSound()
        } catch (error) {
          console.error('Error playing chat sound:', error)
        }
        
        // Show browser notification (always show, even if tab is hidden)
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              new Notification('New Message', {
                body: `${data.sender?.name || 'Someone'}: ${data.content.substring(0, 100)}`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `chat-${data.threadId}-${data.id}`, // Prevent duplicate notifications
                requireInteraction: false,
              })
            } catch (error) {
              console.error('Error showing notification:', error)
            }
          } else if (Notification.permission === 'default') {
            // Request permission if not yet asked
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                new Notification('New Message', {
                  body: `${data.sender?.name || 'Someone'}: ${data.content.substring(0, 100)}`,
                  icon: '/favicon.ico',
                  badge: '/favicon.ico',
                })
              }
            })
          }
        }
      } else if (!isTabVisible) {
        // If tab is not visible, still show notification but don't play sound
        // This way user knows there's a message when they come back
        if ('Notification' in window && Notification.permission === 'granted' && isRecentMessage) {
          try {
            new Notification('New Message', {
              body: `${data.sender?.name || 'Someone'}: ${data.content.substring(0, 100)}`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `chat-${data.threadId}-${data.id}`,
              requireInteraction: false,
            })
          } catch (error) {
            console.error('Error showing notification:', error)
          }
        }
      }
    }
  })

  // Receive unread count update
  socket.on('unread-update', (data: { threadId: string; count: number }) => {
    useChatStore.getState().updateUnreadCount(data.threadId, data.count)
  })

  // Typing indicator
  socket.on('typing', (data: { threadId: string; userId: string; userName: string }) => {
    if (data.userId !== userId) {
      useChatStore.getState().setTyping(data.threadId, data.userId, true)
      
      // Clear typing after 3 seconds
      setTimeout(() => {
        useChatStore.getState().setTyping(data.threadId, data.userId, false)
      }, 3000)
    }
  })

  socket.on('stop-typing', (data: { threadId: string; userId: string }) => {
    if (data.userId !== userId) {
      useChatStore.getState().setTyping(data.threadId, data.userId, false)
    }
  })

  // Online users
  socket.on('user-online', (data: { userId: string }) => {
    useChatStore.getState().setUserOnline(data.userId)
  })

  socket.on('user-offline', (data: { userId: string }) => {
    useChatStore.getState().setUserOffline(data.userId)
  })

  socket.on('online-users', (data: { userIds: string[] }) => {
    useChatStore.getState().setOnlineUsers(data.userIds)
  })

  // Message seen
  socket.on('message-seen', (data: { messageId: string; threadId: string; userId: string }) => {
    const store = useChatStore.getState()
    const messages = store.messages[data.threadId] || []
    const updatedMessages = messages.map((msg) => {
      if (msg.id === data.messageId) {
        return {
          ...msg,
          seenBy: [...(msg.seenBy || []), data.userId],
        }
      }
      return msg
    })
    store.setMessages(data.threadId, updatedMessages)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    useChatStore.getState().setIsConnected(false)
  }
}

export function sendMessage(threadId: string, content: string) {
  if (!socket?.connected) {
    console.error('Socket not connected')
    return false
  }

  // Emit immediately - socket.emit is already non-blocking
  socket.emit('send-message', { threadId, content })
  return true
}

export function joinRoom(threadId: string) {
  if (!socket?.connected) {
    console.error('Socket not connected')
    return false
  }

  socket.emit('join-room', { threadId })
  return true
}

export function leaveRoom(threadId: string) {
  if (!socket?.connected) {
    return false
  }

  socket.emit('leave-room', { threadId })
  return true
}

export function sendTyping(threadId: string, isTyping: boolean) {
  if (!socket?.connected) {
    return false
  }

  if (isTyping) {
    socket.emit('typing', { threadId })
  } else {
    socket.emit('stop-typing', { threadId })
  }
  return true
}

export function markMessageAsSeen(threadId: string, messageId: string) {
  if (!socket?.connected) {
    return false
  }

  socket.emit('message-seen', { threadId, messageId })
  return true
}

export function getSocket(): Socket | null {
  return socket
}

export function isSocketConnected(): boolean {
  return socket?.connected || false
}

