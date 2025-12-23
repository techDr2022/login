# Quick Cloudflare R2 Setup

Follow these steps to configure your Cloudflare R2 bucket:

## Step 1: Get Your R2 API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **Manage R2 API Tokens**
3. Click **"Create API token"**
4. Name it (e.g., `client-uploads`)
5. Set permission: **Object Read & Write**
6. Click **"Create API Token"**
7. **IMPORTANT**: Copy both:
   - **Access Key ID** (you'll see it once)
   - **Secret Access Key** (you'll see it once)

## Step 2: Get Your Account ID and Endpoint

1. In Cloudflare Dashboard, look at the right sidebar
2. Find your **Account ID** (or click on any domain to see it)
3. Your endpoint will be: `https://[your-account-id].r2.cloudflarestorage.com`

## Step 3: Add to Environment Variables

Add these to your `.env.local` file (create it if it doesn't exist):

```env
# Cloudflare R2 Configuration
S3_BUCKET_NAME="your-bucket-name"
S3_ACCESS_KEY_ID="your-access-key-id-from-step-1"
S3_SECRET_ACCESS_KEY="your-secret-access-key-from-step-1"
S3_REGION="auto"
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
```

### Example:
```env
S3_BUCKET_NAME="client-assets"
S3_ACCESS_KEY_ID="abc123def456789"
S3_SECRET_ACCESS_KEY="xyz789uvw456rst321"
S3_REGION="auto"
S3_ENDPOINT="https://abc123def456.r2.cloudflarestorage.com"
```

## Step 4: Restart Your Server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## Step 5: Test It

1. Go to `/clients/new`
2. Complete Step 1 (Basic Info)
3. Go to Step 4 (Branding)
4. Try uploading a logo
5. Check your R2 bucket - the file should appear there!

## Troubleshooting

### Files still uploading locally?
- Check that all 5 environment variables are set
- Make sure there are no typos
- Restart the dev server after adding variables

### "Access Denied" error?
- Verify your API token has "Object Read & Write" permissions
- Check that the bucket name matches exactly
- Ensure the endpoint URL is correct

### Files not appearing in R2?
- Check browser console (F12) for errors
- Check server terminal for error messages
- Verify the bucket name is correct

## Need Help?

Check the detailed guide: `CLOUDFLARE_R2_SETUP.md`

