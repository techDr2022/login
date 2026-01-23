# SaaS Setup Guide

This guide will help you set up your application as a SaaS (Software as a Service) with subscription billing using Stripe.

## Overview

The SaaS implementation includes:
- **Landing Page**: Public marketing page with features and pricing
- **Subscription Plans**: Three tiers (Starter, Professional, Enterprise)
- **Stripe Integration**: Secure payment processing
- **Subscription Management**: Users can manage their subscriptions
- **Webhook Handling**: Automatic subscription status updates

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. A PostgreSQL database (already set up)
3. Environment variables configured

## Step 1: Install Dependencies

Install the Stripe package:

```bash
npm install stripe
```

## Step 2: Set Up Stripe

### 2.1 Create Stripe Account

1. Go to https://stripe.com and sign up
2. Complete account verification
3. Switch to test mode for development

### 2.2 Get API Keys

1. Go to Stripe Dashboard → Developers → API keys
2. Copy your **Secret key** (starts with `sk_test_` for test mode)
3. Add to your `.env.local`:

```env
STRIPE_SECRET_KEY="sk_test_..."
```

### 2.3 Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Click "Add product" and create three products:

**Starter Plan:**
- Name: Starter
- Description: Perfect for small teams getting started
- Pricing: $29/month (recurring)
- Copy the Price ID (starts with `price_`)

**Professional Plan:**
- Name: Professional
- Description: For growing teams and businesses
- Pricing: $79/month (recurring)
- Copy the Price ID

**Enterprise Plan:**
- Name: Enterprise
- Description: For large organizations with custom needs
- Pricing: $199/month (recurring)
- Copy the Price ID

3. Add to your `.env.local`:

```env
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID="price_..."
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID="price_..."
NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID="price_..."
```

### 2.4 Set Up Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/subscriptions/webhook`
   - For local testing, use Stripe CLI (see below)
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to your `.env.local`:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 2.5 Set App URL

Add your application URL:

```env
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
# For local development:
# NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Step 3: Database Migration

Run the database migration to add subscription tables:

```bash
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name add_subscriptions
```

## Step 4: Test Locally

### 4.1 Install Stripe CLI (for webhook testing)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from https://stripe.com/docs/stripe-cli
```

### 4.2 Forward Webhooks to Local Server

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/subscriptions/webhook
```

This will output a webhook signing secret. Use this in your `.env.local`:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."  # From Stripe CLI output
```

### 4.3 Test Checkout

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit http://localhost:3000
3. Click "Get Started" or go to `/pricing`
4. Click "Start Free Trial" on any plan
5. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

6. Complete checkout
7. Check Stripe Dashboard → Customers to see the subscription

## Step 5: Production Deployment

### 5.1 Switch to Live Mode

1. In Stripe Dashboard, switch to **Live mode**
2. Get your live API keys
3. Update environment variables in your hosting platform:
   - `STRIPE_SECRET_KEY` (use `sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` (from live webhook endpoint)
   - `NEXT_PUBLIC_STRIPE_*_PRICE_ID` (use live price IDs)
   - `NEXT_PUBLIC_APP_URL` (your production domain)

### 5.2 Set Up Production Webhook

1. Go to Stripe Dashboard → Developers → Webhooks (in Live mode)
2. Add endpoint: `https://yourdomain.com/api/subscriptions/webhook`
3. Select the same events as test mode
4. Copy the signing secret and update `STRIPE_WEBHOOK_SECRET`

### 5.3 Deploy

Deploy your application with all environment variables set.

## Features

### Landing Page (`/`)

- Public marketing page
- Hero section with CTA
- Features showcase
- Pricing preview
- Footer with links

### Pricing Page (`/pricing`)

- Three subscription tiers
- Feature comparison
- FAQ section
- Direct checkout integration

### Subscription Management

- Users can view subscription in Settings
- Manage billing via Stripe Customer Portal
- View current plan, status, and billing period
- Cancel or update subscription

### Webhook Integration

Automatically handles:
- New subscriptions (checkout completion)
- Subscription updates (plan changes, renewals)
- Subscription cancellations
- Status changes (active, past due, etc.)

## Customization

### Change Pricing

1. Update prices in Stripe Dashboard
2. Update price IDs in environment variables
3. Update pricing display in `components/landing/pricing-page.tsx`

### Add More Plans

1. Create product in Stripe
2. Add price ID to environment variables
3. Add plan object to `pricing-page.tsx`
4. Update database schema if needed (e.g., add plan limits)

### Customize Landing Page

Edit `components/landing/landing-page.tsx` to:
- Change hero text
- Add/remove features
- Update branding
- Modify footer

## Troubleshooting

### Checkout Not Working

- Verify Stripe secret key is set
- Check price IDs are correct
- Ensure `NEXT_PUBLIC_APP_URL` is set
- Check browser console for errors

### Webhooks Not Receiving Events

- Verify webhook URL is accessible
- Check webhook signing secret matches
- Ensure webhook endpoint is public (middleware allows it)
- Check Stripe Dashboard → Webhooks for delivery logs

### Subscription Not Created After Checkout

- Check webhook is receiving `checkout.session.completed` event
- Verify database migration ran successfully
- Check server logs for errors
- Ensure user exists in database

### Users Can't Access Features

- Check subscription status in database
- Verify subscription is active and not expired
- Check middleware allows access to routes
- Review subscription status checks in protected routes

## Security Notes

- Never expose Stripe secret keys in client-side code
- Always validate webhook signatures
- Use HTTPS in production
- Keep Stripe API keys secure
- Rotate keys periodically

## Support

For Stripe-specific issues, refer to:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For application issues, check:
- Server logs
- Stripe Dashboard → Events
- Database subscription records
