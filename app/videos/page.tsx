export const dynamic = 'force-dynamic'
export const revalidate = 60

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { UserRole } from '@prisma/client'
import { VideosDashboard } from '@/components/videos/videos-dashboard'

export default async function VideosPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect('/dashboard')
  }

  return (
    <LayoutWrapper>
      <VideosDashboard />
    </LayoutWrapper>
  )
}
