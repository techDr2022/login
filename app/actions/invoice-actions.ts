'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, InvoicePlanDuration } from '@prisma/client'
import { sendWhatsAppNotification, formatInvoiceMessage, getInvoiceTemplateVariables } from '@/lib/whatsapp'
import { generateInvoicePDF } from '@/lib/invoice-pdf'
import { getStorageAdapter } from '@/lib/storage'

export interface ClientInvoice {
  id: string
  name: string
  doctorOrHospitalName: string
  startDate: Date | null
  endDate: Date | null
  monthlyAmount: number | null
  planDuration: InvoicePlanDuration | null
  nextPaymentDate: Date | null
  lastPaymentDate: Date | null
  status: string
  isGST: boolean
  gstNumber: string | null
  gstRate: number | null
  discountPercent: number | null
  accountManager: {
    id: string
    name: string
  } | null
}

export async function getClientInvoices(): Promise<ClientInvoice[]> {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can view invoices')
  }

  // Fetch all clients so the invoices tab can show and manage invoice data for every client.
  // Note: We cast this query to `any` because the local Prisma TS types can lag behind schema/migrations in some setups.
  const clients = (await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
      startDate: true,
      endDate: true,
      monthlyAmount: true,
      planDuration: true,
      nextPaymentDate: true,
      lastPaymentDate: true,
      status: true,
      isGST: true,
      gstNumber: true,
      gstRate: true,
      discountPercent: true,
      User: {
        select: {
          id: true,
          name: true,
        },
      },
    } as any,
    orderBy: [
      {
        nextPaymentDate: {
          sort: 'asc',
          nulls: 'last',
        },
      },
      {
        name: 'asc',
      },
    ],
  } as any)) as any[]

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    doctorOrHospitalName: client.doctorOrHospitalName,
    startDate: client.startDate,
    endDate: client.endDate,
    monthlyAmount: client.monthlyAmount,
    planDuration: client.planDuration,
    nextPaymentDate: client.nextPaymentDate,
    lastPaymentDate: client.lastPaymentDate,
    status: client.status,
    isGST: client.isGST,
    gstNumber: client.gstNumber,
    gstRate: client.gstRate,
    discountPercent: (client as { discountPercent?: number | null }).discountPercent ?? null,
    accountManager: client.User
      ? {
          id: client.User.id,
          name: client.User.name,
        }
      : null,
  }))
}

export async function updateClientInvoice(
  clientId: string,
  data: {
    startDate?: Date | null
    endDate?: Date | null
    monthlyAmount?: number | null
    planDuration?: InvoicePlanDuration | null
    nextPaymentDate?: Date | null
    lastPaymentDate?: Date | null
    isGST?: boolean
    gstNumber?: string | null
    gstRate?: number | null
    discountPercent?: number | null
  }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can update invoices')
  }

  // Auto-calculate end date based on plan duration and start date
  let finalData = { ...data }
  
  if (data.planDuration && data.startDate && !data.endDate) {
    const startDate = new Date(data.startDate)
    let monthsToAdd = 0
    
    switch (data.planDuration) {
      case 'ONE_MONTH':
        monthsToAdd = 1
        break
      case 'THREE_MONTHS':
        monthsToAdd = 3
        break
      case 'SIX_MONTHS':
        monthsToAdd = 6
        break
    }
    
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + monthsToAdd)
    finalData.endDate = endDate
  }

  await prisma.client.update({
    where: { id: clientId },
    data: finalData,
  })
}

export async function markPaymentAsReceived(clientId: string) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can mark payments as received')
  }

  // Get current client data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      planDuration: true,
      monthlyAmount: true,
    },
  })

  if (!client) {
    throw new Error('Client not found')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate next payment date based on plan duration
  let nextPaymentDate: Date | null = null
  if (client.planDuration) {
    const nextDate = new Date(today)
    let monthsToAdd = 0
    
    switch (client.planDuration) {
      case 'ONE_MONTH':
        monthsToAdd = 1
        break
      case 'THREE_MONTHS':
        monthsToAdd = 3
        break
      case 'SIX_MONTHS':
        monthsToAdd = 6
        break
    }
    
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd)
    nextPaymentDate = nextDate
  }

  // Update client with payment received
  await prisma.client.update({
    where: { id: clientId },
    data: {
      lastPaymentDate: today,
      nextPaymentDate: nextPaymentDate,
    },
  })
}

