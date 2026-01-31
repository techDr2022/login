'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface InvoicePreviewPageProps {
  clientId: string
  clientName: string
  doctorOrHospitalName: string
  monthlyAmount: number | null
  nextPaymentDate: Date | null
}

export function InvoicePreviewPage({
  clientId,
  clientName,
  doctorOrHospitalName,
  monthlyAmount,
  nextPaymentDate,
}: InvoicePreviewPageProps) {
  const pdfUrl = `/api/invoices/${clientId}/pdf`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Invoice Preview</h1>
          <p className="text-sm text-muted-foreground">
            Generate and download the PDF invoice for this client
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{doctorOrHospitalName}</CardTitle>
          <CardDescription>{clientName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Monthly Amount</span>
            <span className="font-medium">
              {monthlyAmount != null
                ? `₹${monthlyAmount.toLocaleString('en-IN')}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Next Payment Due</span>
            <span className="font-medium">
              {nextPaymentDate
                ? format(new Date(nextPaymentDate), 'MMM dd, yyyy')
                : '—'}
            </span>
          </div>

          <div className="pt-4 border-t">
            <Button asChild className="w-full sm:w-auto">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF Invoice
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        The invoice is generated on demand. Click the button above to download
        the PDF.
      </p>
    </div>
  )
}
