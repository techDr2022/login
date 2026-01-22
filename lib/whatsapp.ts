/**
 * WhatsApp Notification Service
 * 
 * This service handles sending WhatsApp notifications for task assignments.
 * Supports multiple providers:
 * - Twilio WhatsApp API (recommended for production)
 * - Custom webhook-based services
 * 
 * Environment variables required:
 * - WHATSAPP_PROVIDER: 'twilio' | 'webhook' | 'none' (default: 'none')
 * - For Twilio:
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_WHATSAPP_FROM: Your Twilio WhatsApp number (format: whatsapp:+1234567890)
 * - For Webhook:
 *   - WHATSAPP_WEBHOOK_URL: URL to send POST requests to
 */

interface WhatsAppMessage {
  to: string
  message: string
  templateVariables?: string[] // Optional: For template-based messages
  forceFreeform?: boolean // Optional: Force freeform message instead of template
}

interface WhatsAppResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Normalize phone number to E.164 format (e.g., +1234567890)
 * Removes spaces, dashes, and ensures it starts with +
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // If it doesn't start with +, add it
  if (!normalized.startsWith('+')) {
    // Assume it's an Indian number if it starts with 0 or doesn't have country code
    if (normalized.startsWith('0')) {
      normalized = '+91' + normalized.substring(1)
    } else if (normalized.length === 10) {
      normalized = '+91' + normalized
    } else {
      normalized = '+' + normalized
    }
  }
  
  return normalized
}

/**
 * Send WhatsApp message using Twilio
 * Supports both template-based messages (recommended) and freeform messages (24h window only)
 */
