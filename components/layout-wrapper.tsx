'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { TopBar } from './topbar'
import { StickyChatButton } from './chat/StickyChatButton'
import { initChatSound } from '@/lib/chat-sound'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initChatSound()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-[var(--sidebar-width,256px)] transition-all duration-300">
        <TopBar />
        <main className="p-6 space-y-6">
          {children}
        </main>
      </div>
      <StickyChatButton />
    </div>
  )
}

