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
 */
async function sendViaTwilio(message: WhatsAppMessage): Promise<WhatsAppResponse> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM environment variables.',
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

    const result = await client.messages.create({
      from: `whatsapp:${normalizedFrom}`,
      to: `whatsapp:${normalizedTo}`,
      body: message.message,
    })

    return {
      success: true,
      messageId: result.sid,
    }
  } catch (error: any) {
    console.error('Twilio WhatsApp error:', error)
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

  if (!webhookUrl) {
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
 * @param message - Message text to send
 * @returns Promise with success status and optional message ID or error
 */
export async function sendWhatsAppNotification(
  to: string,
  message: string
): Promise<WhatsAppResponse> {
  // Check if WhatsApp notifications are enabled
  const provider = process.env.WHATSAPP_PROVIDER || 'none'

  if (provider === 'none') {
    console.log('WhatsApp notifications disabled (WHATSAPP_PROVIDER=none)')
    return {
      success: false,
      error: 'WhatsApp notifications are disabled',
    }
  }

  if (!to || !message) {
    return {
      success: false,
      error: 'Recipient phone number and message are required',
    }
  }

  const whatsappMessage: WhatsAppMessage = {
    to,
    message,
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