async function sendViaTwilio(message: WhatsAppMessage): Promise<WhatsAppResponse> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID // Optional: Content Template SID
  const useTemplate = process.env.TWILIO_USE_TEMPLATE === 'true' // Optional: Force template usage

  console.log('[WhatsApp] Twilio configuration check:', {
    accountSid: accountSid ? 'SET' : 'MISSING',
    authToken: authToken ? 'SET' : 'MISSING',
    fromNumber: fromNumber ? 'SET' : 'MISSING',
    templateSid: templateSid ? 'SET' : 'NOT SET (will use freeform)',
    useTemplate: useTemplate ? 'ENABLED' : 'DISABLED',
  })

  if (!accountSid || !authToken || !fromNumber) {
    const missing = []
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID')
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN')
    if (!fromNumber) missing.push('TWILIO_WHATSAPP_FROM')
    
    console.error(`[WhatsApp] ❌ Twilio credentials not configured. Missing: ${missing.join(', ')}`)
    return {
      success: false,
      error: `Twilio credentials not configured. Missing: ${missing.join(', ')}`,
    }
  }

  try {
    // Dynamic import to avoid requiring twilio in development if not needed
    let twilio
    try {
      twilio = await import('twilio')
    } catch (importError) {
      return {
        success: false,
        error: 'Twilio package not installed. Run: npm install twilio',
      }
    }
    const client = twilio.default(accountSid, authToken)

    const normalizedTo = normalizePhoneNumber(message.to)
    const normalizedFrom = normalizePhoneNumber(fromNumber)

    // Try to use template if configured, otherwise use freeform (may fail outside 24h window)
    let messagePayload: any = {
      from: `whatsapp:${normalizedFrom}`,
      to: `whatsapp:${normalizedTo}`,
    }

    if (templateSid && useTemplate && !message.forceFreeform) {
      // Use Content Template (requires pre-approved template in Twilio)
      console.log('[WhatsApp] Using Content Template:', templateSid)
      messagePayload.contentSid = templateSid
      
      // Add template variables if provided
      if (message.templateVariables && message.templateVariables.length > 0) {
        // Twilio Content Templates expect contentVariables as a JSON string
        // Format: {"1": "value1", "2": "value2", ...}
        const contentVariables: Record<string, string> = {}
        message.templateVariables.forEach((value, index) => {
          // Twilio uses "1", "2", "3" etc. as keys for template variables
          contentVariables[String(index + 1)] = value || ''
        })
        messagePayload.contentVariables = JSON.stringify(contentVariables)
        console.log('[WhatsApp] Template variables:', JSON.stringify(contentVariables, null, 2))
      } else {
        console.warn('[WhatsApp] ⚠️ No template variables provided. Template may not render correctly.')
        console.warn('[WhatsApp] ⚠️ Make sure your template doesn\'t require variables, or provide templateVariables.')
      }
    } else {
      // Use freeform message (works only within 24h window after user messages you)
      if (message.forceFreeform) {
        console.log('[WhatsApp] Using freeform message (forced for attendance notifications)')
      } else {
        console.log('[WhatsApp] Using freeform message (24h window only)')
        console.warn('[WhatsApp] ⚠️ Freeform messages only work within 24h of user messaging you.')
        console.warn('[WhatsApp] ⚠️ For production, set TWILIO_WHATSAPP_TEMPLATE_SID and TWILIO_USE_TEMPLATE=true')
      }
      messagePayload.body = message.message
    }

    const result = await client.messages.create(messagePayload)

    console.log('[WhatsApp] Twilio response:', {
      messageId: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    })

    // Check if message was queued/sent (but not necessarily delivered)
    if (result.status === 'queued' || result.status === 'sent' || result.status === 'sending') {
      console.log(`[WhatsApp] Message ${result.status}. Check Twilio console for delivery status.`)
    } else if (result.status === 'failed' || result.status === 'undelivered') {
      console.error(`[WhatsApp] Message ${result.status}. Error: ${result.errorMessage || 'Unknown error'}`)
    }

    return {
      success: true,
      messageId: result.sid,
    }
  } catch (error: any) {
    console.error('[WhatsApp] Twilio WhatsApp error:', error)
    
    // Check if it's the template/freeform window error
    if (error.message && error.message.includes('outside the allowed window')) {
      console.error('[WhatsApp] ❌ Freeform message failed: Outside 24h window')
      console.error('[WhatsApp] 💡 Solution: Set up a WhatsApp Message Template in Twilio and configure:')
      console.error('[WhatsApp]   1. Create a template in Twilio Console → Messaging → Content Templates')
      console.error('[WhatsApp]   2. Get the Template SID (starts with HX...)')
      console.error('[WhatsApp]   3. Set TWILIO_WHATSAPP_TEMPLATE_SID="your-template-sid"')
      console.error('[WhatsApp]   4. Set TWILIO_USE_TEMPLATE="true"')
      return {
        success: false,
        error: 'Freeform messages only work within 24h window. Please set up a WhatsApp Message Template. See logs for instructions.',
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message via Twilio',
    }
  }
}

/**
 * Send WhatsApp message using webhook
 */
