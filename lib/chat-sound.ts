// Sound notification utility for chat

let audioContext: AudioContext | null = null
let soundEnabled = false
let userInteracted = false

// Initialize audio context after user interaction
export function initChatSound() {
  if (userInteracted) return

  // Check localStorage for saved preference
  const saved = localStorage.getItem('chatSoundEnabled')
  soundEnabled = saved === 'true'

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

// Play notification sound
export function playChatSound() {
  if (!soundEnabled || !userInteracted || !audioContext) return

  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (e) {
    console.error('Error playing sound:', e)
  }
}

// Update sound enabled state
export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled
  localStorage.setItem('chatSoundEnabled', String(enabled))
}

export function getSoundEnabled(): boolean {
  return soundEnabled
}

