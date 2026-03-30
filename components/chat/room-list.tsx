'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { RoomSummary } from './types'

function formatTime(dateString: string) {
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface RoomListProps {
  rooms: RoomSummary[]
  selectedRoomId: string | null
  onSelectRoom: (roomId: string) => void
}

export function RoomList({ rooms, selectedRoomId, onSelectRoom }: RoomListProps) {
  const sorted = useMemo(() => {
    return [...rooms].sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1
      const aTime = a.lastMessage?.createdAt ?? ''
      const bTime = b.lastMessage?.createdAt ?? ''
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [rooms])

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-gray-500">No conversations</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {sorted.map((room) => {
        const other = room.participants[0]
        const displayName =
          room.type === 'TEAM' ? 'Team' : other?.name ?? 'Unknown'
        const lastMsg = room.lastMessage
        const isSelected = selectedRoomId === room.id
        const hasUnread = room.unreadCount > 0

        return (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelectRoom(room.id)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-all duration-200 ${
              isSelected
                ? 'bg-blue-50 border-l-4 border-blue-600'
                : hasUnread
                  ? 'bg-white'
                  : 'bg-gray-50/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm flex-shrink-0">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p
                    className={`font-semibold text-sm truncate ${
                      hasUnread ? 'text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {displayName}
                  </p>
                  {lastMsg && (
                    <span
                      className={`text-xs flex-shrink-0 ${
                        hasUnread ? 'text-gray-600 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {formatTime(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm truncate flex-1 ${
                        hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}
                    >
                      <span className="text-gray-400">{lastMsg.sender.name}:</span>{' '}
                      {lastMsg.text}
                    </p>
                  </div>
                )}
              </div>
              {hasUnread && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
                >
                  {room.unreadCount > 99 ? '99+' : room.unreadCount}
                </Badge>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
