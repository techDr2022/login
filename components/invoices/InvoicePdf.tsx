import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

// Use built-in Helvetica for consistent typography if font fetch fails
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  companySection: {
    flex: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 1.5,
    marginBottom: 2,
  },
  companyMeta: {
    fontSize: 11,
    color: '#475569',
  },
  invoiceTitleSection: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 8,
  },
  invoiceMeta: {
    fontSize: 11,
    color: '#475569',
  },
  billToSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  billToContent: {
    fontSize: 12,
    lineHeight: 1.6,
  },
  billToName: {
    fontWeight: 600,
    marginBottom: 4,
  },
  billToAddress: {
    marginBottom: 2,
  },
  billToContact: {
    marginBottom: 2,
    color: '#475569',
  },
  billToGst: {
    marginTop: 4,
  },
  table: {
    marginTop: 4,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  colDesc: { width: 300, flexShrink: 0 },
  colQty: { width: 48, textAlign: 'right' },
  colRate: { width: 85, textAlign: 'right' },
  colAmount: { width: 90, textAlign: 'right' },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 600,
    color: '#334155',
  },
  tableCellText: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  descMultiLine: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  totalsSection: {
    marginLeft: 'auto',
    width: 220,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  totalsLabel: {
    fontSize: 12,
  },
  totalsValue: {
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  paymentSection: {
    marginBottom: 16,
  },
  paymentSectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  paymentText: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a',
  },
  upiId: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
  },
  bankDetailsLine: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 2,
  },
  bankDetailsLineBold: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 2,
    fontWeight: 600,
  },
  qrWrapper: {
    width: 90,
    height: 90,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
  },
  footerTermsTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerNotes: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  footerThanks: {
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
  },
  paymentHint: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  continuationHeader: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
})

export interface InvoiceLineItem {
  description: string
  qty: number
  rate: number
  amount: number
  discountPercent?: number
}

export interface InvoicePdfProps {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  companyName: string
  companyAddress?: string
  companyEmail?: string
  companyPhone?: string
  companyGst?: string
  companyPan?: string
  logoUrl?: string
  clientName: string
  clientAddress?: string
  clientPhone?: string
  clientEmail?: string
  clientGst?: string
  items: InvoiceLineItem[]
  subtotal: number
  gstAmount: number
  discountAmount: number
  total: number
  gstRate?: number
  upiId?: string
  payeeName: string
  qrCodeDataUrl?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankIFSC?: string
  bankAccountType?: string
  notes?: string
}

