'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getUserSubscription() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return null
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
      return null
    }

    // Return serializable format
    return {
      id: user.subscription.id,
      status: user.subscription.status,
      currentPeriodStart: user.subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: user.subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
      SubscriptionPlan: {
        name: user.subscription.SubscriptionPlan.name,
        price: user.subscription.SubscriptionPlan.price,
        currency: user.subscription.SubscriptionPlan.currency,
        interval: user.subscription.SubscriptionPlan.interval,
      },
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

export async function checkSubscriptionStatus() {
  const subscription = await getUserSubscription()
  
  if (!subscription) {
    return {
      hasActiveSubscription: false,
      subscription: null,
    }
  }

  const now = new Date()
  const isActive = 
    subscription.status === 'ACTIVE' || 
    subscription.status === 'TRIALING'

  const isExpired = new Date(subscription.currentPeriodEnd) < now

  return {
    hasActiveSubscription: isActive && !isExpired,
    subscription,
    isExpired,
  }
}
