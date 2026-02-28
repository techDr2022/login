'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Send, Loader2, Paperclip, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RoomMessageBubble } from './room-message-bubble'
import type { RoomMessage, RoomSummary } from './types'

interface RoomMessagesProps {
  room: RoomSummary
  onMessageSent: () => void
  onMarkRead: () => void
  onNewMessageNotif?: (roomId: string, message: RoomMessage) => void
}

export function RoomMessages({ room, onMessageSent, onMarkRead, onNewMessageNotif }: RoomMessagesProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const processedIdsRef = useRef<Set<string>>(new Set())

  const currentUserId = session?.user?.id ?? ''

  const fetchMessages = useCallback(async () => {
    if (!room.id) return
    try {
      setIsFetching(true)
      const res = await fetch(`/api/chat/rooms/${room.id}/messages?limit=50`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const list: RoomMessage[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        roomId: m.roomId,
        senderId: m.senderId,
        text: m.text,
        clientMsgId: m.clientMsgId ?? null,
        createdAt: m.createdAt,
        sender: m.sender,
        receipts: m.receipts ?? [],
      }))
      setMessages(list)
      list.forEach((m) => processedIdsRef.current.add(m.id))
      onMarkRead()
    } catch (e) {
      console.error('Fetch messages error:', e)
    } finally {
      setIsFetching(false)
    }
  }, [room.id, onMarkRead])

  useEffect(() => {
    if (!room.id) return
    fetchMessages()
  }, [room.id, fetchMessages])

  useEffect(() => {
    if (!room.id || !session?.user?.id) return
    const url = `/api/chat/stream?roomId=${encodeURIComponent(room.id)}`
    const es = new EventSource(url)
    eventSourceRef.current = es
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message' && data.message?.roomId === room.id) {
          const msg = data.message as RoomMessage
          if (processedIdsRef.current.has(msg.id)) return
          processedIdsRef.current.add(msg.id)
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.senderId !== currentUserId && typeof onNewMessageNotif === 'function') {
            onNewMessageNotif(room.id, msg)
          }
        }
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }
    es.onerror = () => {}
    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [room.id, currentUserId, onNewMessageNotif])

  const sendMessage = useCallback(
    async (text: string, clientMsgId: string, existingTempId?: string) => {
      if (!room.id || !session?.user?.id) return
      const trimmed = text.trim()
      if (!trimmed) return

      const optimistic: RoomMessage = {
        id: existingTempId ?? `temp-${clientMsgId}`,
        roomId: room.id,
        senderId: currentUserId,
        text: trimmed,
        clientMsgId,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUserId,
          name: session.user.name ?? '',
          email: session.user.email ?? '',
          role: session.user.role ?? '',
        },
        receipts: [],
        status: 'sending',
      }

      setMessages((prev) => {
        const without = existingTempId ? prev.filter((m) => m.id !== existingTempId) : prev
        return [...without, optimistic]
      })

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id, text: trimmed, clientMsgId }),
        })
        const data = await res.json()
        if (res.ok && data.message) {
          const serverMsg: RoomMessage = {
            id: data.message.id,
            roomId: data.message.roomId,
            senderId: data.message.senderId,
            text: data.message.text,
            clientMsgId: data.message.clientMsgId ?? null,
            createdAt: data.message.createdAt,
            sender: data.message.sender,
            receipts: data.message.receipts ?? [],
          }
          processedIdsRef.current.add(serverMsg.id)
          setMessages((prev) =>
            prev.map((m) => (m.clientMsgId === clientMsgId ? serverMsg : m))
          )
          onMessageSent()
          return
        }
        throw new Error(data.error ?? 'Send failed')
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId ? { ...m, status: 'failed' as const } : m
          )
        )
      }
    },
    [room.id, currentUserId, session, onMessageSent]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setInput('')
    setIsLoading(true)
    sendMessage(trimmed, clientMsgId).finally(() => setIsLoading(false))
  }

  const handleResend = (msg: RoomMessage) => {
    if (!msg.clientMsgId || msg.status !== 'failed') return
    const tempId = msg.id
    const clientMsgId = msg.clientMsgId
    setMessages((prev) => prev.filter((m) => m.id !== tempId))
    sendMessage(msg.text, clientMsgId, tempId)
  }

  const grouped = useMemo(() => {
    const groups: { date: string; messages: RoomMessage[] }[] = []
    let currentDate = ''
    const fmt = (d: string) => {
      const dt = new Date(d)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (dt.toDateString() === today.toDateString()) return 'Today'
      if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday'
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    messages.forEach((msg) => {
      const d = fmt(msg.createdAt)
      if (d !== currentDate) {
        currentDate = d
        groups.push({ date: d, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    })
    return groups
  }, [messages])

  const flatItems = useMemo(() => {
    const items: Array<{ type: 'date'; date: string } | { type: 'msg'; message: RoomMessage; groupIndex: number; msgIndex: number }> = []
    grouped.forEach((g, gi) => {
      items.push({ type: 'date', date: g.date })
      g.messages.forEach((m, mi) => {
        items.push({ type: 'msg', message: m, groupIndex: gi, msgIndex: mi })
      })
    })
    return items
  }, [grouped])

  const isOwn = (senderId: string) => senderId === currentUserId

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
      <div className="flex-1 min-h-0 flex flex-col">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={flatItems}
          followOutput="smooth"
          itemContent={(index, item) => {
            if (item.type === 'date') {
              return (
                <div className="flex justify-center my-4">
                  <div className="px-3 py-1 bg-gray-100 rounded-full">
                    <span className="text-xs font-medium text-gray-600">{item.date}</span>
                  </div>
                </div>
              )
            }
            const { message: msg, groupIndex, msgIndex } = item
            const group = grouped[groupIndex]
            const prevMsg = msgIndex > 0 ? group.messages[msgIndex - 1] : null
            const sameSender = prevMsg && prevMsg.senderId === msg.senderId
            const showAvatar = !sameSender
            const showName = !isOwn(msg.senderId) && showAvatar
            return (
              <div className="px-4 py-0.5">
                {msg.status === 'failed' && (
                  <div className="flex justify-end mb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleResend(msg)}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Resend
                    </Button>
                  </div>
                )}
                <RoomMessageBubble
                  message={msg}
                  isOwn={isOwn(msg.senderId)}
                  showAvatar={showAvatar}
                  showName={showName}
                />
              </div>
            )
          }}
        />
      </div>

      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm p-4 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative flex flex-col gap-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[52px] max-h-32 resize-none pr-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
            />
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              Attachments (placeholder)
            </span>
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[52px] w-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0"
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
