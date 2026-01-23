'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Check, ArrowRight, Zap } from 'lucide-react'
import { Session } from 'next-auth'

interface PricingPageProps {
  session: Session | null
}

export default function PricingPage({ session }: PricingPageProps) {
  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small teams getting started',
      price: 29,
      interval: 'month',
      features: [
        'Up to 10 clients',
        'Up to 5 team members',
        'Task management',
        'Basic reporting',
        'Email support',
        '5GB storage',
      ],
      popular: false,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
    },
    {
      name: 'Professional',
      description: 'For growing teams and businesses',
      price: 79,
      interval: 'month',
      features: [
        'Up to 50 clients',
        'Up to 20 team members',
        'Advanced task management',
        'Advanced analytics',
        'Priority support',
        '50GB storage',
        'Custom integrations',
        'API access',
      ],
      popular: true,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID || '',
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with custom needs',
      price: 199,
      interval: 'month',
      features: [
        'Unlimited clients',
        'Unlimited team members',
        'Everything in Professional',
        'Dedicated account manager',
        '24/7 phone support',
        '500GB storage',
        'Custom integrations',
        'Advanced security',
        'SLA guarantee',
      ],
      popular: false,
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || '',
    },
  ]

  const handleSubscribe = async (priceId: string) => {
    if (!session) {
      // Redirect to login, then back to pricing
      window.location.href = `/login?redirect=/pricing&priceId=${priceId}`
      return
    }

    // Create checkout session
    try {
      const response = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error creating checkout session. Please try again.')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error creating checkout session. Please try again.')
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">TaskFlow</span>
          </Link>
          <div className="flex items-center space-x-4">
            {session ? (
              <Link href="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/">
                  <Button variant="ghost">Home</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline">Sign In</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="container px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works best for your team. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? 'border-primary shadow-lg scale-105' : ''}
              >
                <CardHeader>
                  {plan.popular && (
                    <Badge className="w-fit mb-2">Most Popular</Badge>
                  )}
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.stripePriceId)}
                  >
                    {session ? 'Subscribe' : 'Start Free Trial'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-24 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Can I change plans later?
                </h3>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  What happens after my trial ends?
                </h3>
                <p className="text-muted-foreground">
                  After your 14-day free trial, you'll be automatically charged based on your selected plan. 
                  You can cancel anytime before the trial ends.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-muted-foreground">
                  We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Is there a setup fee?
                </h3>
                <p className="text-muted-foreground">
                  No, there are no setup fees. You only pay the monthly or yearly subscription fee.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="container px-4 py-12">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
