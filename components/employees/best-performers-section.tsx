'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trophy, Calendar, TrendingUp } from 'lucide-react'

interface BestPerformer {
  id: string
  name: string
  email: string
  completedTasks: number
  totalTasks: number
  overdueTasks: number
  performanceScore: number
}

export function BestPerformersSection() {
  const [employeeOfDay, setEmployeeOfDay] = useState<BestPerformer | null>(null)
  const [employeeOfMonth, setEmployeeOfMonth] = useState<BestPerformer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBestPerformers()
  }, [])

  const fetchBestPerformers = async () => {
    setLoading(true)
    try {
      // Fetch employee of the day
      const dayRes = await fetch('/api/admin/performance?period=day')
      const dayData = await dayRes.json()
      setEmployeeOfDay(dayData.bestPerformer)

      // Fetch employee of the month
      const monthRes = await fetch('/api/admin/performance?period=month')
      const monthData = await monthRes.json()
      setEmployeeOfMonth(monthData.bestPerformer)
    } catch (error) {
      console.error('Failed to fetch best performers:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Employee of the Day */}
      <Card className="rounded-xl border shadow-sm bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Employee of the Day
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Best performer today
              </CardDescription>
            </div>
            <Calendar className="h-8 w-8 text-yellow-600 opacity-50" />
          </div>
        </CardHeader>
        <CardContent>
          {employeeOfDay ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-yellow-500">
                  <AvatarFallback className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-lg font-semibold">
                    {getInitials(employeeOfDay.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{employeeOfDay.name}</h3>
                  <p className="text-sm text-muted-foreground">{employeeOfDay.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Completed Tasks</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {employeeOfDay.completedTasks}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Performance Score</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-yellow-600">
                      {employeeOfDay.performanceScore}
                    </p>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Top
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data available for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee of the Month */}
      <Card className="rounded-xl border shadow-sm bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-600" />
                Employee of the Month
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Best performer this month
              </CardDescription>
            </div>
            <Calendar className="h-8 w-8 text-blue-600 opacity-50" />
          </div>
        </CardHeader>
        <CardContent>
          {employeeOfMonth ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-blue-500">
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-lg font-semibold">
                    {getInitials(employeeOfMonth.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{employeeOfMonth.name}</h3>
                  <p className="text-sm text-muted-foreground">{employeeOfMonth.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Completed Tasks</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {employeeOfMonth.completedTasks}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Performance Score</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {employeeOfMonth.performanceScore}
                    </p>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Top
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data available for this month</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

