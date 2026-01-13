# File Upload Troubleshooting Guide

If file uploads are not working, follow these steps:

## Common Issues

### 1. "Please complete Step 1 first"
**Problem**: You're trying to upload before the client is created.

**Solution**: 
- Complete Step 1 (Basic Info) first
- Click "Next Step" to create the client
- Then go back to Step 4 (Branding) or Step 2 (Doctors) to upload files

### 2. Upload fails silently
**Problem**: No error message appears, but file doesn't upload.

**Solution**:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Try uploading again
4. Check for error messages in the console
5. Check Network tab to see if the request is being made

### 3. "Storage error" or "Failed to upload file"
**Problem**: File storage is not configured or has issues.

**Solutions**:
- **If using local storage**: Check that `uploads/client-assets/` directory exists and has write permissions
- **If using S3/R2**: Verify environment variables are set correctly:
  ```env
  S3_BUCKET_NAME="your-bucket"
  S3_ACCESS_KEY_ID="your-key"
  S3_SECRET_ACCESS_KEY="your-secret"
  S3_REGION="auto"
  S3_ENDPOINT="https://your-endpoint"
  ```

### 4. "Unauthorized" or "Forbidden" error
**Problem**: You don't have permission to upload files.

**Solution**: 
- Only Admin/Manager roles can upload files
- Make sure you're logged in with the correct role
- Check your user role in the dashboard

### 5. File too large
**Problem**: File exceeds size limit.

**Solution**: 
- Use images under 10MB
- Compress images before uploading
- Use PNG or JPG format (not RAW or TIFF)

### 6. Wrong file type
**Problem**: File type not accepted.

**Solution**:
- For logos: Use PNG, JPG, or SVG
- For doctor photos: Use PNG or JPG
- Check file extension matches the format

## Debugging Steps

1. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for red error messages
   - Copy any error messages

2. **Check Network Tab**:
   - Open Developer Tools (F12)
   - Go to Network tab
   - Try uploading a file
   - Look for `/api/clients/upload` request
   - Check the response status and body

3. **Check Server Logs**:
   - Look at your terminal where `npm run dev` is running
   - Check for error messages
   - Look for "Error uploading file" or "Storage error"

4. **Verify Client ID**:
   - Make sure you completed Step 1
   - The client should be created before uploading
   - Check the URL - it should have a client ID

5. **Check File Permissions** (Local Storage):
   ```bash
   # Make sure uploads directory is writable
   chmod -R 755 uploads/
   ```

6. **Test Upload API Directly**:
   ```bash
   # Using curl (replace with your values)
   curl -X POST http://localhost:3000/api/clients/upload \
     -H "Cookie: your-session-cookie" \
     -F "file=@/path/to/image.jpg" \
     -F "clientId=your-client-id" \
     -F "type=LOGO" \
     -F "title=Test Logo"
   ```

## Quick Fixes

### Fix 1: Create Uploads Directory
```bash
mkdir -p uploads/client-assets
chmod -R 755 uploads
```

### Fix 2: Restart Development Server
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Fix 3: Clear Browser Cache
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear browser cache completely

### Fix 4: Check Environment Variables
Make sure your `.env.local` file has:
```env
DATABASE_URL="..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
```

## Still Not Working?

1. **Check the exact error message** in browser console
2. **Check server logs** in terminal
3. **Verify you're logged in** as Admin or Manager
4. **Try a different browser** to rule out browser issues
5. **Check file size** - try with a very small image (< 1MB)

## Expected Behavior

When upload works correctly:
1. Click upload area
2. Select image file
3. See "Uploading..." message
4. Image preview appears
5. File is saved and can be viewed

If any step fails, check the error message and refer to the solutions above.

