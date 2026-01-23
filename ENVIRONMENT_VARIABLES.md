# Environment Variables Guide

This document explains the environment variables used in the Client Onboarding System.

## Required Variables

### Database
- **`DATABASE_URL`**: PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database?schema=public`
  - Example: `postgresql://postgres:password@localhost:5432/internal_app?schema=public`

### NextAuth
- **`NEXTAUTH_URL`**: The base URL of your application
  - Development: `http://localhost:3000`
  - Production: `https://yourdomain.com`
  
- **`NEXTAUTH_SECRET`**: A random secret key for NextAuth session encryption
  - Generate: `openssl rand -base64 32`

## Security Variables

### ENCRYPTION_KEY (Required for Production)

**What it does:**
- Encrypts sensitive data at rest, specifically client access credentials (passwords for GMB, social media accounts, etc.)
- Uses AES-256-GCM encryption
- Without this key, the system uses a default key (NOT SECURE for production)

**How to generate:**
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example:**
```
ENCRYPTION_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

**Important:**
- ⚠️ **NEVER** commit this key to version control
- ⚠️ **NEVER** share this key publicly
- ⚠️ Keep this key secure and backed up (if you lose it, encrypted passwords cannot be recovered)
- ✅ Use different keys for development and production
- ✅ Store in environment variables or secure secret management (AWS Secrets Manager, Vercel Environment Variables, etc.)

## Optional: S3-Compatible Storage

These variables are **optional**. If not set, files will be stored locally in the `uploads/client-assets/` folder.

### When to use S3:
- Production deployments
- Need scalable file storage
- Want CDN integration
- Need file access control
- Multiple server instances

### S3 Variables:

#### For AWS S3:
```env
S3_BUCKET_NAME="your-bucket-name"
S3_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
S3_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
S3_REGION="us-east-1"
```

#### For Cloudflare R2 (S3-compatible):
```env
S3_BUCKET_NAME="your-bucket-name"
S3_ACCESS_KEY_ID="your-r2-access-key-id"
S3_SECRET_ACCESS_KEY="your-r2-secret-access-key"
S3_REGION="auto"
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
```

#### For Other S3-Compatible Services (DigitalOcean Spaces, etc.):
```env
S3_BUCKET_NAME="your-bucket-name"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_REGION="nyc3"  # or your service's region
S3_ENDPOINT="https://nyc3.digitaloceanspaces.com"  # your service endpoint
```

### How it works:
1. **If S3 variables are set**: Files are uploaded to S3/R2 and accessed via signed URLs
2. **If S3 variables are NOT set**: Files are stored locally in `uploads/client-assets/` and served via `/api/files/[key]`

### Setting up AWS S3:
1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 permissions
3. Generate access keys for the user
4. Set the environment variables

### Setting up Cloudflare R2:
1. Go to Cloudflare Dashboard → R2
2. Create a bucket
3. Go to "Manage R2 API Tokens"
4. Create API token with read/write permissions
5. Set the environment variables including the endpoint

## Local Development Setup

For local development, you can use:

```env
# .env.local (not committed to git)
DATABASE_URL="postgresql://postgres:password@localhost:5432/internal_app"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-key-change-in-production"
ENCRYPTION_KEY="dev-encryption-key-32-bytes-hex"
# S3 variables - leave unset to use local storage
```

## Production Setup

For production (Vercel, Railway, etc.):

1. **Set all required variables** in your hosting platform's environment variables section
2. **Generate a strong ENCRYPTION_KEY** and store it securely
3. **Optionally set S3 variables** if you want cloud storage
4. **Never commit** `.env` files to git

## Security Best Practices

1. ✅ Use strong, randomly generated keys
2. ✅ Use different keys for dev/staging/production
3. ✅ Rotate keys periodically
4. ✅ Use secret management services in production
5. ✅ Never log or expose keys in error messages
6. ✅ Restrict access to environment variables
7. ✅ Use IAM roles when possible (instead of access keys)

## Troubleshooting

### "ENCRYPTION_KEY not set" warning
- This is normal in development
- Set `ENCRYPTION_KEY` in production
- The system will work but uses a default key (insecure)

### Files not uploading
- Check if `uploads/client-assets/` folder exists (for local storage)
- Check S3 credentials if using S3
- Check file permissions

### "Failed to decrypt value" error
- This means the `ENCRYPTION_KEY` changed
- Encrypted passwords cannot be recovered with a different key
- You'll need to re-enter passwords if the key changes

## Optional: Stripe Subscriptions (SaaS)

These variables are **required** if you want to enable subscription-based billing for your SaaS application.

### Stripe Variables:
```env
STRIPE_SECRET_KEY="sk_test_..."  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET="whsec_..."  # Webhook signing secret from Stripe
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID="price_..."  # Starter plan price ID
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID="price_..."  # Professional plan price ID
NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID="price_..."  # Enterprise plan price ID
NEXT_PUBLIC_APP_URL="https://yourdomain.com"  # Your app URL for redirects
```

### Setting up Stripe:

1. **Create a Stripe Account:**
   - Sign up at https://stripe.com
   - Complete account verification

2. **Get API Keys:**
   - Go to Stripe Dashboard → Developers → API keys
   - Copy your **Secret key** (starts with `sk_test_` for test mode, `sk_live_` for production)
   - Set `STRIPE_SECRET_KEY` in your environment variables

3. **Create Products and Prices:**
   - Go to Stripe Dashboard → Products
   - Create three products:
     - **Starter** ($29/month)
     - **Professional** ($79/month)
     - **Enterprise** ($199/month)
   - For each product, create a recurring price (monthly)
   - Copy the **Price ID** (starts with `price_`) for each plan
   - Set the corresponding environment variables:
     - `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`
     - `NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID`
     - `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`

4. **Set up Webhooks:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://yourdomain.com/api/subscriptions/webhook`
   - Select events to listen to:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the **Signing secret** (starts with `whsec_`)
   - Set `STRIPE_WEBHOOK_SECRET` in your environment variables

