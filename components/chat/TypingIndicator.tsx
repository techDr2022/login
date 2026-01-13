'use client'

import { memo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TypingIndicatorProps {
  userIds: string[]
  userNames?: Record<string, string>
}

export const TypingIndicator = memo(function TypingIndicator({
  userIds,
  userNames = {},
}: TypingIndicatorProps) {
  if (userIds.length === 0) return null

  const names = userIds.map((id) => userNames[id] || 'Someone').join(', ')
  const displayText = userIds.length === 1 ? `${names} is typing...` : `${names} are typing...`

  return (
    <div className="flex gap-3 items-center px-4 py-2">
      <Avatar className="h-8 w-8 border-2 border-white shadow-sm flex-shrink-0">
        <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-semibold">
          ...
        </AvatarFallback>
      </Avatar>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-gray-500 ml-2">{displayText}</span>
        </div>
      </div>
    </div>
  )
})

