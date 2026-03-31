import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'
import { InvoicePlanDuration } from '@prisma/client'
import { InvoicePdf, type InvoiceLineItem } from '@/components/invoices/InvoicePdf'

export interface InvoiceLineItemInput {
  description: string
  qty: number
  rate: number
  discountPercent?: number
}

export interface InvoiceData {
  invoiceNumber: string
  clientName: string
  doctorOrHospitalName: string
  address?: string
  area?: string
  city?: string
  pincode?: string
  email?: string
  phone?: string
  monthlyAmount: number
  planDuration: InvoicePlanDuration | null
  startDate: Date | null
  endDate: Date | null
  dueDate: Date
  services?: string[]
  invoiceLineItems?: InvoiceLineItemInput[] | null
  isGST?: boolean
  clientGSTNumber?: string
  clientGSTRate?: number
  companyGSTNumber?: string
  companyGSTRate?: number
  discountPercent?: number | null
  logoUrl?: string
  companyName?: string
  companyAddress?: string
  companyEmail?: string
  companyPhone?: string
  companyPAN?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankIFSC?: string
  bankAccountType?: string
  upiId?: string
  /** Optional static QR image path (e.g. /upi-qr.png). When set, used instead of generating QR. */
  upiQrImageUrl?: string
}

const DEFAULT_TERMS =
  'Please pay within 5 days from the date of invoice. Overdue interest @ 5% will be charged on delayed payments. ' +
  'Services include only items listed in the plan. All shared data and credentials are kept confidential. ' +
  'Thank you for your business.'

async function loadLogoAsDataUrl(logoUrl: string): Promise<string | undefined> {
  if (!logoUrl) return undefined
  try {
    let resolved = logoUrl
    if (logoUrl.startsWith('/')) {
      const logoPath = path.join(process.cwd(), 'public', logoUrl.substring(1))
      if (fs.existsSync(logoPath)) {
        const buffer = fs.readFileSync(logoPath)
        const ext = path.extname(logoPath).toLowerCase()
        const mime = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : ext === '.png' ? 'png' : 'png'
        resolved = `data:image/${mime};base64,${buffer.toString('base64')}`
      }
    }
    if (resolved.startsWith('data:')) return resolved
    return undefined
  } catch {
    return undefined
  }
}

async function generateQrCodeDataUrl(upiUrl: string): Promise<string> {
  return QRCode.toDataURL(upiUrl, {
    type: 'image/png',
    width: 200,
    margin: 2,
  })
}

