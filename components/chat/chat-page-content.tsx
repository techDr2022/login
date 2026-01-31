'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { X, Plus, Settings, MessageSquare, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { RoomList } from './room-list'
import { RoomMessages } from './room-messages'
import { NewMessageDialog } from './new-message-dialog'
import { ChatSettings } from './chat-settings'
import type { RoomSummary, RoomMessage } from './types'
import { playChatSound, initChatSound } from '@/lib/chat-sound'

export function ChatPageContent() {
  const router = useRouter()
  const { data: session } = useSession()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'team' | 'direct'>('team')
  const [isLoading, setIsLoading] = useState(true)

  const userRole = session?.user.role as UserRole
  const isManagerOrSuperAdmin = userRole === UserRole.MANAGER || userRole === UserRole.SUPER_ADMIN

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/chat/rooms')
      if (res.ok) {
        const data = await res.json()
        const list: RoomSummary[] = data.rooms ?? []
        setRooms(list)
        if (!selectedRoomId && list.length > 0) {
          const team = list.find((r: RoomSummary) => r.type === 'TEAM')
          if (team) {
            setSelectedRoomId(team.id)
            setActiveTab('team')
          } else {
            setSelectedRoomId(list[0].id)
            setActiveTab(list[0].type === 'DIRECT' ? 'direct' : 'team')
          }
        }
      }
    } catch (e) {
      console.error('Fetch rooms error:', e)
    } finally {
      setIsLoading(false)
    }
  }, [selectedRoomId])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  useEffect(() => {
    initChatSound()
  }, [])

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      setSelectedRoomId(roomId)
      const room = rooms.find((r) => r.id === roomId)
      if (room) setActiveTab(room.type === 'TEAM' ? 'team' : 'direct')
      fetch('/api/chat/read-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      }).catch((err) => console.error('Mark read error:', err))
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
      )
    },
    [rooms]
  )

  const handleNewMessageNotif = useCallback((roomId: string, _message: RoomMessage) => {
    const isViewingThisRoom = selectedRoomId === roomId
    const windowFocused = typeof document !== 'undefined' && document.hasFocus()
    if (windowFocused && isViewingThisRoom) return
    playChatSound()
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, unreadCount: r.unreadCount + 1 } : r
      )
    )
  }, [selectedRoomId])

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  )

  const teamRoom = useMemo(() => rooms.find((r) => r.type === 'TEAM') ?? null, [rooms])
  const directRooms = useMemo(() => rooms.filter((r) => r.type === 'DIRECT'), [rooms])
  const totalUnreadDirect = useMemo(
    () => directRooms.reduce((s, r) => s + r.unreadCount, 0),
    [directRooms]
  )
  const teamUnread = teamRoom?.unreadCount ?? 0

  return (
    <div className="h-[calc(100vh-12rem)] bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team Chat</h2>
            <p className="text-xs text-gray-500">Realtime • Rooms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManagerOrSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewMessageOpen(true)}
              title="New message"
              className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            className="hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const newTab = v as 'team' | 'direct'
          setActiveTab(newTab)
          if (newTab === 'team' && teamRoom) setSelectedRoomId(teamRoom.id)
        }}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="w-full rounded-none border-b border-gray-200 bg-white/50 backdrop-blur-sm h-14 px-4">
          <TabsTrigger
            value="team"
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all"
          >
            <Users className="h-4 w-4" />
            <span>Team</span>
            {teamUnread > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold"
              >
                {teamUnread > 99 ? '99+' : teamUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="direct"
            className="flex-1 gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-medium transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Direct Messages</span>
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

        <TabsContent value="team" className="flex-1 flex flex-col m-0 p-0 min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                <p className="text-sm text-gray-500">Loading team chat...</p>
              </div>
            </div>
          ) : teamRoom ? (
            <div className="flex flex-1 min-h-0">
              <div className="w-72 border-r border-gray-200 flex flex-col bg-white/50 overflow-hidden">
                <RoomList
                  rooms={[teamRoom]}
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={handleSelectRoom}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                {selectedRoomId === teamRoom.id ? (
                  <RoomMessages
                    room={teamRoom}
                    onMessageSent={fetchRooms}
                    onMarkRead={() =>
                      setRooms((prev) =>
                        prev.map((r) =>
                          r.id === teamRoom.id ? { ...r, unreadCount: 0 } : r
                        )
                      )
                    }
                    onNewMessageNotif={handleNewMessageNotif}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p className="text-sm">Select Team to view messages</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center space-y-3">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="text-sm">No team room available</p>
                <Button variant="outline" size="sm" onClick={fetchRooms}>
                  Retry
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 flex flex-col m-0 p-0 min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                <p className="text-sm text-gray-500">Loading messages...</p>
              </div>
            </div>
          ) : directRooms.length > 0 ? (
            <div className="flex flex-1 min-h-0">
              <div className="w-72 border-r border-gray-200 flex flex-col bg-white/50 overflow-hidden">
                <RoomList
                  rooms={directRooms}
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={handleSelectRoom}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                {selectedRoom && directRooms.some((r) => r.id === selectedRoomId) ? (
                  <RoomMessages
                    room={selectedRoom}
                    onMessageSent={fetchRooms}
                    onMarkRead={() =>
                      selectedRoomId &&
                      setRooms((prev) =>
                        prev.map((r) =>
                          r.id === selectedRoomId ? { ...r, unreadCount: 0 } : r
                        )
                      )
                    }
                    onNewMessageNotif={handleNewMessageNotif}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <div className="flex items-center justify-center h-full p-4">
                      <p className="text-sm text-gray-500">Select a conversation</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <MessageSquare className="h-16 w-16 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-500">No direct messages yet</p>
                {isManagerOrSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewMessageOpen(true)}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start a conversation
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {isNewMessageOpen && (
        <NewMessageDialog
          open={isNewMessageOpen}
          onClose={() => setIsNewMessageOpen(false)}
          onThreadCreated={(roomId) => {
            setIsNewMessageOpen(false)
            fetchRooms()
            setSelectedRoomId(roomId)
            setActiveTab('direct')
          }}
        />
      )}
      {isSettingsOpen && (
        <ChatSettings open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  )
}
