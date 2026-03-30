# Notification Sounds

Place your custom notification sound files in this directory.

## Quick Start

1. **Place your sound file** in this `public/sounds/` directory
   - Example: Copy `my-notification.mp3` to `public/sounds/my-notification.mp3`

2. **Set the sound path** using one of these methods:

### Method 1: Browser Console (Easiest)
Open your browser's developer console (F12) and run:
```javascript
// For chat notifications
localStorage.setItem('chatSoundPath', '/sounds/my-notification.mp3')

// For task notifications  
localStorage.setItem('taskSoundPath', '/sounds/my-notification.mp3')

// Then refresh the page
```

### Method 2: Programmatically
```javascript
import { setChatSoundPath, setTaskSoundPath } from '@/lib/sound-config'

// Set custom sound for chat notifications
setChatSoundPath('/sounds/my-notification.mp3')

// Set custom sound for task notifications
setTaskSoundPath('/sounds/my-notification.mp3')
```

## Supported Formats
- MP3 (.mp3) - Recommended
- WAV (.wav)
- OGG (.ogg)

## File Paths
- Files in the `public/sounds/` directory are accessible at `/sounds/filename.ext`
- Example: `public/sounds/notification.mp3` → `/sounds/notification.mp3`
- Make sure the path starts with `/sounds/` (not `/public/sounds/`)

## Default Behavior
- **Default sound**: `techdr-notification.mp3` is used automatically for both chat and task notifications
- You can set different sounds for chat and task notifications if needed
- To reset to default, remove the localStorage items:
  ```javascript
  localStorage.removeItem('chatSoundPath')
  localStorage.removeItem('taskSoundPath')
  ```

## Testing Your Sound
After setting the path, trigger a notification to test:
1. Create a new task (for task notifications)
2. Send a chat message (for chat notifications)
3. The custom sound should play instead of the default beep

