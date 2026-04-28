import { Resend } from 'resend'

interface SendMailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

interface SendMailInput {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: SendMailAttachment[]
}

let cachedResend: Resend | null = null

function getResendClient(): Resend {
  if (cachedResend) return cachedResend

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY.')
  }

  cachedResend = new Resend(apiKey)
  return cachedResend
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    throw new Error('Missing RESEND_FROM_EMAIL for sender email address.')
  }

  const resend = getResendClient()
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  })

  if (error) {
    throw new Error(error.message || 'Failed to send email via Resend')
  }
}
