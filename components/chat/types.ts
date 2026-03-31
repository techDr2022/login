// Realtime team chat types (room-based)

export type RoomType = 'TEAM' | 'DIRECT'

export interface RoomSummary {
  id: string
  type: RoomType
  unreadCount: number
  lastMessage: {
    id: string
    text: string
    sender: { id: string; name: string; email: string }
    createdAt: string
  } | null
  participants: Array<{ id: string; name: string; email: string; role: string }>
}

export type ReceiptStatus = 'SENT' | 'DELIVERED' | 'READ'

export interface MessageReceiptView {
  userId: string
  status: ReceiptStatus
}

export interface RoomMessage {
  id: string
  roomId: string
  senderId: string
  text: string
  clientMsgId: string | null
  createdAt: string
  sender: { id: string; name: string; email: string; role: string }
  receipts?: MessageReceiptView[]
  /** Client-only: pending send or failed */
  status?: 'sending' | 'failed'
}
