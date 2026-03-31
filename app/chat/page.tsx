export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ChatPageContent } from '@/components/chat/chat-page-content'

export default async function ChatPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <LayoutWrapper>
      <ChatPageContent />
    </LayoutWrapper>
  )
}

