import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Message {
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

export interface Thread {
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

interface ChatState {
  // Threads
  threads: Thread[]
  selectedThreadId: string | null
  activeTab: 'team' | 'direct'
  
  // Messages by thread ID
  messages: Record<string, Message[]>
  
  // Typing indicators by thread ID
  typingUsers: Record<string, Set<string>>
  
  // Online users
  onlineUsers: Set<string>
  
  // Unread counts
  unreadCounts: Record<string, number>
  totalUnread: number
  
  // UI state
  isOpen: boolean
  isConnected: boolean
  
  // Actions
  setThreads: (threads: Thread[]) => void
  setSelectedThread: (threadId: string | null) => void
  setActiveTab: (tab: 'team' | 'direct') => void
  addMessage: (threadId: string, message: Message) => void
  setMessages: (threadId: string, messages: Message[]) => void
  addMessages: (threadId: string, messages: Message[]) => void
  updateThreadLastMessage: (threadId: string, message: Message) => void
  setTyping: (threadId: string, userId: string, isTyping: boolean) => void
  setOnlineUsers: (userIds: string[]) => void
  setUserOnline: (userId: string) => void
  setUserOffline: (userId: string) => void
  updateUnreadCount: (threadId: string, count: number) => void
  markThreadAsRead: (threadId: string) => void
  setIsOpen: (isOpen: boolean) => void
  setIsConnected: (connected: boolean) => void
  clearMessages: (threadId: string) => void
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      threads: [],
      selectedThreadId: null,
      activeTab: 'team',
      messages: {},
      typingUsers: {},
      onlineUsers: new Set(),
      unreadCounts: {},
      totalUnread: 0,
      isOpen: false,
      isConnected: false,

      // Actions
      setThreads: (threads) => {
        const unreadCounts: Record<string, number> = {}
        let totalUnread = 0
        
        threads.forEach((thread) => {
          unreadCounts[thread.id] = thread.unreadCount
          totalUnread += thread.unreadCount
        })
        
        set({ threads, unreadCounts, totalUnread })
        
        // Mark read threads (unreadCount = 0) in sessionStorage to prevent sounds on refresh
        // This handles the case where threads are loaded and some are already read
        if (typeof window !== 'undefined') {
          const { markThreadAsRead } = require('@/lib/socket/chatSocket')
          threads.forEach((thread) => {
            if (thread.unreadCount === 0) {
              // Mark thread as read in sessionStorage
              markThreadAsRead(thread.id)
            }
          })
        }
      },

      setSelectedThread: (threadId) => {
        set({ selectedThreadId: threadId })
        // Mark as read when selecting
        if (threadId) {
          const thread = get().threads.find((t) => t.id === threadId)
          if (thread && thread.unreadCount > 0) {
            get().markThreadAsRead(threadId)
          }
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      addMessage: (threadId, message) => {
        const currentMessages = get().messages[threadId] || []
        
        // Remove any existing message with same ID (for replacing optimistic messages)
        const filteredMessages = currentMessages.filter((m) => m.id !== message.id)
        
        // Remove temporary messages that might be duplicates
        const isTempMessage = message.id.startsWith('temp-')
        if (isTempMessage) {
          // Check if we already have a non-temp message with same content from same sender
          const hasRealMessage = filteredMessages.some(
            (m) =>
              !m.id.startsWith('temp-') &&
              m.content === message.content &&
              m.senderId === message.senderId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
          )
          if (hasRealMessage) {
            return // Don't add duplicate temp message
          }
        } else {
          // Remove any temp messages that match this real message
          const tempMessagesToRemove = filteredMessages.filter(
            (m) =>
              m.id.startsWith('temp-') &&
              m.content === message.content &&
              m.senderId === message.senderId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
          )
          tempMessagesToRemove.forEach((tempMsg) => {
            const index = filteredMessages.findIndex((m) => m.id === tempMsg.id)
            if (index !== -1) filteredMessages.splice(index, 1)
          })
        }
        
        // Check if message already exists (non-temp)
        if (!message.id.startsWith('temp-') && filteredMessages.some((m) => m.id === message.id)) {
          return
        }
        
        const newMessages = [...filteredMessages, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: newMessages,
          },
        }))
        
        // Update thread last message
        get().updateThreadLastMessage(threadId, message)
        
        // If this is not the selected thread and message is from another user, increment unread
        // We'll handle unread count updates from the server/socket events
        // Don't increment here to avoid race conditions
      },

      setMessages: (threadId, messages) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: messages.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ),
          },
        }))
      },

      addMessages: (threadId, messages) => {
        const currentMessages = get().messages[threadId] || []
        const existingIds = new Set(currentMessages.map((m) => m.id))
        const newMessages = messages.filter((m) => !existingIds.has(m.id))
        
        if (newMessages.length === 0) return
        
        const allMessages = [...currentMessages, ...newMessages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: allMessages,
          },
        }))
      },

      updateThreadLastMessage: (threadId, message) => {
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  lastMessage: {
                    id: message.id,
                    message: message.content,
                    sender: message.sender || {
                      id: message.senderId,
                      name: 'Unknown',
                      email: '',
                    },
                    createdAt: message.createdAt,
                  },
                }
              : thread
          ),
        }))
      },

      setTyping: (threadId, userId, isTyping) => {
        set((state) => {
          const typingUsers = { ...state.typingUsers }
          if (!typingUsers[threadId]) {
            typingUsers[threadId] = new Set()
          }
          const threadTyping = new Set(typingUsers[threadId])
          
          if (isTyping) {
            threadTyping.add(userId)
          } else {
            threadTyping.delete(userId)
          }
          
          return {
            typingUsers: {
              ...typingUsers,
              [threadId]: threadTyping,
            },
          }
        })
      },

      setOnlineUsers: (userIds) => {
        set({ onlineUsers: new Set(userIds) })
      },

      setUserOnline: (userId) => {
        set((state) => {
          const onlineUsers = new Set(state.onlineUsers)
          onlineUsers.add(userId)
          return { onlineUsers }
        })
      },

      setUserOffline: (userId) => {
        set((state) => {
          const onlineUsers = new Set(state.onlineUsers)
          onlineUsers.delete(userId)
          return { onlineUsers }
        })
      },

      updateUnreadCount: (threadId, count) => {
        set((state) => {
          const unreadCounts = { ...state.unreadCounts }
          const oldCount = unreadCounts[threadId] || 0
          unreadCounts[threadId] = count
          
          const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0)
          
          // Update thread unread count
          const threads = state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, unreadCount: count } : thread
          )
          
          return { unreadCounts, totalUnread, threads }
        })
      },

      markThreadAsRead: (threadId) => {
        get().updateUnreadCount(threadId, 0)
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
          ),
        }))
        
        // Also mark in sessionStorage to persist across page refreshes
        if (typeof window !== 'undefined') {
          const { markThreadAsRead: markThreadAsReadStorage } = require('@/lib/socket/chatSocket')
          markThreadAsReadStorage(threadId)
        }
      },

      setIsOpen: (isOpen) => set({ isOpen }),

      setIsConnected: (isConnected) => set({ isConnected }),

      clearMessages: (threadId) => {
        set((state) => {
          const messages = { ...state.messages }
          delete messages[threadId]
          return { messages }
        })
      },
    }),
    { name: 'ChatStore' }
  )
)

