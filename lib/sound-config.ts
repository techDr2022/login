// Helper utilities for configuring notification sounds

/**
 * Set the notification sound file path for chat notifications
 * @param path - Path to the sound file (e.g., '/sounds/notification.mp3')
 * 
 * Example:
 * setChatSoundPath('/sounds/my-custom-sound.mp3')
 */
export function setChatSoundPath(path: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('chatSoundPath', path)
  console.log(`Chat notification sound set to: ${path}`)
}

/**
 * Set the notification sound file path for task notifications
 * @param path - Path to the sound file (e.g., '/sounds/notification.mp3')
 * 
 * Example:
 * setTaskSoundPath('/sounds/my-custom-sound.mp3')
 */
export function setTaskSoundPath(path: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('taskSoundPath', path)
  console.log(`Task notification sound set to: ${path}`)
}

/**
 * Get the current chat sound file path
 */
export function getChatSoundPath(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('chatSoundPath')
}

/**
 * Get the current task sound file path
 */
export function getTaskSoundPath(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('taskSoundPath')
}

/**
 * Reset sound paths to defaults
 */
export function resetSoundPaths() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('chatSoundPath')
  localStorage.removeItem('taskSoundPath')
  console.log('Sound paths reset to defaults')
}