5. **Set App URL:**
   - Set `NEXT_PUBLIC_APP_URL` to your production domain
   - For local development, use `http://localhost:3000`

### Testing Stripe:

1. **Use Test Mode:**
   - Use test API keys (start with `sk_test_`)
   - Use Stripe test cards: https://stripe.com/docs/testing
   - Test card: `4242 4242 4242 4242` (any future expiry, any CVC)

2. **Test Webhooks Locally:**
   - Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/subscriptions/webhook`
   - This will give you a webhook signing secret for local testing

### Database Migration:

After setting up Stripe, run the database migration to add subscription tables:

```bash
npx prisma db push
# or
npx prisma migrate dev
```

### Subscription Features:

- **Landing Page:** Public landing page at `/` with features and pricing
- **Pricing Page:** `/pricing` with subscription plans
- **Checkout:** Stripe Checkout integration for secure payments
- **Subscription Management:** Users can manage subscriptions in Settings
- **Webhook Handling:** Automatic subscription status updates via Stripe webhooks

### Troubleshooting Stripe:

**"Stripe secret key not set" error:**
- Ensure `STRIPE_SECRET_KEY` is set in your environment variables
- Restart your server after setting environment variables

**Webhook not receiving events:**
- Verify webhook URL is correct and accessible
- Check webhook signing secret matches
- Ensure webhook endpoint is not behind authentication (middleware allows it)

**Checkout not redirecting:**
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check that price IDs are correct and active in Stripe

## Optional: WhatsApp Notifications

These variables are **optional**. If not set, WhatsApp notifications for task assignments will be disabled.

### When to use WhatsApp notifications:
- Want to notify employees immediately when tasks are assigned
- Need real-time task assignment notifications
- Employees prefer WhatsApp over email

### WhatsApp Variables:

#### Option 1: Using Twilio (Recommended)
```env
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_WHATSAPP_FROM="+1234567890"  # Your Twilio WhatsApp number (without whatsapp: prefix)

