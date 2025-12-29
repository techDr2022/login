'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { X, Plus, Settings, MessageSquare, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChatStore } from '@/store/chatStore'
import { NewMessageDialog } from './new-message-dialog'
import { ChatSettings } from './chat-settings'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

export function ChatHeader() {
  const { data: session } = useSession()
  const {
    activeTab,
    setActiveTab,
    threads,
    setIsOpen,
    setSelectedThread,
    selectedThreadId,
  } = useChatStore()
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const userRole = session?.user.role as UserRole
  const isManagerOrSuperAdmin = userRole === UserRole.SUPER_ADMIN

  const teamThread = threads.find((t) => t.type === 'TEAM')
  const directThreads = threads.filter((t) => t.type === 'DIRECT')
  const totalUnreadDirect = directThreads.reduce((sum, t) => sum + t.unreadCount, 0)
  const selectedDirectThread = directThreads.find((t) => t.id === selectedThreadId)

  const handleTabChange = (tab: 'team' | 'direct') => {
    setActiveTab(tab)
    if (tab === 'team' && teamThread) {
      setSelectedThread(teamThread.id)
    } else if (tab === 'direct' && directThreads.length > 0) {
      // If switching to direct and no thread selected, select first one
      const currentSelected = threads.find((t) => t.id === useChatStore.getState().selectedThreadId)
      if (!currentSelected || currentSelected.type !== 'DIRECT') {
        setSelectedThread(directThreads[0].id)
      }
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {activeTab === 'direct' && selectedDirectThread && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedThread(null)}
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {activeTab === 'team'
                ? 'Team Chat'
                : selectedDirectThread
                  ? selectedDirectThread.participants[0]?.name || 'Direct Chat'
                  : 'Direct Chat'}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {activeTab === 'team' ? 'Quick messages' : selectedDirectThread?.participants[0]?.email || 'Select a conversation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isManagerOrSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewMessageOpen(true)}
              title="New message"
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="h-8 w-8 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 hover:bg-gray-100 transition-colors"
            title="Minimize"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as 'team' | 'direct')}
        className="border-b border-gray-200"
      >
        <TabsList className="w-full rounded-none h-12 px-3 bg-white/50 backdrop-blur-sm">
          <TabsTrigger
            value="team"
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all text-sm"
          >
            <Users className="h-4 w-4" />
            <span>Team</span>
            {teamThread && teamThread.unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
              >
                {teamThread.unreadCount > 99 ? '99+' : teamThread.unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="direct"
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Direct</span>
            {totalUnreadDirect > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
              >
                {totalUnreadDirect > 99 ? '99+' : totalUnreadDirect}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isNewMessageOpen && (
        <NewMessageDialog
          open={isNewMessageOpen}
          onClose={() => setIsNewMessageOpen(false)}
          onThreadCreated={(threadId) => {
            setIsNewMessageOpen(false)
            setSelectedThread(threadId)
            setActiveTab('direct')
          }}
        />
      )}
      {isSettingsOpen && (
        <ChatSettings
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </>
  )
}

