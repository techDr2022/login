'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MessageCircle, Send, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import {
  connectSocket,
  joinRoom,
  leaveRoom,
  markThreadAsReadAPI,
  sendMessage as sendSocketMessage,
  sendTyping,
} from '@/lib/socket/chatSocket'

function stringToColor(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return {
    bg: `hsl(${hue} 55% 20%)`,
    fg: `hsl(${hue} 75% 72%)`,
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TeamChatBotWidget() {
  const { data: session } = useSession()
  const {
    isOpen,
    setIsOpen,
    totalUnread,
    threads,
    selectedThreadId,
    setSelectedThread,
    setThreads,
    messages,
    addMessage,
    setMessages,
    typingUsers,
    onlineUsers,
  } = useChatStore()
  const [input, setInput] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  )
  const teamThread = useMemo(
    () => threads.find((thread) => thread.type === 'TEAM') || null,
    [threads]
  )
  const threadMessages = selectedThreadId ? messages[selectedThreadId] || [] : []
  const typingCount = selectedThreadId ? typingUsers[selectedThreadId]?.size || 0 : 0
  const onlineCount = useMemo(() => {
    const participants = new Set<string>()
    if (session?.user?.id) participants.add(session.user.id)
    if (selectedThread?.participants?.length) {
      selectedThread.participants.forEach((participant) => participants.add(participant.id))
    }
    if (participants.size === 0) return onlineUsers.size
    let count = 0
    participants.forEach((userId) => {
      if (onlineUsers.has(userId)) count += 1
    })
    return count
  }, [onlineUsers, selectedThread?.participants, session?.user?.id])
  const userNameById = useMemo(() => {
    const map = new Map<string, string>()

    if (session?.user?.id) {
      map.set(session.user.id, session.user.name || 'You')
    }

    if (selectedThread?.participants?.length) {
      selectedThread.participants.forEach((participant) => {
        map.set(participant.id, participant.name)
      })
    }

    threadMessages.forEach((message) => {
      if (message.sender?.id && message.sender?.name) {
        map.set(message.sender.id, message.sender.name)
      }
    })

    return map
  }, [selectedThread?.participants, session?.user?.id, session?.user?.name, threadMessages])

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/threads')
      if (!res.ok) return
      const data = await res.json()
      const threadsList = data.threads || []
      setThreads(threadsList)

      const team = threadsList.find((thread: any) => thread.type === 'TEAM')
      if (team && !selectedThreadId) {
        setSelectedThread(team.id)
      }
    } catch (error) {
      console.error('Failed to load chat threads:', error)
    }
  }, [selectedThreadId, setSelectedThread, setThreads])

  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages?limit=50`)
      if (!res.ok) return
      const data = await res.json()
      const transformed = (data.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId,
        senderId: msg.senderId || msg.User?.id,
        sender: msg.sender || msg.User,
        content: msg.message || msg.content,
        createdAt: msg.createdAt,
        seenBy: msg.seenBy || [],
      }))
      setMessages(threadId, transformed)
    } catch (error) {
      console.error('Failed to load chat messages:', error)
    }
  }, [setMessages])

  useEffect(() => {
    if (!session?.user?.id || isInitialized) return

    connectSocket(session.user.id)
    setIsInitialized(true)
    loadThreads()
  }, [isInitialized, loadThreads, session?.user?.id])

  useEffect(() => {
    if (!isInitialized) return
    const interval = setInterval(() => {
      loadThreads()
    }, 10000)
    return () => clearInterval(interval)
  }, [isInitialized, loadThreads])

  useEffect(() => {
    if (!teamThread) return
    if (!selectedThreadId) {
      setSelectedThread(teamThread.id)
    }
  }, [selectedThreadId, setSelectedThread, teamThread])

  useEffect(() => {
    if (!selectedThreadId) return
    loadMessages(selectedThreadId)
  }, [loadMessages, selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId || !isOpen) return
    joinRoom(selectedThreadId)
    markThreadAsReadAPI(selectedThreadId)
    return () => {
      leaveRoom(selectedThreadId)
    }
  }, [isOpen, selectedThreadId])

  useEffect(() => {
    if (isOpen && selectedThreadId) {
      markThreadAsReadAPI(selectedThreadId)
    }
  }, [isOpen, selectedThreadId, threadMessages.length])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [isOpen, threadMessages.length, typingCount])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!widgetRef.current) return
      const target = event.target as Node
      if (!widgetRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, setIsOpen])

  const handleTyping = useCallback(() => {
    if (!selectedThreadId) return
    sendTyping(selectedThreadId, true)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(selectedThreadId, false)
      typingTimeoutRef.current = null
    }, 3000)
  }, [selectedThreadId])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !selectedThreadId || !session?.user) return

    const tempId = `temp-${Date.now()}-${Math.random()}`
    const now = new Date().toISOString()

    addMessage(selectedThreadId, {
      id: tempId,
      threadId: selectedThreadId,
      senderId: session.user.id,
      sender: {
        id: session.user.id,
        name: session.user.name || 'You',
        email: session.user.email || '',
        role: session.user.role || '',
      },
      content: text,
      createdAt: now,
      seenBy: [],
    })

    setInput('')
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    sendTyping(selectedThreadId, false)

    try {
      const sentOverSocket = sendSocketMessage(selectedThreadId, text)
      if (!sentOverSocket) {
        const res = await fetch(`/api/chat/threads/${selectedThreadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
        if (!res.ok) throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send chat message:', error)
      const current = messages[selectedThreadId] || []
      setMessages(
        selectedThreadId,
        current.filter((message) => message.id !== tempId)
      )
      setInput(text)
    }
  }

  return (
    <div ref={widgetRef} className="fixed bottom-7 right-7 z-50 font-sans">
      <div
        className={`absolute bottom-[68px] right-0 w-[360px] max-h-[520px] overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl transition-all duration-200 ${
          isOpen ? 'pointer-events-auto opacity-100 scale-100 translate-y-0' : 'pointer-events-none opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-100">
            <MessageCircle className="h-4 w-4 text-[#4f6ef7]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-800">Team Chat</h2>
            <p className="text-xs text-slate-500">{onlineCount} members online</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 text-[11px] font-medium text-green-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {onlineCount} online
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setIsOpen(false)}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-blue-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-blue-100 bg-white px-3.5 py-2.5">
          <label htmlFor="self-select" className="whitespace-nowrap text-[11px] text-slate-500">
            You are:
          </label>
          <select
            id="self-select"
            value={session?.user.id || 'self'}
            disabled
            className="flex-1 cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:border-[#4f6ef7]"
          >
            <option value={session?.user.id || 'self'}>{session?.user.name || 'You'}</option>
          </select>
        </div>

        <div ref={messagesContainerRef} className="flex max-h-[300px] min-h-[220px] flex-col gap-3 overflow-y-auto px-3.5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-px flex-1 bg-blue-100" />
            Today
            <span className="h-px flex-1 bg-blue-100" />
          </div>

          {threadMessages.map((message) => {
            const isOwn = message.senderId === session?.user?.id
            const name = message.sender?.name || (isOwn ? session?.user?.name || 'You' : 'Teammate')
            const initials = getInitials(name)
            const palette = stringToColor(name)
            const isOnline = onlineUsers.has(message.senderId)
            const seenByOthers = (message.seenBy || []).filter(
              (userId) => userId !== session?.user?.id
            )
            const seenByNames = seenByOthers
              .map((userId) => userNameById.get(userId))
              .filter((userName): userName is string => Boolean(userName))
            const time = new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: palette.bg, color: palette.fg }}
                >
                  {initials}
                  <span
                    className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                  />
                </div>

                <div className="max-w-[78%]">
                  <div
                    className={`mb-1 flex items-center gap-1.5 text-[10px] text-gray-500 ${
                      isOwn ? 'justify-end' : ''
                    }`}
                  >
                    {!isOwn && (
                      <>
                        <span className="font-medium text-slate-600">{name}</span>
                        <span
                          className={`font-medium ${isOnline ? 'text-green-600' : 'text-slate-400'}`}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </>
                    )}
                    <span>{time}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-[13.5px] leading-5 ${
                      isOwn
                        ? 'rounded-br-md bg-[#4f6ef7] text-white'
                        : 'rounded-bl-md bg-slate-100 text-slate-800'
                    }`}
                  >
                    {message.content}
                  </div>
                  {isOwn && seenByNames.length > 0 && (
                    <div className="mt-1 text-right text-[10px] text-slate-500">
                      Seen by {seenByNames.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {typingCount > 0 && (
          <div className="flex items-center gap-2 px-3.5 pb-2">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />
            </div>
            <span className="text-[11px] text-slate-500">
              Someone is typing...
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-blue-100 bg-white px-3 py-2.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Message the team..."
            rows={1}
            className="max-h-20 flex-1 resize-none rounded-xl border border-blue-200 bg-slate-50 px-3 py-2 text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#4f6ef7]"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#4f6ef7] transition hover:bg-[#3a57e8] disabled:cursor-not-allowed disabled:bg-[#2d3347]"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label={isOpen ? 'Close team chat' : 'Open team chat'}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_4px_24px_rgba(79,110,247,0.45)] transition hover:scale-105 hover:from-blue-700 hover:to-indigo-700"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-semibold text-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  )
}