function buildLineItems(data: InvoiceData): InvoiceLineItem[] {
  const hasGST = Boolean(data.isGST && (data.clientGSTRate ?? data.companyGSTRate ?? 0) > 0)
  const gstRate = data.isGST ? (data.clientGSTRate ?? data.companyGSTRate ?? 18) : 0

  // Use item-wise line items when provided
  if (data.invoiceLineItems && data.invoiceLineItems.length > 0) {
    return data.invoiceLineItems.map((item) => {
      const qty = item.qty || 1
      const grossAmount = item.rate * qty
      const discountPercent = item.discountPercent ?? 0
      const amount = grossAmount * (1 - discountPercent / 100)
      return {
        description: item.description,
        qty,
        rate: item.rate,
        amount: Math.round(amount * 100) / 100,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
      }
    })
  }

  // Fallback: single consolidated line (legacy)
  const parts: string[] = []
  parts.push('Social Media Management & Brand Management')
  if (data.startDate && data.endDate) {
    parts.push(
      `Service Period: ${data.startDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })} to ${data.endDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`
    )
  }
  if (data.services && data.services.length > 0) {
    parts.push(`Services: ${data.services.join(', ')}`)
  }
  if (hasGST) {
    parts.push(`Includes GST @ ${gstRate}%`)
  } else {
    parts.push('Non-GST invoice')
  }
  const description = parts.join('\n')

  return [
    {
      description,
      qty: 1,
      rate: data.monthlyAmount,
      amount: data.monthlyAmount,
    },
  ]
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const hasGST = Boolean(data.isGST && (data.clientGSTRate ?? data.companyGSTRate ?? 0) > 0)
  const gstRate = data.isGST ? (data.clientGSTRate ?? data.companyGSTRate ?? 18) : 0
  const discountPercent = data.discountPercent ?? 0

  let subtotalBeforeDiscount: number
  let discountAmount: number

  if (data.invoiceLineItems && data.invoiceLineItems.length > 0) {
    subtotalBeforeDiscount = data.invoiceLineItems.reduce((sum, item) => {
      return sum + item.rate * (item.qty || 1)
    }, 0)
    const totalAfterItemDiscount = data.invoiceLineItems.reduce((sum, item) => {
      const gross = item.rate * (item.qty || 1)
      const d = (item.discountPercent ?? 0) / 100
      return sum + gross * (1 - d)
    }, 0)
    discountAmount = Math.round((subtotalBeforeDiscount - totalAfterItemDiscount) * 100) / 100
  } else {
    subtotalBeforeDiscount = data.monthlyAmount
    discountAmount = (subtotalBeforeDiscount * discountPercent) / 100
  }

  const subtotal = subtotalBeforeDiscount - discountAmount
  const gstAmount = hasGST ? (subtotal * gstRate) / 100 : 0
  const total = subtotal + gstAmount

  const items = buildLineItems(data)
  const invoiceDate = new Date()
  const payeeName = data.companyName || 'Payee'

  const upiUrl =
    data.upiId && total > 0 && !data.upiQrImageUrl
      ? `upi://pay?pa=${encodeURIComponent(data.upiId)}&pn=${encodeURIComponent(payeeName)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.invoiceNumber)}`
      : ''

  const [logoDataUrl, qrCodeDataUrl] = await Promise.all([
    data.logoUrl ? loadLogoAsDataUrl(data.logoUrl) : Promise.resolve(undefined),
    data.upiQrImageUrl
      ? loadLogoAsDataUrl(data.upiQrImageUrl)
      : upiUrl
        ? generateQrCodeDataUrl(upiUrl)
        : Promise.resolve(undefined),
  ])

  const clientAddress = [data.address, data.area, [data.city, data.pincode].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(', ')

  const pdf = (
    <InvoicePdf
      invoiceNumber={data.invoiceNumber}
      invoiceDate={invoiceDate}
      dueDate={data.dueDate}
      companyName={data.companyName || 'Company'}
      companyAddress={data.companyAddress}
      companyEmail={data.companyEmail}
      companyPhone={data.companyPhone}
      companyGst={data.companyGSTNumber}
      companyPan={data.companyPAN}
      logoUrl={logoDataUrl}
      clientName={data.clientName}
      clientAddress={clientAddress || undefined}
      clientPhone={data.phone}
      clientEmail={data.email}
      clientGst={data.isGST && data.clientGSTNumber ? data.clientGSTNumber : undefined}
      items={items}
      subtotal={subtotalBeforeDiscount}
      gstAmount={gstAmount}
      discountAmount={discountAmount}
      total={total}
      gstRate={hasGST ? gstRate : undefined}
      upiId={data.upiId}
      payeeName={payeeName}
      qrCodeDataUrl={qrCodeDataUrl}
      bankName={data.bankName}
      bankAccountName={data.bankAccountName}
      bankAccountNumber={data.bankAccountNumber}
      bankIFSC={data.bankIFSC}
      bankAccountType={data.bankAccountType}
      notes={DEFAULT_TERMS}
    />
  )

  const buffer = await renderToBuffer(pdf)
  return new Uint8Array(buffer)
}

export async function generateInvoicePDFBase64(data: InvoiceData): Promise<string> {
  const pdfBytes = await generateInvoicePDF(data)
  return Buffer.from(pdfBytes).toString('base64')
}
