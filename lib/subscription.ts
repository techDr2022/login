import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'

export async function requireSubscription() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return {
      hasSubscription: false,
      error: 'Unauthorized',
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      subscription: {
        include: {
          SubscriptionPlan: true,
        },
      },
    },
  })

  if (!user?.subscription) {
    return {
      hasSubscription: false,
      error: 'No subscription found',
    }
  }

  const now = new Date()
  const isActive = 
    user.subscription.status === 'ACTIVE' || 
    user.subscription.status === 'TRIALING'
  const isExpired = user.subscription.currentPeriodEnd < now

  if (!isActive || isExpired) {
    return {
      hasSubscription: false,
      error: 'Subscription expired or inactive',
      subscription: user.subscription,
    }
  }

  return {
    hasSubscription: true,
    subscription: user.subscription,
  }
}