# Optional: For production, use WhatsApp Message Templates (recommended)
TWILIO_WHATSAPP_TEMPLATE_SID="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Content Template SID
TWILIO_USE_TEMPLATE="true"  # Set to "true" to use templates instead of freeform messages
```

**Setting up Twilio WhatsApp:**
1. Sign up for a Twilio account at https://www.twilio.com
2. Get a WhatsApp-enabled phone number from Twilio
3. Complete Twilio's WhatsApp Business verification process
4. Get your Account SID and Auth Token from Twilio Console
5. Set the environment variables

**Important: WhatsApp Message Templates (Required for Production):**
- Freeform messages only work within a 24-hour window after the user messages you
- For production, you **must** use approved WhatsApp Message Templates
- To set up templates:
  1. Go to Twilio Console → Messaging → Content Templates
  2. Create a new template (or use an existing one)
  3. Copy the Template SID (starts with `HX...`)
  4. Set `TWILIO_WHATSAPP_TEMPLATE_SID` and `TWILIO_USE_TEMPLATE="true"`

**Note:** Twilio WhatsApp requires business verification and may have approval processes. For testing, you can use Twilio's sandbox.

#### Option 2: Using Custom Webhook
```env
WHATSAPP_PROVIDER="webhook"
WHATSAPP_WEBHOOK_URL="https://your-webhook-endpoint.com/send-whatsapp"
```

**Webhook Format:**
Your webhook should accept POST requests with this JSON body:
```json
{
  "to": "+1234567890",
  "message": "Your message here"
}
```

#### Option 3: Disable WhatsApp Notifications
```env
WHATSAPP_PROVIDER="none"
# Or simply don't set WHATSAPP_PROVIDER (defaults to 'none')
```

### How it works:
1. When a task is assigned to an employee, the system checks:
   - If the employee has a phone number in their profile
   - If the employee has `notifyTaskUpdates` enabled (default: true)
   - If WhatsApp provider is configured
2. If all conditions are met, a WhatsApp message is sent with task details
3. Task creation/update succeeds even if WhatsApp notification fails (errors are logged)

### Phone Number Format:
- Phone numbers are automatically normalized to E.164 format (e.g., `+1234567890`)
- Indian numbers without country code are assumed to be +91
- Numbers can be entered with or without spaces/dashes

### User Phone Numbers:
- Employees need to have their phone number added to their user profile
- Phone numbers can be added/updated through the employee management interface
- Only employees with phone numbers and `notifyTaskUpdates` enabled will receive notifications

### Troubleshooting WhatsApp Notifications:

**Notifications not sending:**
- Check that `WHATSAPP_PROVIDER` is set correctly
- Verify Twilio credentials (if using Twilio)
- Check that employee has phone number in profile
- Verify employee has `notifyTaskUpdates` enabled
- Check server logs for error messages

**Twilio errors:**
- Ensure your Twilio account is active
- Verify WhatsApp number is approved/verified
- Check that phone numbers are in correct format
- Ensure you have sufficient Twilio credits

**"Outside the allowed window" error:**
- This means freeform messages can't be sent (24h window expired)
- **Solution:** Set up a WhatsApp Message Template:
  1. Go to Twilio Console → Messaging → Content Templates
  2. Create a template for task notifications
  3. Get the Template SID (starts with `HX...`)
  4. Set `TWILIO_WHATSAPP_TEMPLATE_SID="your-template-sid"`
  5. Set `TWILIO_USE_TEMPLATE="true"`
  6. Restart your server

**Webhook errors:**
- Verify webhook URL is accessible
- Check webhook accepts POST requests
- Ensure webhook returns proper response format

