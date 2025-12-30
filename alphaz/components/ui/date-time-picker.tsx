"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
}

export function DateTimePicker({ date, setDate, placeholder = "Pick a date and time" }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [selectedHour, setSelectedHour] = React.useState<string>(
    date ? format(date, "HH") : "09"
  )
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    date ? format(date, "mm") : "00"
  )

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"))

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      setDate(undefined)
      return
    }

    const updatedDate = new Date(newDate)
    updatedDate.setHours(parseInt(selectedHour))
    updatedDate.setMinutes(parseInt(selectedMinute))
    setSelectedDate(updatedDate)
    setDate(updatedDate)
  }

  const handleTimeChange = (hour: string, minute: string) => {
    if (!selectedDate) {
      const now = new Date()
      now.setHours(parseInt(hour))
      now.setMinutes(parseInt(minute))
      setSelectedDate(now)
      setDate(now)
      return
    }

    const updatedDate = new Date(selectedDate)
    updatedDate.setHours(parseInt(hour))
    updatedDate.setMinutes(parseInt(minute))
    setSelectedDate(updatedDate)
    setDate(updatedDate)
  }

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setSelectedHour(format(date, "HH"))
      setSelectedMinute(format(date, "mm"))
    }
  }, [date])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP 'at' h:mm a")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Select
              value={selectedHour}
              onValueChange={(value) => {
                setSelectedHour(value)
                handleTimeChange(value, selectedMinute)
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm">:</span>
            <Select
              value={selectedMinute}
              onValueChange={(value) => {
                setSelectedMinute(value)
                handleTimeChange(selectedHour, value)
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={minute}>
                    {minute}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
