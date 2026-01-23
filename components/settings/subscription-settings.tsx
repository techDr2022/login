'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getUserSubscription } from '@/app/actions/subscription-actions'
import { format } from 'date-fns'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

interface Subscription {
  id: string
  status: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  SubscriptionPlan: {
    name: string
    price: number
    currency: string
    interval: string
  }
}

export function SubscriptionSettings() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const sub = await getUserSubscription()
      if (sub) {
        setSubscription({
          id: sub.id,
          status: sub.status,
          currentPeriodStart: new Date(sub.currentPeriodStart),
          currentPeriodEnd: new Date(sub.currentPeriodEnd),
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          SubscriptionPlan: sub.SubscriptionPlan,
        } as Subscription)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error opening billing portal. Please try again.')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error opening billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and billing.
          </p>
        </div>
        <Alert>
          <AlertDescription>
            You don't have an active subscription. 
            <a href="/pricing" className="text-primary hover:underline ml-1">
              View plans
            </a>
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  const getStatusBadge = () => {
    switch (subscription.status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>
      case 'TRIALING':
        return <Badge variant="secondary">Trial</Badge>
      case 'CANCELED':
        return <Badge variant="destructive">Canceled</Badge>
      case 'PAST_DUE':
        return <Badge variant="destructive">Past Due</Badge>
      default:
        return <Badge variant="outline">{subscription.status}</Badge>
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount)
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Subscription</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{subscription.SubscriptionPlan.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(
                subscription.SubscriptionPlan.price,
                subscription.SubscriptionPlan.currency
              )}{' '}
              / {subscription.SubscriptionPlan.interval.toLowerCase()}
            </p>
          </div>
          {getStatusBadge()}
        </div>

        {subscription.cancelAtPeriodEnd && (
          <Alert variant="destructive">
            <AlertDescription>
              Your subscription will be canceled at the end of the current billing period.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Current Period Start
            </p>
            <p className="text-sm">
              {format(subscription.currentPeriodStart, 'PPP')}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Current Period End
            </p>
            <p className="text-sm">
              {format(subscription.currentPeriodEnd, 'PPP')}
            </p>
          </div>
        </div>

        <Button
          onClick={handleManageBilling}
          disabled={portalLoading}
          className="w-full sm:w-auto"
        >
          {portalLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
