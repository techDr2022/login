export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <LayoutWrapper>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Reports</h2>
            <p className="text-sm text-muted-foreground">
              Overview of key metrics. Filters are placeholders for now.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select defaultValue="this-month">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="last-month">Last month</SelectItem>
                <SelectItem value="q1">Quarter to date</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="ops">Operations</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">Export CSV</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Active tasks</p>
            <p className="mt-2 text-2xl font-semibold">128</p>
            <p className="text-xs text-muted-foreground">+12 vs last period</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Completed this month</p>
            <p className="mt-2 text-2xl font-semibold">342</p>
            <p className="text-xs text-muted-foreground">On track</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Client approvals</p>
            <p className="mt-2 text-2xl font-semibold">87%</p>
            <p className="text-xs text-muted-foreground">Avg approval rate</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Average SLA</p>
            <p className="mt-2 text-2xl font-semibold">14h</p>
            <p className="text-xs text-muted-foreground">Resolution time</p>
          </Card>
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Recent performance</h3>
              <p className="text-sm text-muted-foreground">
                Sample data for illustration. Replace with live metrics.
              </p>
            </div>
            <Button size="sm" variant="outline">Refresh</Button>
          </div>
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Tasks done</TableHead>
                  <TableHead>Avg SLA</TableHead>
                  <TableHead>Approvals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { team: 'Marketing', done: 120, sla: '12h', approvals: '90%' },
                  { team: 'Design', done: 86, sla: '16h', approvals: '82%' },
                  { team: 'Operations', done: 136, sla: '14h', approvals: '88%' },
                ].map((row) => (
                  <TableRow key={row.team}>
                    <TableCell className="font-medium">{row.team}</TableCell>
                    <TableCell>{row.done}</TableCell>
                    <TableCell>{row.sla}</TableCell>
                    <TableCell>{row.approvals}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </LayoutWrapper>
  )
}


