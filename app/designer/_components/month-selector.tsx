'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MonthSelectorProps {
  monthKey: string
  onMonthChange: (monthKey: string) => void
}

function addMonths(base: string, offset: number): string {
  const [yearStr, monthStr] = base.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const date = new Date(year, month + offset, 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const date = new Date(year, month, 1)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function MonthSelector({ monthKey, onMonthChange }: MonthSelectorProps) {
  const currentMonthKey = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })()

  const nextMonthKey = addMonths(currentMonthKey, 1)

  const handleQuickToggle = (target: 'current' | 'next') => {
    onMonthChange(target === 'current' ? currentMonthKey : nextMonthKey)
  }

  const handlePrev = () => {
    onMonthChange(addMonths(monthKey, -1))
  }

  const handleNext = () => {
    onMonthChange(addMonths(monthKey, 1))
  }

  const options = []
  for (let offset = -3; offset <= 3; offset++) {
    const key = addMonths(currentMonthKey, offset)
    options.push(key)
  }

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePrev}>
          <span className="sr-only">Previous month</span>
          ‹
        </Button>
        <Select value={monthKey} onValueChange={onMonthChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {options.map((key) => (
              <SelectItem key={key} value={key}>
                {formatMonthLabel(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleNext}>
          <span className="sr-only">Next month</span>
          ›
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={monthKey === currentMonthKey ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickToggle('current')}
        >
          Current Month
        </Button>
        <Button
          variant={monthKey === nextMonthKey ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickToggle('next')}
        >
          Next Month
        </Button>
      </div>
    </div>
  )
}

