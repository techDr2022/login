'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DatePickerProps {
  date?: Date | null
  onSelect?: (date: Date | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  date,
  onSelect,
  placeholder = 'Pick a date',
  className,
  disabled,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start text-left font-normal',
          !date && 'text-muted-foreground'
        )}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, 'PPP') : <span>{placeholder}</span>}
      </Button>
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border rounded-md shadow-lg">
          <ReactDatePicker
            selected={date || null}
            onChange={(selectedDate: Date | null) => {
              onSelect?.(selectedDate)
              if (selectedDate) {
                setIsOpen(false)
              }
            }}
            inline
            calendarClassName="!border-0 !shadow-none"
          />
        </div>
      )}
    </div>
  )
}
