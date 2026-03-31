import { prisma } from '@/lib/prisma'
import { ChatRoomType, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'

export type RoomAccess = { allowed: true; room: Awaited<ReturnType<typeof prisma.chatRoom.findUnique>> } | { allowed: false; error: string }

/**
 * Check if user can access a room. TEAM: all employees. DIRECT: only Manager/SuperAdmin -> Employee; members only.
 */
export async function checkRoomAccess(roomId: string, userId: string, userRole: UserRole): Promise<RoomAccess> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { include: { user: { select: { id: true, role: true } } } },
    },
  })
  if (!room) return { allowed: false, error: 'Room not found' }

  const isMember = room.members.some((m) => m.userId === userId)
  if (room.type === ChatRoomType.TEAM) {
    if (isMember) return { allowed: true, room }
    // Auto-add to TEAM room if not member (all employees can join)
    await prisma.chatMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { id: randomUUID(), roomId, userId },
      update: {},
    })
    const updated = await prisma.chatRoom.findUnique({ where: { id: roomId } })
    return { allowed: true, room: updated ?? room }
  }

  // DIRECT: must be member; only Manager/SuperAdmin can be in DIRECT with Employee
  if (!isMember) return { allowed: false, error: 'Not a member of this room' }
  const hasManager = room.members.some(
    (m) => m.user.role === UserRole.MANAGER || m.user.role === UserRole.SUPER_ADMIN
  )
  if (!hasManager) return { allowed: false, error: 'Access denied' }
  return { allowed: true, room }
}

/**
 * Get or create the global TEAM room and ensure current user is a member.
 */
export async function getOrCreateTeamRoom(userId: string): Promise<{ id: string }> {
  let room = await prisma.chatRoom.findFirst({
    where: { type: ChatRoomType.TEAM },
    select: { id: true },
  })
  if (!room) {
    room = await prisma.chatRoom.create({
      data: { id: randomUUID(), type: ChatRoomType.TEAM },
      select: { id: true },
    })
  }
  await prisma.chatMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { id: randomUUID(), roomId: room.id, userId },
    update: {},
  })
  return { id: room.id }
}

/**
 * DIRECT room: only Manager or SuperAdmin can create; target must be Employee (or any non-manager).
 * Returns existing DIRECT room if one exists between the two users.
 */
export async function getOrCreateDirectRoom(
  creatorId: string,
  creatorRole: UserRole,
  targetUserId: string
): Promise<{ roomId: string } | { error: string }> {
  if (creatorRole !== UserRole.MANAGER && creatorRole !== UserRole.SUPER_ADMIN) {
    return { error: 'Only managers can start direct conversations' }
  }
  if (creatorId === targetUserId) return { error: 'Cannot message yourself' }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, isActive: true },
  })
  if (!target || !target.isActive) return { error: 'User not found' }
  // Employees cannot DM other employees; Manager can DM any employee (or manager for SuperAdmin)
  if (creatorRole === UserRole.MANAGER && target.role !== UserRole.EMPLOYEE) {
    return { error: 'Managers can only message employees' }
  }

  const directRooms = await prisma.chatRoom.findMany({
    where: {
      type: ChatRoomType.DIRECT,
      members: {
        some: { userId: creatorId },
      },
    },
    include: { members: { select: { userId: true } } },
  })
  const existingDirect = directRooms.find((r) => r.members.some((m) => m.userId === targetUserId))
  if (existingDirect) return { roomId: existingDirect.id }

  const room = await prisma.chatRoom.create({
    data: {
      id: randomUUID(),
      type: ChatRoomType.DIRECT,
      members: {
        create: [
          { id: randomUUID(), userId: creatorId },
          { id: randomUUID(), userId: targetUserId },
        ],
      },
    },
    select: { id: true },
  })
  return { roomId: room.id }
}

/**
 * Get list of room IDs the user has access to (for SSE).
 */
export async function getAccessibleRoomIds(userId: string): Promise<string[]> {
  await getOrCreateTeamRoom(userId)
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    select: { roomId: true, room: { select: { type: true }, include: { members: { include: { user: { select: { role: true } } } } } } },
  })
  const ids: string[] = []
  for (const m of memberships) {
    if (m.room.type === ChatRoomType.TEAM) {
      ids.push(m.roomId)
    } else {
      const hasManager = m.room.members.some(
        (u) => u.user.role === UserRole.MANAGER || u.user.role === UserRole.SUPER_ADMIN
      )
      if (hasManager) ids.push(m.roomId)
    }
  }
  return ids
}
