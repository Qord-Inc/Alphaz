"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Calendar, ChevronDown } from "lucide-react"

export type DropdownOption = {
  value: string
  label: string
}

interface SimpleDropdownProps {
  options: DropdownOption[]
  value: string
  onChange?: (value: string) => void
  className?: string
}

export function SimpleDropdown({ options, value, onChange, className }: SimpleDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600"
        )}
      >
        <Calendar className="h-4 w-4" />
        {selected.label}
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-lg">
          {options.map(opt => (
            <button
              key={opt.value}
              className={cn(
                "w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700",
                opt.value === value ? "bg-gray-50 dark:bg-gray-700 font-medium" : ""
              )}
              onClick={() => {
                onChange?.(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
