import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PricingPage from '@/components/landing/pricing-page'

export const dynamic = 'force-dynamic'

export default async function Pricing() {
  const session = await getServerSession(authOptions)
  
  // If authenticated, they can still view pricing but might want to manage subscription
  return <PricingPage session={session} />
}
