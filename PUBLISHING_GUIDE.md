# Publishing Guide - How to Publish Your Code

This guide covers multiple ways to publish your application.

## 🚀 Option 1: Deploy to Vercel (Recommended)

Vercel is the easiest and fastest way to deploy Next.js applications.

### Step 1: Push to GitHub (if not already done)

First, ensure your code is pushed to GitHub:

```bash
# Check if you're authenticated with GitHub
git remote -v

# If you need to authenticate, you can:
# 1. Use GitHub CLI (if installed)
gh auth login

# 2. Or use a Personal Access Token
# Create one at: https://github.com/settings/tokens
# Then push with:
git push -u origin main
```

### Step 2: Login to Vercel

```bash
npx vercel login
```

This will open a browser window for authentication. Follow the prompts.

### Step 3: Deploy to Vercel

```bash
# First deployment (creates project)
npx vercel

# Answer the prompts:
# - "In which scope?" → Choose your account
# - "Link to existing project?" → No
# - "Project name?" → internal-web-app (or your preferred name)
# - "Framework detected: Next.js" → Press Enter (accept defaults)
# - "Override settings?" → No
```

### Step 4: Get Your Production URL

After deployment, Vercel will show you a URL like:
```
https://internal-web-app-xxxxx.vercel.app
```

**Copy this URL** - you'll need it for environment variables!

### Step 5: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

#### Required Variables:

**1. DATABASE_URL**
- Key: `DATABASE_URL`
- Value: Your PostgreSQL connection string (from your `.env.local` file)
- Environment: Select **Production**, **Preview**, and **Development**

**2. NEXTAUTH_URL**
- Key: `NEXTAUTH_URL`
- Value: `https://your-project-name.vercel.app` (use the URL from Step 4)
- Environment: Select **Production** and **Preview**

**3. NEXTAUTH_SECRET**
- Key: `NEXTAUTH_SECRET`
- Value: Copy from your `.env.local` file
- Environment: Select **Production**, **Preview**, and **Development**

**4. ENCRYPTION_KEY**
- Key: `ENCRYPTION_KEY`
- Value: Copy from your `.env.local` file (32-byte hex string)
- Environment: Select **Production**, **Preview**, and **Development**

#### Optional Variables (if you have them):

**5-9. Cloudflare R2 / S3 Variables** (for file storage)
- `S3_BUCKET_NAME`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION` (set to `auto` for R2)
- `S3_ENDPOINT`

**10-14. WhatsApp/Twilio Variables** (if using WhatsApp notifications)
- `WHATSAPP_PROVIDER` (e.g., "twilio" or "none")
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_WHATSAPP_TEMPLATE_SID` (optional, for production)
- `TWILIO_USE_TEMPLATE` (optional, set to "true" for production)

### Step 6: Redeploy with Environment Variables

After adding all environment variables:

```bash
npx vercel --prod
```

This deploys to production with all your environment variables.

### Step 7: Test Your Live Site

1. Open your production URL: `https://your-project-name.vercel.app`
2. Go to the login page
3. Test login with your credentials

### Step 8: (Optional) Connect GitHub for Auto-Deploy

1. In Vercel Dashboard → Your Project → **Settings** → **Git**
2. Connect your GitHub repository
3. Enable automatic deployments on push

---

## 🔄 Option 2: Deploy via GitHub Integration

If you prefer to deploy directly from GitHub:

1. **Push your code to GitHub** (see Step 1 above)

2. **Go to Vercel Dashboard**: https://vercel.com/dashboard

3. **Click "Add New Project"**

4. **Import your GitHub repository**:
   - Select `techDr2022/login`
   - Click "Import"

5. **Configure the project**:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

6. **Add Environment Variables** (same as Step 5 above)

7. **Click "Deploy"**

8. **After deployment**, Vercel will automatically deploy on every push to your main branch!

---

## 🐳 Option 3: Deploy to Other Platforms

### Railway

1. Go to https://railway.app
2. Create a new project
3. Connect your GitHub repository
4. Add environment variables in Railway dashboard
5. Deploy!

### Render

1. Go to https://render.com
2. Create a new Web Service
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy!

### DigitalOcean App Platform

1. Go to https://cloud.digitalocean.com/apps
2. Create a new app
3. Connect your GitHub repository
4. Configure build settings
5. Add environment variables
6. Deploy!

---

## 📋 Pre-Deployment Checklist

Before publishing, make sure:

- [ ] All environment variables are set in your hosting platform
- [ ] Database is accessible from your hosting platform
- [ ] `NEXTAUTH_URL` matches your production domain
- [ ] `ENCRYPTION_KEY` is set (for production security)
- [ ] `.env.local` is NOT committed to git (check `.gitignore`)
- [ ] Database migrations are up to date
- [ ] Build passes locally: `npm run build`

---

## 🔧 Quick Commands Reference

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

# List all deployments
npx vercel ls
```

---

## 🐛 Troubleshooting

### "Database connection failed"
- Check that `DATABASE_URL` in Vercel matches your database connection string
- Ensure your database allows connections from Vercel's IPs
- For Neon/other cloud databases, check firewall/network settings

### "NextAuth error"
- Verify `NEXTAUTH_URL` matches your Vercel URL exactly (no trailing slash)
- Check `NEXTAUTH_SECRET` is set correctly
- Ensure both are set for Production environment

### "Build failed"
- Check Vercel build logs in the dashboard
- Try running `npm run build` locally first
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors: `npm run lint`

### "Files not uploading"
- If you didn't set up R2/S3, files will be stored on Vercel (temporary)
- For production, set up Cloudflare R2 (see `QUICK_R2_SETUP.md`)

### "Authentication not working"
- Verify `NEXTAUTH_URL` is correct
- Check that cookies are enabled in your browser
- Ensure `NEXTAUTH_SECRET` is set

---

## 🎯 Next Steps After Publishing

1. ✅ Test all features (login, create client, upload files, etc.)
2. ✅ Set up Cloudflare R2 for file storage (optional but recommended)
3. ✅ Add custom domain (optional)
4. ✅ Set up monitoring/alerts (optional)
5. ✅ Configure cron jobs (already set in `vercel.json`)

---

## 📚 Additional Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Environment Variables Guide**: See `ENVIRONMENT_VARIABLES.md`
- **R2 Setup**: See `QUICK_R2_SETUP.md`
- **Deployment Guide**: See `DEPLOYMENT_GUIDE.md`

---

**Need help?** Check Vercel dashboard logs or run `npx vercel logs` for deployment errors.

