'use client'

import { useEffect, useRef, useCallback } from 'react'
import { pingWFHActivity } from '@/app/actions/attendance-actions'
import { ATTENDANCE_CONFIG } from '@/lib/attendance-config'

interface UseWFHActivityOptions {
  enabled?: boolean
  pingIntervalMinutes?: number
  onInactivityWarning?: (minutesSinceLastActivity: number) => void
}

/**
 * Hook to track WFH activity by monitoring user interactions
 * Automatically pings the server at regular intervals when user is active
 */
export function useWFHActivity(options: UseWFHActivityOptions = {}) {
  const {
    enabled = true,
    pingIntervalMinutes = ATTENDANCE_CONFIG.WFH_ACTIVITY_PING_INTERVAL_MINUTES,
    onInactivityWarning,
  } = options

  const lastPingTimeRef = useRef<Date | null>(null)
  const lastActivityTimeRef = useRef<Date>(new Date())
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef(true)

  // Track user activity
  const recordActivity = useCallback(() => {
    lastActivityTimeRef.current = new Date()
    isActiveRef.current = true
  }, [])

  // Ping server with activity update
  const pingActivity = useCallback(async () => {
    if (!enabled || !isActiveRef.current) return

    try {
      await pingWFHActivity()
      lastPingTimeRef.current = new Date()
    } catch (error) {
      // Silently fail - user might not be in WFH mode or might have clocked out
      console.debug('WFH activity ping failed:', error)
    }
  }, [enabled])

  // Check for inactivity
  const checkInactivity = useCallback(() => {
    if (!enabled) return

    const now = new Date()
    const minutesSinceLastActivity = 
      (now.getTime() - lastActivityTimeRef.current.getTime()) / (1000 * 60)

    if (minutesSinceLastActivity >= ATTENDANCE_CONFIG.WFH_INACTIVITY_THRESHOLD_MINUTES) {
      isActiveRef.current = false
      if (onInactivityWarning) {
        onInactivityWarning(minutesSinceLastActivity)
      }
    }
  }, [enabled, onInactivityWarning])

  useEffect(() => {
    if (!enabled) return

    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      recordActivity()
      // If we were inactive, ping immediately to show we're back
      if (!isActiveRef.current) {
        isActiveRef.current = true
        pingActivity()
      }
    }

    // Throttle mousemove to avoid too many events
    let mouseMoveTimeout: NodeJS.Timeout | null = null
    const handleMouseMove = () => {
      if (mouseMoveTimeout) return
      mouseMoveTimeout = setTimeout(() => {
        handleActivity()
        mouseMoveTimeout = null
      }, 5000) // Only count mousemove every 5 seconds
    }

    // Add event listeners
    events.forEach(event => {
      if (event === 'mousemove') {
        document.addEventListener(event, handleMouseMove, { passive: true })
      } else {
        document.addEventListener(event, handleActivity, { passive: true })
      }
    })

    // Track window focus/blur
    const handleFocus = () => {
      recordActivity()
      isActiveRef.current = true
    }
    const handleBlur = () => {
      // Don't mark as inactive on blur, just stop pinging
      // User might switch tabs but still be working
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Initial ping
    pingActivity()

    // Set up periodic ping
    const pingIntervalMs = pingIntervalMinutes * 60 * 1000
    pingIntervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        pingActivity()
      }
    }, pingIntervalMs)

    // Set up inactivity check (check every 5 minutes)
    inactivityCheckRef.current = setInterval(checkInactivity, 5 * 60 * 1000)

    // Cleanup
    return () => {
      events.forEach(event => {
        if (event === 'mousemove') {
          document.removeEventListener(event, handleMouseMove)
        } else {
          document.removeEventListener(event, handleActivity)
        }
      })
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current)
      }
      if (mouseMoveTimeout) {
        clearTimeout(mouseMoveTimeout)
      }
    }
  }, [enabled, pingIntervalMinutes, pingActivity, recordActivity, checkInactivity])

  return {
    lastPingTime: lastPingTimeRef.current,
    lastActivityTime: lastActivityTimeRef.current,
    isActive: isActiveRef.current,
    pingActivity,
  }
}

