'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    senderId: string
    sender?: {
      id: string
      name: string
      email: string
      role: string
    }
    createdAt: string
    seenBy?: string[]
  }
  isOwn: boolean
  showAvatar: boolean
  showName: boolean
  prevMessageSameSender?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  return format(date, 'h:mm a')
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showName,
  prevMessageSameSender,
}: MessageBubbleProps) {
  const sender = message.sender
  if (!sender) return null

  return (
    <div
      className={cn(
        'flex gap-3 items-end group',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        !prevMessageSameSender && 'mt-4'
      )}
    >
      {/* Avatar */}
      {showAvatar ? (
        <Avatar className="h-8 w-8 border-2 border-white shadow-sm flex-shrink-0">
          <AvatarImage
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sender.name)}`}
          />
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
            {getInitials(sender.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message Bubble */}
      <div className={cn('flex flex-col max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        {showName && !isOwn && (
          <span className="text-xs font-semibold text-gray-700 mb-1 px-1">
            {sender.name}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 shadow-sm transition-all',
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <p
              className={cn(
                'text-xs',
                isOwn ? 'text-blue-100' : 'text-gray-500'
              )}
            >
              {formatTime(message.createdAt)}
            </p>
            {isOwn && message.seenBy && message.seenBy.length > 0 && (
              <span className="text-xs text-blue-100" title="Seen">
                ✓✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

