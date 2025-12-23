# Quick Deployment Checklist

Use this checklist as you go through the deployment process.

## Pre-Deployment Setup

### 1. GitHub Setup
- [ ] Create GitHub account at github.com
- [ ] Create new repository (name: `internal-web-app`)
- [ ] Generate Personal Access Token (Settings → Developer settings → Personal access tokens)
- [ ] Push code to GitHub:
  ```bash
  cd "/Users/ravitejapendari/final task"
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/YOUR_USERNAME/internal-web-app.git
  git branch -M main
  git push -u origin main
  ```

### 2. Database Setup (Supabase)
- [ ] Create Supabase account at supabase.com
- [ ] Create new project
- [ ] Save database password
- [ ] Get connection string from Settings → Database
- [ ] Format: `postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?schema=public`
- [ ] Run locally to set up database:
  ```bash
  export DATABASE_URL="your-connection-string-here"
  npm run db:push
  npm run db:seed
  ```

### 3. File Storage (Cloudflare R2 - Optional)
- [ ] Create Cloudflare account at dash.cloudflare.com
- [ ] Create R2 bucket (name: `client-assets`)
- [ ] Create API token with "Object Read & Write" permission
- [ ] Save Access Key ID and Secret Access Key
- [ ] Get Account ID and endpoint: `https://[account-id].r2.cloudflarestorage.com`

### 4. Generate Secrets
- [ ] Generate NEXTAUTH_SECRET:
  ```bash
  openssl rand -base64 32
  ```
- [ ] Generate ENCRYPTION_KEY:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## Vercel Deployment

### 5. Vercel Setup
- [ ] Create Vercel account at vercel.com (sign in with GitHub)
- [ ] Import project from GitHub
- [ ] Add environment variables (see below)

### 6. Environment Variables in Vercel

**Required:**
- [ ] `DATABASE_URL` = Your Supabase connection string
- [ ] `NEXTAUTH_URL` = `https://your-project.vercel.app` (update after first deploy)
- [ ] `NEXTAUTH_SECRET` = Generated secret from step 4
- [ ] `ENCRYPTION_KEY` = Generated key from step 4

**Optional (if using R2):**
- [ ] `S3_BUCKET_NAME` = `client-assets`
- [ ] `S3_ACCESS_KEY_ID` = Your R2 Access Key ID
- [ ] `S3_SECRET_ACCESS_KEY` = Your R2 Secret Access Key
- [ ] `S3_REGION` = `auto`
- [ ] `S3_ENDPOINT` = `https://[account-id].r2.cloudflarestorage.com`

### 7. Deploy & Test
- [ ] Click "Deploy" in Vercel
- [ ] Wait for build to complete
- [ ] Copy your Vercel URL
- [ ] Update `NEXTAUTH_URL` to actual URL
- [ ] Redeploy
- [ ] Test login at `/login`:
  - Email: `raviteja@techdr.in`
  - Password: `password123`

## Post-Deployment

- [ ] App is accessible at your Vercel URL
- [ ] Login works
- [ ] File uploads work (if R2 configured)
- [ ] All features tested

---

**Need help?** See `DEPLOYMENT_GUIDE.md` for detailed instructions.

