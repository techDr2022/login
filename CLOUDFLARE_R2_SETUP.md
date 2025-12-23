# Cloudflare R2 Setup Guide

This guide will help you set up Cloudflare R2 (S3-compatible storage) for file uploads in the Client Onboarding System.

## What is Cloudflare R2?

Cloudflare R2 is an object storage service compatible with the S3 API. It's a great alternative to AWS S3 because:
- ✅ No egress fees (free data transfer out)
- ✅ S3-compatible API (works with existing S3 tools)
- ✅ Integrated with Cloudflare's CDN
- ✅ Pay only for storage and operations

## Step 1: Create a Cloudflare R2 Bucket

1. **Log in to Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Select your account

2. **Navigate to R2**
   - Click on **"R2"** in the left sidebar
   - If you don't see it, you may need to enable it first

3. **Create a Bucket**
   - Click **"Create bucket"**
   - Enter a bucket name (e.g., `client-assets` or `techdr-uploads`)
   - Choose a location (optional, defaults to auto)
   - Click **"Create bucket"**

## Step 2: Create API Token

1. **Go to R2 API Tokens**
   - In the R2 section, click **"Manage R2 API Tokens"**
   - Or go directly to: `https://dash.cloudflare.com/[your-account-id]/r2/api-tokens`

2. **Create API Token**
   - Click **"Create API token"**
   - Enter a token name (e.g., `client-onboarding-uploads`)
   - Set permissions:
     - **Object Read & Write** (for uploads and downloads)
   - Set TTL (optional, leave blank for no expiration)
   - Click **"Create API Token"**

3. **Save Your Credentials**
   - **Access Key ID**: Copy this immediately (you won't see it again!)
   - **Secret Access Key**: Copy this immediately (you won't see it again!)
   - ⚠️ **Important**: Store these securely. If you lose them, create a new token.

## Step 3: Get Your R2 Endpoint

1. **Find Your Account ID**
   - Go to your Cloudflare Dashboard
   - Click on any domain or go to the right sidebar
   - Your **Account ID** is displayed there

2. **Construct the Endpoint URL**
   - Format: `https://[account-id].r2.cloudflarestorage.com`
   - Example: `https://abc123def456.r2.cloudflarestorage.com`

## Step 4: Install AWS SDK (if not already installed)

The application uses the AWS SDK for S3-compatible operations. Install it:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Step 5: Configure Environment Variables

Add these to your `.env` or `.env.local` file:

```env
# Cloudflare R2 Configuration
S3_BUCKET_NAME="your-bucket-name"
S3_ACCESS_KEY_ID="your-access-key-id-from-step-2"
S3_SECRET_ACCESS_KEY="your-secret-access-key-from-step-2"
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

## Step 6: Test the Setup

1. **Restart your development server** (if running):
   ```bash
   npm run dev
   ```

2. **Try uploading a file** through the onboarding wizard:
   - Go to `/clients/new`
   - Navigate to the Branding step
   - Try uploading a logo or image
   - Check if it uploads successfully

3. **Verify in Cloudflare R2**:
   - Go to your R2 bucket in Cloudflare Dashboard
   - You should see files in the `client-assets/` folder

## Troubleshooting

### Error: "S3 upload failed"
- ✅ Check that all environment variables are set correctly
- ✅ Verify your Access Key ID and Secret Access Key are correct
- ✅ Ensure the bucket name matches exactly
- ✅ Check that the endpoint URL is correct (includes `https://`)

### Error: "Access Denied"
- ✅ Verify your API token has "Object Read & Write" permissions
- ✅ Check that the bucket name is correct
- ✅ Ensure you're using the correct account ID in the endpoint

### Files not appearing in R2
- ✅ Check the browser console for errors
- ✅ Verify the upload API route is working: `/api/clients/upload`
- ✅ Check server logs for S3 errors

### Fallback to Local Storage
- If S3 upload fails, the system automatically falls back to local storage
- Check `uploads/client-assets/` folder for locally stored files
- Fix S3 configuration and files will upload to R2

## Security Best Practices

1. ✅ **Use environment variables** - Never hardcode credentials
2. ✅ **Rotate API tokens** periodically (every 90 days recommended)
3. ✅ **Use least privilege** - Only grant necessary permissions
4. ✅ **Monitor usage** - Check R2 dashboard for unusual activity
5. ✅ **Use different buckets** for dev/staging/production
6. ✅ **Enable CORS** if needed (in R2 bucket settings)

## CORS Configuration (if needed)

If you need to access files directly from the browser:

1. Go to your R2 bucket settings
2. Click on **"CORS Policy"**
3. Add a CORS rule:
   ```json
   [
     {
       "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## Cost Considerations

Cloudflare R2 pricing (as of 2024):
- **Storage**: $0.015 per GB/month
- **Class A Operations** (writes, lists): $4.50 per million
- **Class B Operations** (reads): $0.36 per million
- **Egress**: FREE (unlike AWS S3)

For a typical client onboarding system:
- ~100 clients with ~10 assets each = ~1GB storage
- Monthly cost: ~$0.015 + minimal operation costs
- Very affordable compared to S3 with egress fees

## Alternative: Using Public R2 URLs

If you want public URLs instead of signed URLs:

1. Enable **Public Access** in your R2 bucket settings
2. Update `lib/storage.ts` to return public URLs:
   ```typescript
   async getUrl(key: string): Promise<string> {
     return `https://pub-${this.bucket}.r2.dev/${key}`
   }
   ```

Note: Public URLs expose files to anyone with the link. Use signed URLs (current implementation) for better security.

## Next Steps

Once R2 is configured:
1. ✅ Test file uploads in the onboarding wizard
2. ✅ Verify files appear in your R2 bucket
3. ✅ Test file downloads/access
4. ✅ Monitor usage in Cloudflare dashboard
5. ✅ Set up alerts for unusual activity (optional)

## Support

If you encounter issues:
1. Check Cloudflare R2 documentation: https://developers.cloudflare.com/r2/
2. Verify your API token permissions
3. Check server logs for detailed error messages
4. Ensure AWS SDK is installed: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

