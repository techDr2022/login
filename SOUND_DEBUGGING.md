# Sound Notification Debugging Guide

## Quick Test

Open your browser console (F12) and run:

```javascript
// Test task sound
import { testTaskSound } from '@/lib/chat-sound'
testTaskSound()

// Or directly:
localStorage.setItem('taskSoundEnabled', 'true')
new Audio('/sounds/techdr-notification.mp3').play()
```

## Common Issues & Solutions

### 1. Sound Not Playing

**Check 1: Sound is enabled**
```javascript
localStorage.getItem('taskSoundEnabled') // Should be 'true' or null
```

**Check 2: File path is correct**
```javascript
// In browser console, test if file loads:
const audio = new Audio('/sounds/techdr-notification.mp3')
audio.oncanplay = () => console.log('File can play!')
audio.onerror = (e) => console.error('File error:', e)
audio.load()
```

**Check 3: Browser console errors**
- Open DevTools (F12) → Console tab
- Look for errors when creating a task
- Check for CORS errors or 404 errors

### 2. File Not Found (404)

**Solution:**
- Make sure file is in `public/sounds/techdr-notification.mp3`
- Restart Next.js dev server
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

### 3. CORS Errors

**Solution:**
- File should be in `public/` folder (not `app/` or `components/`)
- Next.js serves files from `public/` automatically

### 4. Audio Context Issues

**Solution:**
- Click anywhere on the page first (browser requires user interaction for some audio)
- Check browser console for audio context errors

## Manual Testing Steps

1. **Enable sound:**
   ```javascript
   localStorage.setItem('taskSoundEnabled', 'true')
   ```

2. **Test file directly:**
   ```javascript
   const audio = new Audio('/sounds/techdr-notification.mp3')
   audio.volume = 0.7
   audio.play().then(() => console.log('Playing!')).catch(e => console.error(e))
   ```

3. **Test via function:**
   ```javascript
   // In browser console after page loads
   window.testTaskSound?.()
   ```

4. **Create a test task:**
   - Go to Tasks page
   - Create a new task
   - Check browser console for logs
   - Sound should play automatically

## Enable Debug Logging

The code now includes console.log statements. Check the browser console for:
- "Playing task sound from: /sounds/techdr-notification.mp3"
- "Audio played successfully: /sounds/techdr-notification.mp3"
- Any error messages

## Reset Everything

```javascript
// Reset all sound settings
localStorage.removeItem('taskSoundEnabled')
localStorage.removeItem('chatSoundEnabled')
localStorage.removeItem('taskSoundPath')
localStorage.removeItem('chatSoundPath')
// Then refresh page
```

