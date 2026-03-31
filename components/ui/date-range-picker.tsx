'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DateRangePickerProps {
  dateRange?: { from?: Date; to?: Date }
  onSelect?: (range: { from?: Date; to?: Date } | undefined) => void
  className?: string
  disabled?: boolean
}

const QUICK_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Custom Range', value: 'custom' },
  { label: 'Clear', value: 'clear' },
]

export function DateRangePicker({
  dateRange,
  onSelect,
  className,
  disabled,
}: DateRangePickerProps) {
  const [selectedFilter, setSelectedFilter] = React.useState<string>('')
  const [isOpen, setIsOpen] = React.useState(false)
  const [startDate, setStartDate] = React.useState<Date | null>(dateRange?.from || null)
  const [endDate, setEndDate] = React.useState<Date | null>(dateRange?.to || null)

  React.useEffect(() => {
    setStartDate(dateRange?.from || null)
    setEndDate(dateRange?.to || null)
  }, [dateRange])

  const getDateRangeForFilter = (filter: string): { from?: Date; to?: Date } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    switch (filter) {
      case 'today': {
        return { from: today, to: today }
      }
      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return { from: yesterday, to: yesterday }
      }
      case 'last7days': {
        const last7Days = new Date(today)
        last7Days.setDate(last7Days.getDate() - 6)
        return { from: last7Days, to: today }
      }
      case 'last30days': {
        const last30Days = new Date(today)
        last30Days.setDate(last30Days.getDate() - 29)
        return { from: last30Days, to: today }
      }
      case 'thisWeek': {
        const startOfWeek = new Date(today)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        return { from: startOfWeek, to: today }
      }
      case 'lastWeek': {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1)
        const startOfLastWeek = new Date(today)
        startOfLastWeek.setDate(diff - 7)
        const endOfLastWeek = new Date(startOfLastWeek)
        endOfLastWeek.setDate(endOfLastWeek.getDate() + 6)
        return { from: startOfLastWeek, to: endOfLastWeek }
      }
      case 'thisMonth': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        return { from: startOfMonth, to: today }
      }
      case 'lastMonth': {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        return { from: startOfLastMonth, to: endOfLastMonth }
      }
      case 'thisYear': {
        const startOfYear = new Date(today.getFullYear(), 0, 1)
        return { from: startOfYear, to: today }
      }
      default:
        return {}
    }
  }

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value)
    if (value === 'custom') {
      setIsOpen(true)
    } else if (value === 'clear') {
      onSelect?.(undefined)
      setSelectedFilter('')
      setStartDate(null)
      setEndDate(null)
    } else {
      const range = getDateRangeForFilter(value)
      onSelect?.(range)
      setStartDate(range.from || null)
      setEndDate(range.to || null)
    }
  }

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates
    setStartDate(start)
    setEndDate(end)
    
    if (start && end) {
      onSelect?.({ from: start, to: end })
      setIsOpen(false)
      setSelectedFilter('custom')
    }
  }

  const displayText = React.useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) {
      return 'Select date range'
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM dd, yyyy')}`
    }
    return 'Select date range'
  }, [dateRange])

  return (
    <div className={cn('flex flex-col sm:flex-row gap-2', className)}>
      <Select value={selectedFilter} onValueChange={handleFilterChange} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Quick filters" />
        </SelectTrigger>
        <SelectContent>
          {QUICK_FILTERS.map((filter) => (
            <SelectItem key={filter.value} value={filter.value}>
              {filter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <div className="relative flex-1">
        <Button
          variant="outline"
          className={cn(
            'w-full sm:w-[300px] justify-start text-left font-normal',
            (!dateRange?.from && !dateRange?.to) && 'text-muted-foreground'
          )}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
        {isOpen && (
          <div className="absolute z-50 mt-1 bg-white border rounded-md shadow-lg">
            <ReactDatePicker
              selected={startDate}
              onChange={handleDateChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              inline
              calendarClassName="!border-0 !shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}
