# Step-by-Step Deployment Guide (No GitHub Required)

## ✅ What's Already Done
- ✅ Neon DB is configured and connected
- ✅ Database schema is set up
- ✅ Environment variables are configured locally

## Step 1: Login to Vercel

Run this command and follow the browser prompt:
```bash
cd "/Users/ravitejapendari/final task"
npx vercel login
```

**OR** if that doesn't work, go to https://vercel.com and:
1. Sign up/Login with your email
2. Complete the authentication

## Step 2: First Deploy (Creates Project)

Run this command:
```bash
cd "/Users/ravitejapendari/final task"
npx vercel
```

**Answer the prompts:**
- "In which scope?" → Choose your account
- "Link to existing project?" → **No** (we're creating new)
- "Project name?" → Type: `internal-web-app` (or any name you like)
- "Framework detected: Next.js" → Press Enter (accept defaults)
- "Override settings?" → **No** (press Enter)

**Note:** This first deploy will work but won't have environment variables yet. That's OK!

## Step 3: Get Your Production URL

After deployment, Vercel will show you a URL like:
```
https://internal-web-app-xxxxx.vercel.app
```

**Copy this URL** - you'll need it for the next step!

## Step 4: Set Environment Variables in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click on your project (`internal-web-app`)
3. Go to **Settings** → **Environment Variables**
4. Add these variables (click "Add" for each):

### Required Variables:

**1. DATABASE_URL**
- Key: `DATABASE_URL`
- Value: Your Neon connection string (from your `.env` file)
- Environment: Select **Production**, **Preview**, and **Development**

**2. NEXTAUTH_URL**
- Key: `NEXTAUTH_URL`
- Value: `https://your-project-name.vercel.app` (use the URL from Step 3)
- Environment: Select **Production** and **Preview**

**3. NEXTAUTH_SECRET**
- Key: `NEXTAUTH_SECRET`
- Value: Copy from your `.env` file (the value you already have)
- Environment: Select **Production**, **Preview**, and **Development**

**4. ENCRYPTION_KEY**
- Key: `ENCRYPTION_KEY`
- Value: Copy from your `.env` file (the value you already have)
- Environment: Select **Production**, **Preview**, and **Development**

### Optional (for file uploads - can add later):

**5-9. Cloudflare R2 Variables** (if you want cloud storage)
- `S3_BUCKET_NAME`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION` (set to `auto`)
- `S3_ENDPOINT`

**Note:** If you skip R2, files will be stored locally on Vercel (fine for testing, but not ideal for production).

## Step 5: Redeploy with Environment Variables

After adding all environment variables, run:
```bash
cd "/Users/ravitejapendari/final task"
npx vercel --prod
```

This will deploy to production with all your environment variables.

## Step 6: Test Your Live Site

1. Open your production URL: `https://your-project-name.vercel.app`
2. Go to the login page
3. Login with:
   - Email: `raviteja@techdr.in`
   - Password: `password123`

## Step 7: (Optional) Add Custom Domain

If you have your own domain:

1. In Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your domain (e.g., `app.yourdomain.com`)
3. Follow Vercel's DNS instructions
4. Update `NEXTAUTH_URL` environment variable to your custom domain
5. Redeploy: `npx vercel --prod`

## Troubleshooting

### "Database connection failed"
- Check that `DATABASE_URL` in Vercel matches your Neon connection string
- Make sure Neon allows connections from Vercel (should work by default)

### "NextAuth error"
- Verify `NEXTAUTH_URL` matches your Vercel URL exactly
- Check `NEXTAUTH_SECRET` is set correctly

### "Files not uploading"
- If you didn't set up R2, files will be stored on Vercel (temporary)
- For production, set up Cloudflare R2 (see `QUICK_R2_SETUP.md`)

### "Build failed"
- Check Vercel build logs in the dashboard
- Make sure all dependencies are in `package.json`
- Try running `npm run build` locally first

## Quick Commands Reference

```bash
# Login to Vercel
npx vercel login

# Deploy to preview
npx vercel

# Deploy to production
npx vercel --prod

# Check who you're logged in as
npx vercel whoami

# View deployment logs
npx vercel logs
```

## Next Steps After Deployment

1. ✅ Test all features (login, create client, upload files, etc.)
2. ✅ Set up Cloudflare R2 for file storage (optional but recommended)
3. ✅ Add custom domain (optional)
4. ✅ Set up monitoring/alerts (optional)

---

**Need help?** Check Vercel dashboard logs or run `npx vercel logs` for deployment errors.
