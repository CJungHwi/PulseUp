"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { DATE_FORMATS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    date?: Date
    setDate?: (date: Date | undefined) => void
    className?: string
    displayFormat?: string
    iconClassName?: string
    isTextCentered?: boolean
}

export function DatePicker({
    date,
    setDate,
    className,
    displayFormat = DATE_FORMATS.DISPLAY,
    iconClassName,
    isTextCentered = false,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    const handleSelect = (selectedDate: Date | undefined) => {
        if (setDate) {
            setDate(selectedDate)
        }
        // 날짜 선택 시 팝업 닫기
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-[280px] justify-between text-left font-normal",
                        !date && "text-muted-foreground",
                        isTextCentered && "relative justify-center text-center",
                        className
                    )}
                >
                    <span className={cn("flex-1", isTextCentered && "px-6")}>
                        {date ? format(date, displayFormat) : "Pick a date"}
                    </span>
                    <CalendarIcon
                        className={cn(
                            "ml-2 h-4 w-4",
                            isTextCentered && "absolute right-3",
                            iconClassName
                        )}
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
