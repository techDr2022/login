export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import {
  sendWhatsAppNotification,
  formatPaymentReminderMessage,
  getPaymentReminderTemplateVariables,
} from '@/lib/whatsapp'

/**
 * Payment Reminder Cron Job
 *
 * This endpoint should be called daily to send WhatsApp reminders
 * to super admins about client payments due in 1 week.
 *
 * For Vercel Cron, add this to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/payment-reminder",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 *
 * For manual testing, you can call: GET /api/cron/payment-reminder?secret=<CRON_SECRET>
 */

export async function GET(request: NextRequest) {
  try {
    // Optional: Add secret key for security (recommended for production)
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && secret !== cronSecret) {
      console.error('[Payment Reminder] ❌ Unauthorized: Invalid secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Payment Reminder] 🔔 Starting payment reminder check...')

    // Calculate date 7 days from now
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    sevenDaysFromNow.setHours(23, 59, 59, 999)

    // Find clients with payments due in exactly 7 days
    const clientsDueIn7Days = await prisma.client.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'ONBOARDING'],
        },
        nextPaymentDate: {
          gte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000 - 1), // Start of day 7 days from now
          lte: sevenDaysFromNow, // End of day 7 days from now
        },
        monthlyAmount: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        doctorOrHospitalName: true,
        monthlyAmount: true,
        nextPaymentDate: true,
      },
    })

    console.log(`[Payment Reminder] Found ${clientsDueIn7Days.length} clients with payments due in 7 days`)

    if (clientsDueIn7Days.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No payments due in 7 days',
        remindersSent: 0,
      })
    }

    // Get all super admins with phone numbers
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        phoneNumber: { not: null },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    })

    console.log(`[Payment Reminder] Found ${superAdmins.length} super admins with phone numbers`)

    if (superAdmins.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No super admins found with phone numbers',
        remindersSent: 0,
      })
    }

    // Send WhatsApp reminders to all super admins
    const results = []
    const errors = []

    for (const admin of superAdmins) {
      if (!admin.phoneNumber) {
        console.warn(`[Payment Reminder] ⚠️ Skipping ${admin.name} - no phone number`)
        continue
      }

      for (const client of clientsDueIn7Days) {
        if (!client.monthlyAmount || !client.nextPaymentDate) {
          continue
        }

        const dueDate = new Date(client.nextPaymentDate)
        const daysUntil = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        try {
          const message = formatPaymentReminderMessage(
            client.name,
            client.doctorOrHospitalName,
            client.monthlyAmount,
            dueDate,
            daysUntil
          )
          const templateVariables = getPaymentReminderTemplateVariables(
            client.name,
            client.doctorOrHospitalName,
            client.monthlyAmount,
            dueDate,
            daysUntil
          )

          console.log(
            `[Payment Reminder] 📱 Sending reminder to ${admin.name} (${admin.phoneNumber}) for client ${client.name}`
          )

          const result = await sendWhatsAppNotification(
            admin.phoneNumber,
            message,
            templateVariables,
            true // Force freeform for payment reminders
          )

          if (result.success) {
            console.log(
              `[Payment Reminder] ✅ Reminder sent to ${admin.name} for ${client.name}. Message ID: ${result.messageId || 'N/A'}`
            )
            results.push({
              adminId: admin.id,
              adminName: admin.name,
              clientId: client.id,
              clientName: client.name,
              success: true,
              messageId: result.messageId,
            })
          } else {
            console.error(
              `[Payment Reminder] ❌ Failed to send reminder to ${admin.name} for ${client.name}: ${result.error}`
            )
            errors.push({
              adminId: admin.id,
              adminName: admin.name,
              clientId: client.id,
              clientName: client.name,
              error: result.error,
            })
          }
        } catch (error: any) {
          console.error(
            `[Payment Reminder] ❌ Error sending reminder to ${admin.name} for ${client.name}:`,
            error
          )
          errors.push({
            adminId: admin.id,
            adminName: admin.name,
            clientId: client.id,
            clientName: client.name,
            error: error.message || 'Unknown error',
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders sent for ${results.length} client(s)`,
      clientsFound: clientsDueIn7Days.length,
      remindersSent: results.length,
      errorsCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[Payment Reminder] ❌ Error in payment reminder cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
