chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'PLAY_TASK_NOTIFICATION_SOUND') return

  const context = new window.AudioContext()
  const gain = context.createGain()
  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55)

  const first = context.createOscillator()
  first.type = 'sine'
  first.frequency.setValueAtTime(660, context.currentTime)
  first.connect(gain)
  first.start(context.currentTime)
  first.stop(context.currentTime + 0.22)

  const second = context.createOscillator()
  second.type = 'sine'
  second.frequency.setValueAtTime(880, context.currentTime + 0.2)
  second.connect(gain)
  second.start(context.currentTime + 0.2)
  second.stop(context.currentTime + 0.55)

  second.addEventListener('ended', () => context.close())
})
