import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  })
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  const stripe = getStripe()
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  const { prisma } = await import('@/lib/prisma')

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId

        if (!userId) {
          console.error('No userId in session metadata')
          break
        }

        // Retrieve the subscription
        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0].price.id

        // Find or create the plan
        let plan = await prisma.subscriptionPlan.findUnique({
          where: { stripePriceId: priceId },
        })

        if (!plan) {
          // Create plan if it doesn't exist
          const price = await stripe.prices.retrieve(priceId)
          plan = await prisma.subscriptionPlan.create({
            data: {
              name: price.nickname || 'Unknown Plan',
              price: (price.unit_amount || 0) / 100,
              currency: price.currency.toUpperCase(),
              interval: price.recurring?.interval === 'month' ? 'MONTHLY' : 'YEARLY',
              stripePriceId: priceId,
              stripeProductId: price.product as string,
              isActive: true,
            },
          })
        }

        // Create or update subscription
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            planId: plan.id,
            status: 'ACTIVE',
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: subscription.customer as string,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            stripeSubscriptionId: subscriptionId,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        })

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const dbSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (dbSubscription) {
          const priceId = subscription.items.data[0].price.id
          let plan = await prisma.subscriptionPlan.findUnique({
            where: { stripePriceId: priceId },
          })

          if (!plan) {
            const price = await stripe.prices.retrieve(priceId)
            plan = await prisma.subscriptionPlan.create({
              data: {
                name: price.nickname || 'Unknown Plan',
                price: (price.unit_amount || 0) / 100,
                currency: price.currency.toUpperCase(),
                interval: price.recurring?.interval === 'month' ? 'MONTHLY' : 'YEARLY',
                stripePriceId: priceId,
                stripeProductId: price.product as string,
                isActive: true,
              },
            })
          }

          await prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: {
              planId: plan.id,
              status: mapStripeStatus(subscription.status),
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            },
          })
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        })

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' {
  switch (status) {
    case 'active':
      return 'ACTIVE'
    case 'canceled':
      return 'CANCELED'
    case 'past_due':
      return 'PAST_DUE'
    case 'unpaid':
      return 'UNPAID'
    case 'trialing':
      return 'TRIALING'
    case 'incomplete':
      return 'INCOMPLETE'
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED'
    default:
      return 'ACTIVE'
  }
}
