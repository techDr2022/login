'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { Check, CheckCheck, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { RoomMessage, ReceiptStatus } from './types'

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

function DeliveryIndicator({
  isOwn,
  status,
  receipts,
}: {
  isOwn: boolean
  status?: 'sending' | 'failed'
  receipts?: { userId: string; status: ReceiptStatus }[]
}) {
  if (!isOwn) return null
  if (status === 'failed') {
    return (
      <span className="text-red-400" title="Failed to send">
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    )
  }
  if (status === 'sending') {
    return (
      <span className="text-blue-200" title="Sending">
        <Check className="h-3.5 w-3.5" />
      </span>
    )
  }
  const hasRead = receipts?.some((r) => r.status === 'READ')
  const hasDelivered = receipts?.some((r) => r.status === 'DELIVERED' || r.status === 'READ')
  if (hasRead) {
    return (
      <span className="text-blue-100" title="Read">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    )
  }
  if (hasDelivered) {
    return (
      <span className="text-blue-100" title="Delivered">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    )
  }
  return (
    <span className="text-blue-200" title="Sent">
      <Check className="h-3.5 w-3.5" />
    </span>
  )
}

interface RoomMessageBubbleProps {
  message: RoomMessage
  isOwn: boolean
  showAvatar: boolean
  showName: boolean
}

export const RoomMessageBubble = memo(function RoomMessageBubble({
  message,
  isOwn,
  showAvatar,
  showName,
}: RoomMessageBubbleProps) {
  const sender = message.sender
  if (!sender) return null

  return (
    <div
      className={cn(
        'flex gap-3 items-end group',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        'py-0.5'
      )}
    >
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
      <div className={cn('flex flex-col max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        {showName && !isOwn && (
          <span className="text-xs font-semibold text-gray-700 mb-0.5 px-1">{sender.name}</span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 shadow-sm transition-all',
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={cn(
                'text-xs',
                isOwn ? 'text-blue-100' : 'text-gray-500'
              )}
            >
              {formatTime(message.createdAt)}
            </span>
            <DeliveryIndicator
              isOwn={isOwn}
              status={message.status}
              receipts={message.receipts}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
