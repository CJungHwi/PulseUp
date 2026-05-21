import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

interface MonthInputProps {
  value?: string; // "YYYY-MM"
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  placeholder?: string;
}

export function MonthInput({ value, onChange, className, placeholder = "년-월 선택" }: MonthInputProps) {
  const [open, setOpen] = React.useState(false);

  // 현재 선택된 날짜 (기본값: 오늘)
  const currentVal = value ? dayjs(`${value}-01`) : dayjs();
  const [viewDate, setViewDate] = React.useState(currentVal);

  const months = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월"
  ];

  const handleYearChange = (offset: number) => {
    setViewDate(viewDate.add(offset, 'year'));
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newValue = viewDate.month(monthIndex).format("YYYY-MM");
    if (onChange) {
      onChange({ target: { value: newValue } });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card hover:bg-muted/50 transition-colors",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? dayjs(`${value}-01`).format("YYYY년 MM월") : placeholder}
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 border-[#343637] dark:border-[#6b7280] bg-card shadow-xl" align="start">
        <div className="flex flex-col space-y-4">
          {/* Year Selector */}
          <div className="flex items-center justify-between px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleYearChange(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-bold">
              {viewDate.format("YYYY년")}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleYearChange(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isSelected = value === viewDate.month(index).format("YYYY-MM");
              const isCurrentMonth = dayjs().format("YYYY-MM") === viewDate.month(index).format("YYYY-MM");

              return (
                <Button
                  key={month}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs font-medium transition-all",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !isSelected && isCurrentMonth && "border border-primary/50 text-primary",
                    !isSelected && "hover:bg-muted"
                  )}
                  onClick={() => handleMonthSelect(index)}
                >
                  {month}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


