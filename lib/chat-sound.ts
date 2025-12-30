// Sound notification utility for chat and tasks

let audioContext: AudioContext | null = null
let chatSoundEnabled = false
let taskSoundEnabled = false
let userInteracted = false

// Default notification sound file
const DEFAULT_NOTIFICATION_SOUND = '/sounds/techdr-notification.mp3'

// Get sound file paths from localStorage or use defaults
function getChatSoundPath(): string | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('chatSoundPath')
  return saved || DEFAULT_NOTIFICATION_SOUND // Use default sound if no custom path is set
}

function getTaskSoundPath(): string | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('taskSoundPath')
  return saved || DEFAULT_NOTIFICATION_SOUND // Use default sound if no custom path is set
}

// Set custom sound file paths (exported for use in settings)
export function setChatSoundPath(path: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('chatSoundPath', path)
}

export function setTaskSoundPath(path: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('taskSoundPath', path)
}

// Initialize audio context after user interaction
export function initChatSound() {
  // Check localStorage for saved preferences
  // Default to false for chat sounds (disabled by default to prevent disturbing sounds)
  const chatSaved = localStorage.getItem('chatSoundEnabled')
  if (chatSaved === null) {
    // First time - disable by default and save to localStorage
    chatSoundEnabled = false
    localStorage.setItem('chatSoundEnabled', 'false')
  } else {
    chatSoundEnabled = chatSaved === 'true'
  }
  
  const taskSaved = localStorage.getItem('taskSoundEnabled')
  taskSoundEnabled = taskSaved === 'true' // Default to false for tasks (disabled by default)

  // Listen for first user interaction
  const enableSound = () => {
    userInteracted = true
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (e) {
        console.error('Failed to create audio context:', e)
      }
    }
    // Remove listeners after first interaction
    document.removeEventListener('click', enableSound)
    document.removeEventListener('keydown', enableSound)
    document.removeEventListener('touchstart', enableSound)
  }

  document.addEventListener('click', enableSound, { once: true })
  document.addEventListener('keydown', enableSound, { once: true })
  document.addEventListener('touchstart', enableSound, { once: true })
}

// Play audio file
function playAudioFile(path: string) {
  if (typeof window === 'undefined') {
    console.warn('Cannot play audio: window is undefined')
    return
  }

  try {
    const audio = new Audio(path)
    audio.volume = 0.3 // Set volume to 30% (reduced from 70% to be less disturbing)
    
    // Preload the audio
    audio.preload = 'auto'
    
    // Play the audio
    const playPromise = audio.play()
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Audio played successfully:', path)
        })
        .catch((e) => {
          console.error('Error playing audio file:', e, 'Path:', path)
          // Fallback to oscillator if audio file fails and user has interacted
          if (audioContext && userInteracted) {
            console.log('Falling back to oscillator sound')
            playNotificationSound(800)
          } else {
            console.warn('Cannot fallback: audioContext or userInteracted not ready')
          }
        })
    }
  } catch (e) {
    console.error('Error creating audio element:', e, 'Path:', path)
    // Fallback to oscillator if audio file fails and user has interacted
    if (audioContext && userInteracted) {
      playNotificationSound(800)
    }
  }
}

// Play notification sound for chat
export function playChatSound() {
  // Re-check enabled state from localStorage in case it changed
  const chatSaved = typeof window !== 'undefined' ? localStorage.getItem('chatSoundEnabled') : null
  const isEnabled = chatSaved === 'true' // Only enabled if explicitly set to 'true'
  
  if (!isEnabled) {
    return // Silent return - don't log when disabled
  }
  
  // Check if user has interacted (required for audio to play)
  if (!userInteracted) {
    return // Don't play sound if user hasn't interacted yet
  }
  
  // Update local state
  chatSoundEnabled = isEnabled
  
  const soundPath = getChatSoundPath()
  if (soundPath) {
    playAudioFile(soundPath)
  } else {
    console.warn('No chat sound path found')
  }
}

// Play notification sound for tasks
export function playTaskSound() {
  // Re-check enabled state from localStorage in case it changed
  const taskSaved = typeof window !== 'undefined' ? localStorage.getItem('taskSoundEnabled') : null
  const isEnabled = taskSaved === 'true' // Only enabled if explicitly set to 'true'
  
  if (!isEnabled) {
    return // Silent return - don't log when disabled
  }
  
  // Check if user has interacted (required for audio to play)
  if (!userInteracted) {
    return // Don't play sound if user hasn't interacted yet
  }
  
  // Update local state
  taskSoundEnabled = isEnabled
  
  const soundPath = getTaskSoundPath()
  if (soundPath) {
    playAudioFile(soundPath)
  } else {
    console.warn('No task sound path found')
  }
}

// Generic sound playing function (fallback oscillator)
function playNotificationSound(frequency: number) {
  if (!userInteracted || !audioContext) return

  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (e) {
    console.error('Error playing sound:', e)
  }
}

// Update sound enabled state for chat
export function setSoundEnabled(enabled: boolean) {
  chatSoundEnabled = enabled
  localStorage.setItem('chatSoundEnabled', String(enabled))
}

export function getSoundEnabled(): boolean {
  // Check localStorage directly to ensure we have the latest value
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem('chatSoundEnabled')
  // Default to false if not set (disabled by default)
  return saved === 'true'
}

// Task sound functions
export function setTaskSoundEnabled(enabled: boolean) {
  taskSoundEnabled = enabled
  localStorage.setItem('taskSoundEnabled', String(enabled))
}

export function getTaskSoundEnabled(): boolean {
  const saved = localStorage.getItem('taskSoundEnabled')
  return saved === 'true' // Default to false (disabled by default)
}

// Test function to verify sound is working (can be called from browser console)
export function testTaskSound() {
  console.log('Testing task sound...')
  console.log('Task sound enabled:', getTaskSoundEnabled())
  console.log('Task sound path:', getTaskSoundPath())
  playTaskSound()
}

// Test function for chat sound
export function testChatSound() {
  console.log('Testing chat sound...')
  console.log('Chat sound enabled:', getSoundEnabled())
  console.log('Chat sound path:', getChatSoundPath())
  playChatSound()
}

