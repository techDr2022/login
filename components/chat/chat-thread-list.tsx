'use client'

import { Badge } from '@/components/ui/badge'

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
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="divide-y">
      {threads.map((thread) => {
        const otherUser = thread.participants[0]
        const displayName = otherUser?.name || 'Unknown'
        const lastMessage = thread.lastMessage

        return (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
              selectedThreadId === thread.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{displayName}</p>
                  {thread.unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                    </Badge>
                  )}
                </div>
                {lastMessage && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {lastMessage.sender.name}: {lastMessage.message}
                  </p>
                )}
              </div>
              {lastMessage && (
                <span className="text-xs text-gray-400 ml-2">
                  {formatTime(lastMessage.createdAt)}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