export async function sendInvoiceToClient(clientId: string) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can send invoices')
  }

  // Get client data with invoice information
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
      phoneWhatsApp: true,
      phonePrimary: true,
      email: true,
      addressLine: true,
      city: true,
      pincode: true,
      monthlyAmount: true,
      planDuration: true,
      startDate: true,
      endDate: true,
      nextPaymentDate: true,
      services: true,
      isGST: true,
      gstNumber: true,
      gstRate: true,
      User: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!client) {
    throw new Error('Client not found')
  }

  if (!client.monthlyAmount || !client.nextPaymentDate) {
    throw new Error('Invoice information is incomplete. Please add monthly amount and next payment date.')
  }

  if (!client.phoneWhatsApp && !client.email) {
    throw new Error('Client does not have WhatsApp number or email. Please add contact information.')
  }

  // Generate invoice number (format: INV-YYYYMMDD-XXXX)
  const today = new Date()
  const invoiceNumber = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${clientId.substring(0, 4).toUpperCase()}`

  // Get company details from environment variables
  const companyName = process.env.COMPANY_NAME || 'TechDR'
  const companyAddress = process.env.COMPANY_ADDRESS || ''
  const companyGSTNumber = process.env.COMPANY_GST_NUMBER || ''
  const companyGSTRate = parseFloat(process.env.COMPANY_GST_RATE || '18')
  const logoUrl = process.env.COMPANY_LOGO_URL || '/logo.png' // Default logo path

  // Generate PDF invoice
  const pdfBytes = await generateInvoicePDF({
    invoiceNumber,
    clientName: client.name,
    doctorOrHospitalName: client.doctorOrHospitalName,
    address: client.addressLine || undefined,
    city: client.city || undefined,
    pincode: client.pincode || undefined,
    email: client.email || undefined,
    phone: client.phonePrimary || client.phoneWhatsApp || undefined,
    monthlyAmount: client.monthlyAmount,
    planDuration: client.planDuration,
    startDate: client.startDate,
    endDate: client.endDate,
    dueDate: client.nextPaymentDate,
    services: client.services.length > 0 ? client.services : undefined,
    accountManagerName: client.User?.name || undefined,
    // GST fields
    isGST: client.isGST || false,
    clientGSTNumber: client.gstNumber || undefined,
    clientGSTRate: client.gstRate || undefined,
    companyGSTNumber: companyGSTNumber || undefined,
    companyGSTRate: companyGSTRate || undefined,
    // Logo and company info
    logoUrl: logoUrl || undefined,
    companyName: companyName || undefined,
    companyAddress: companyAddress || undefined,
  })

  // Upload PDF to storage
  const storage = getStorageAdapter()
  const pdfBuffer = Buffer.from(pdfBytes)
  const filename = `invoice-${invoiceNumber}.pdf`
  const storageKey = await storage.upload(pdfBuffer, filename, 'application/pdf')
  
  // Get public URL for the PDF
  let pdfUrl: string
  try {
    pdfUrl = await storage.getUrl(storageKey)
    
    // If using local storage, make it a full URL
    if (pdfUrl.startsWith('/')) {
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      pdfUrl = `${baseUrl}${pdfUrl}`
    }
  } catch (error) {
    console.error('Failed to get PDF URL, using API route:', error)
    // Fallback to API route
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    pdfUrl = `${baseUrl}/api/invoices/${clientId}/pdf`
  }

  // Send invoice via WhatsApp if available
  if (client.phoneWhatsApp) {
    const message = formatInvoiceMessage(
      client.name,
      client.doctorOrHospitalName,
      invoiceNumber,
      client.monthlyAmount,
      client.nextPaymentDate,
      client.planDuration,
      client.startDate,
      client.endDate,
      client.services
    )

    const templateVariables = getInvoiceTemplateVariables(
      client.name,
      client.doctorOrHospitalName,
      invoiceNumber,
      client.monthlyAmount,
      client.nextPaymentDate,
      client.planDuration,
      client.startDate,
      client.endDate
    )

    const result = await sendWhatsAppNotification(
      client.phoneWhatsApp,
      message,
      templateVariables,
      true, // Force freeform for invoice
      undefined, // templateSid
      pdfUrl, // mediaUrl
      'application/pdf' // mediaType
    )

    if (!result.success) {
      throw new Error(`Failed to send invoice via WhatsApp: ${result.error}`)
    }

    return {
      success: true,
      method: 'whatsapp',
      invoiceNumber,
      messageId: result.messageId,
      pdfUrl,
    }
  }

  // If no WhatsApp, throw error (email can be added later)
  throw new Error('WhatsApp number not found. Please add client WhatsApp number to send invoice.')
}
