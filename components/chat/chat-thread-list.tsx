'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Thread {
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

interface ChatThreadListProps {
  threads: Thread[]
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
}

export function ChatThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
}: ChatThreadListProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      // Sort by unread count first (unread on top)
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1
      
      // Then by last message time
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      }
      if (a.lastMessage) return -1
      if (b.lastMessage) return 1
      return 0
    })
  }, [threads])

  if (sortedThreads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm font-medium text-gray-500">No conversations</p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {sortedThreads.map((thread) => {
        const otherUser = thread.participants[0]
        const displayName = otherUser?.name || 'Unknown'
        const lastMessage = thread.lastMessage
        const isSelected = selectedThreadId === thread.id
        const hasUnread = thread.unreadCount > 0

        return (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-all duration-200 ${
              isSelected 
                ? 'bg-blue-50 border-l-4 border-blue-600' 
                : hasUnread 
                  ? 'bg-white' 
                  : 'bg-gray-50/30'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm flex-shrink-0">
                <AvatarImage 
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`} 
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className={`font-semibold text-sm truncate ${
                    hasUnread ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {displayName}
                  </p>
                  {lastMessage && (
                    <span className={`text-xs flex-shrink-0 ${
                      hasUnread ? 'text-gray-600 font-medium' : 'text-gray-400'
                    }`}>
                      {formatTime(lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                
                {lastMessage && (
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate flex-1 ${
                      hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
                    }`}>
                      <span className="text-gray-400">
                        {lastMessage.sender.name}:
                      </span>{' '}
                      {lastMessage.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Unread Badge */}
              {hasUnread && (
                <div className="flex-shrink-0">
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold shadow-sm"
                  >
                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                  </Badge>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