async function sendViaWebhook(message: WhatsAppMessage): Promise<WhatsAppResponse> {
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL

  console.log('[WhatsApp] Webhook configuration check:', {
    webhookUrl: webhookUrl ? 'SET' : 'MISSING',
  })

  if (!webhookUrl) {
    console.error('[WhatsApp] ❌ WhatsApp webhook URL not configured. Set WHATSAPP_WEBHOOK_URL environment variable.')
    return {
      success: false,
      error: 'WhatsApp webhook URL not configured. Please set WHATSAPP_WEBHOOK_URL environment variable.',
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalizePhoneNumber(message.to),
        message: message.message,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Webhook returned ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json()
    return {
      success: true,
      messageId: result.messageId || result.id || 'unknown',
    }
  } catch (error: any) {
    console.error('Webhook WhatsApp error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message via webhook',
    }
  }
}

/**
 * Send WhatsApp notification
 * 
 * @param to - Phone number of the recipient (will be normalized)
 * @param message - Message text to send (for freeform messages)
 * @param templateVariables - Optional array of template variables (for template-based messages)
 * @param forceFreeform - Optional: Force freeform message instead of using templates
 * @returns Promise with success status and optional message ID or error
 */
export async function sendWhatsAppNotification(
  to: string,
  message: string,
  templateVariables?: string[],
  forceFreeform?: boolean
): Promise<WhatsAppResponse> {
  // Check if WhatsApp notifications are enabled
  const provider = process.env.WHATSAPP_PROVIDER || 'none'

  console.log(`[WhatsApp] Provider configured: ${provider}`)

  if (provider === 'none') {
    console.warn('[WhatsApp] ⚠️ Notifications disabled. Set WHATSAPP_PROVIDER environment variable to enable.')
    console.warn('[WhatsApp] Options: "twilio" (requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) or "webhook" (requires WHATSAPP_WEBHOOK_URL)')
    return {
      success: false,
      error: 'WhatsApp notifications are disabled. Set WHATSAPP_PROVIDER environment variable.',
    }
  }

  if (!to || !message) {
    console.error('[WhatsApp] ❌ Missing required parameters:', { to: to ? 'SET' : 'MISSING', message: message ? 'SET' : 'MISSING' })
    return {
      success: false,
      error: 'Recipient phone number and message are required',
    }
  }

  const whatsappMessage: WhatsAppMessage = {
    to,
    message,
    templateVariables,
    forceFreeform,
  }

  switch (provider) {
    case 'twilio':
      return sendViaTwilio(whatsappMessage)
    case 'webhook':
      return sendViaWebhook(whatsappMessage)
    default:
      return {
        success: false,
        error: `Unknown WhatsApp provider: ${provider}. Supported providers: 'twilio', 'webhook', 'none'`,
      }
  }
}

/**
 * Format task assignment message for WhatsApp
 * Returns both formatted message string and template variables
 */
export function formatTaskAssignmentMessage(
  taskTitle: string,
  assignedByName: string,
  priority?: string,
  dueDate?: Date,
  clientName?: string
): string {
  let message = `📋 *New Task Assigned*\n\n`
  message += `*Task:* ${taskTitle}\n`
  message += `*Assigned by:* ${assignedByName}\n`

  if (priority) {
    const priorityEmoji = {
      Low: '🟢',
      Medium: '🟡',
      High: '🟠',
      Urgent: '🔴',
    }[priority] || '📌'
    message += `*Priority:* ${priorityEmoji} ${priority}\n`
  }

  if (dueDate) {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    message += `*Due Date:* ${formattedDate}\n`
  }

  if (clientName) {
    message += `*Client:* ${clientName}\n`
  }

  message += `\nPlease check your dashboard for more details.`

  return message
}

/**
 * Get template variables for WhatsApp template
 * Returns variables in the order: [taskTitle, assignedByName, priority, dueDate, clientName]
 */
export function getTaskAssignmentTemplateVariables(
  taskTitle: string,
  assignedByName: string,
  priority?: string,
  dueDate?: Date,
  clientName?: string
): string[] {
  // Format priority with emoji
  let priorityText = ''
  if (priority) {
    const priorityEmoji = {
      Low: '🟢',
      Medium: '🟡',
      High: '🟠',
      Urgent: '🔴',
    }[priority] || '📌'
    priorityText = `${priorityEmoji} ${priority}`
  }

  // Format due date
  let dueDateText = ''
  if (dueDate) {
    dueDateText = new Date(dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Return variables in order: taskTitle, assignedByName, priority, dueDate, clientName
  return [
    taskTitle,
    assignedByName,
    priorityText || 'Not set',
    dueDateText || 'Not set',
    clientName || 'Not assigned',
  ]
}

/**
 * Format attendance notification message for WhatsApp
 */
export function formatAttendanceNotificationMessage(
  employeeName: string,
  action: 'clock-in' | 'clock-out',
  time: Date,
  mode?: string,
  totalHours?: number
): string {
  const actionEmoji = action === 'clock-in' ? '✅' : '🔴'
  const actionText = action === 'clock-in' ? 'Clocked In' : 'Clocked Out'
  
  const formattedTime = time.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  let message = `${actionEmoji} *Attendance Update*\n\n`
  message += `*Employee Name:* ${employeeName}\n`
  message += `*Action:* ${actionText}\n`
  message += `*Time:* ${formattedTime}\n`
  
  if (mode) {
    const modeDisplay = mode === 'OFFICE' ? 'Office' : mode === 'WFH' ? 'Work From Home' : mode === 'LEAVE' ? 'Leave' : mode
    message += `*Work Mode:* ${modeDisplay}\n`
  }

  if (action === 'clock-out' && totalHours !== undefined && totalHours !== null) {
    message += `*Total Hours:* ${totalHours.toFixed(2)} hours\n`
  }

  return message
}

/**
 * Get template variables for attendance notification template
 * Returns variables in the order: [employeeName, action, time, mode, totalHours]
 */
export function getAttendanceNotificationTemplateVariables(
  employeeName: string,
  action: 'clock-in' | 'clock-out',
  time: Date,
  mode?: string,
  totalHours?: number
): string[] {
  const actionText = action === 'clock-in' ? 'Clocked In' : 'Clocked Out'
  
  const formattedTime = time.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const modeDisplay = mode 
    ? (mode === 'OFFICE' ? 'Office' : mode === 'WFH' ? 'Work From Home' : mode === 'LEAVE' ? 'Leave' : mode)
    : 'Not specified'

  const totalHoursText = action === 'clock-out' && totalHours !== undefined && totalHours !== null
    ? `${totalHours.toFixed(2)} hours`
    : 'N/A'

  // Return variables in order: employeeName, action, time, mode, totalHours
  return [
    employeeName,
    actionText,
    formattedTime,
    modeDisplay,
    totalHoursText,
  ]
}

/**
 * Format attendance reminder message for WhatsApp
 * Sent to employees who haven't clocked in by 10:20 AM
 */
export function formatAttendanceReminderMessage(employeeName: string): string {
  const currentTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  let message = `⏰ *Attendance Reminder*\n\n`
  message += `Hi ${employeeName},\n\n`
  message += `You haven't clocked in yet today (${currentTime}).\n\n`
  message += `Please clock in as soon as possible to mark your attendance.\n\n`
  message += `Thank you!`

  return message
}

/**
 * Get template variables for attendance reminder template
 * Returns variables in the order: [employeeName, currentTime]
 */
export function getAttendanceReminderTemplateVariables(employeeName: string): string[] {
  const currentTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  // Return variables in order: employeeName, currentTime
  return [
    employeeName,
    currentTime,
  ]
}

/**
 * Format WFH inactivity warning message for WhatsApp
 * Sent to admins when an employee becomes inactive during WFH
 */
export function formatWFHInactivityWarningMessage(
  employeeName: string,
  minutesInactive: number,
  lastActivityTime?: Date,
  activityScore?: number
): string {
  const formattedLastActivity = lastActivityTime
    ? new Date(lastActivityTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Unknown'

  const hoursInactive = Math.floor(minutesInactive / 60)
  const remainingMinutes = minutesInactive % 60
  const inactiveDuration = hoursInactive > 0
    ? `${hoursInactive}h ${remainingMinutes}m`
    : `${remainingMinutes}m`

  let message = `⚠️ *WFH Inactivity Alert*\n\n`
  message += `*Employee:* ${employeeName}\n`
  message += `*Status:* Inactive for ${inactiveDuration}\n`
  message += `*Last Activity:* ${formattedLastActivity}\n`
  
  if (activityScore !== undefined) {
    message += `*Activity Score:* ${activityScore}%\n`
  }
  
  message += `\nPlease check the WFH Activity Monitor for details.`

  return message
}

/**
 * Get template variables for WFH inactivity warning template
 * Returns variables in the order: [employeeName, inactiveDuration, lastActivityTime, activityScore]
 */
export function getWFHInactivityWarningTemplateVariables(
  employeeName: string,
  minutesInactive: number,
  lastActivityTime?: Date,
  activityScore?: number
): string[] {
  const hoursInactive = Math.floor(minutesInactive / 60)
  const remainingMinutes = minutesInactive % 60
  const inactiveDuration = hoursInactive > 0
    ? `${hoursInactive} hours ${remainingMinutes} minutes`
    : `${remainingMinutes} minutes`

  const formattedLastActivity = lastActivityTime
    ? new Date(lastActivityTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Unknown'

  const activityScoreText = activityScore !== undefined ? `${activityScore}%` : 'Not available'

  return [
    employeeName,
    inactiveDuration,
    formattedLastActivity,
    activityScoreText,
  ]
}
