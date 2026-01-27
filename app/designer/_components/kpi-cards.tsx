import { MonthOverview } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface KpiCardsProps {
  overview: MonthOverview
  loading?: boolean
}

function KpiCard({
  label,
  value,
  sublabel,
}: {
  label: string
  value: number
  sublabel?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}

export function KpiCards({ overview, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <KpiCard label="Total Clients" value={overview.totalClients} />
      <KpiCard
        label="Expected Creatives"
        value={overview.expected}
        sublabel="Sum of monthly targets"
      />
      <KpiCard label="Designed" value={overview.designed} />
      <KpiCard label="Approved" value={overview.approved} />
      <KpiCard label="Scheduled" value={overview.scheduled} />
    </div>
  )
}