const ITEMS_PER_PAGE = 15

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function InvoicePdf(props: InvoicePdfProps) {
  const {
    invoiceNumber,
    invoiceDate,
    dueDate,
    companyName,
    companyAddress,
    companyEmail,
    companyPhone,
    companyGst,
    companyPan,
    logoUrl,
    clientName,
    clientAddress,
    clientPhone,
    clientEmail,
    clientGst,
    items,
    subtotal,
    gstAmount,
    discountAmount,
    total,
    gstRate,
    upiId,
    payeeName,
    qrCodeDataUrl,
    bankName,
    bankAccountName,
    bankAccountNumber,
    bankIFSC,
    bankAccountType,
    notes,
  } = props

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1

  const renderItemsTable = (pageIndex: number) => {
    const start = pageIndex * ITEMS_PER_PAGE
    const pageItems = items.slice(start, start + ITEMS_PER_PAGE)
    const isContinuation = pageIndex > 0

    return (
      <View style={styles.table}>
        {isContinuation && (
          <Text style={styles.continuationHeader}>
            Invoice #{invoiceNumber} — Items (continued from previous page)
          </Text>
        )}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colRate]}>Rate</Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
        </View>
        {pageItems.map((item, i) => (
          <View key={start + i} style={styles.tableRow}>
            <View style={styles.colDesc}>
              {(typeof item.description === 'string' ? item.description.split('\n') : [item.description]).map(
                (line, j) => (
                  <Text key={j} style={[styles.descMultiLine, j > 0 ? { marginTop: 4 } : {}]}>
                    {line}
                  </Text>
                )
              )}
            </View>
            <Text style={[styles.tableCellText, styles.colQty]}>{item.qty}</Text>
            <Text style={[styles.tableCellText, styles.colRate]}>{formatCurrency(item.rate)}</Text>
            <Text style={[styles.tableCellText, styles.colAmount]}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>
    )
  }

  const renderTotals = () => (
    <View style={styles.totalsSection}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue}>{formatCurrency(subtotal)}</Text>
      </View>
      {discountAmount > 0 && (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Discount</Text>
          <Text style={styles.totalsValue}>-{formatCurrency(discountAmount)}</Text>
        </View>
      )}
      {gstAmount > 0 && (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>GST{gstRate ? ` (${gstRate}%)` : ''}</Text>
          <Text style={styles.totalsValue}>{formatCurrency(gstAmount)}</Text>
        </View>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
    </View>
  )

  const hasUpi = Boolean(upiId)
  const hasBank = Boolean(bankAccountNumber || bankAccountName || bankName || bankIFSC)

  const renderPayment = () => (
    <View style={styles.paymentSection}>
      <Text style={styles.paymentSectionTitle}>Payment Options</Text>

      {hasUpi && (
        <View style={styles.paymentOption}>
          <View style={styles.paymentText}>
            <Text style={styles.paymentLabel}>Option 1: Pay via UPI</Text>
            <Text style={styles.upiId}>{upiId}</Text>
            <Text style={styles.paymentHint}>Scan QR code or use UPI ID in any UPI app</Text>
          </View>
          {qrCodeDataUrl && (
            <View style={styles.qrWrapper}>
              <Image src={qrCodeDataUrl} style={{ width: 90, height: 90 }} />
            </View>
          )}
        </View>
      )}

      {hasBank && (
        <View style={styles.paymentOption}>
          <View style={styles.paymentText}>
            <Text style={styles.paymentLabel}>Option 2: Bank Transfer (NEFT/IMPS/RTGS)</Text>
            {bankAccountName && (
              <Text style={styles.bankDetailsLine}>Account Name: {bankAccountName}</Text>
            )}
            {bankAccountNumber && (
              <Text style={styles.bankDetailsLine}>Account Number: {bankAccountNumber}</Text>
            )}
            {bankName && <Text style={styles.bankDetailsLine}>Bank: {bankName}</Text>}
            {bankIFSC && <Text style={styles.bankDetailsLineBold}>IFSC: {bankIFSC}</Text>}
            {bankAccountType && bankAccountType !== 'Current' && (
              <Text style={styles.bankDetailsLine}>Account Type: {bankAccountType}</Text>
            )}
          </View>
        </View>
      )}

      {!hasUpi && !hasBank && (
        <View style={styles.paymentOption}>
          <Text style={styles.paymentValue}>Payment details to be shared separately.</Text>
        </View>
      )}
    </View>
  )

  const renderFooter = () => (
    <View style={styles.footer} fixed>
      {notes && (
        <>
          <Text style={styles.footerTermsTitle}>Terms and Conditions</Text>
          <Text style={styles.footerNotes}>{notes}</Text>
        </>
      )}
      <Text style={styles.footerThanks}>Thank you for your business.</Text>
    </View>
  )

  return (
    <Document>
      {Array.from({ length: totalPages }).map((_, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.companySection}>
              {logoUrl && (
                <Image
                  src={logoUrl}
                  style={{ width: 48, height: 48, marginBottom: 8 }}
                />
              )}
              <Text style={styles.companyName}>{companyName}</Text>
              {companyAddress && (
                <Text style={styles.companyAddress}>{companyAddress}</Text>
              )}
              <Text style={styles.companyMeta}>
                {[companyEmail, companyPhone, companyGst, companyPan]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>
            <View style={styles.invoiceTitleSection}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              {gstAmount === 0 && (
                <Text style={styles.invoiceMeta}>Non-GST</Text>
              )}
              <Text style={styles.invoiceMeta}>#{invoiceNumber}</Text>
              <Text style={styles.invoiceMeta}>Date: {formatDate(invoiceDate)}</Text>
              <Text style={styles.invoiceMeta}>Due: {formatDate(dueDate)}</Text>
            </View>
          </View>

          {/* Bill To */}
          <View style={styles.billToSection}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <View style={styles.billToContent}>
              <Text style={styles.billToName}>{clientName}</Text>
              <Text style={styles.billToAddress}>{clientAddress || '—'}</Text>
              <Text style={styles.billToContact}>
                {[clientPhone, clientEmail].filter(Boolean).join(' • ') || '—'}
              </Text>
              {clientGst && <Text style={styles.billToGst}>GSTIN: {clientGst}</Text>}
            </View>
          </View>

          {/* Items table (paginated) */}
          {renderItemsTable(pageIndex)}

          {/* Totals + Payment only on first page */}
          {pageIndex === 0 && (
            <>
              {renderTotals()}
              {renderPayment()}
            </>
          )}

          {renderFooter()}
        </Page>
      ))}
    </Document>
  )
}
