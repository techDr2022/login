import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import LandingPage from '@/components/landing/landing-page'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  
  // If authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }
  
  // Show landing page for unauthenticated users
  return <LandingPage />
}
