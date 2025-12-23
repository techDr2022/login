export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  
  // If not authenticated, middleware will redirect to /login
  // If authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }
  
  // This should not be reached due to middleware, but just in case
  redirect('/login')
}

