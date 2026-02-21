import React from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DateRangePicker({ dateRange, setDateRange }) {
  const presets = [
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
    { label: "60 dias", days: 60 },
    { label: "90 dias", days: 90 }
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        {presets.map(preset => (
          <Button
            key={preset.days}
            variant="outline"
            size="sm"
            className={`text-xs ${
              Math.round((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24)) === preset.days - 1
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : ""
            }`}
            onClick={() => setDateRange({
              from: subDays(new Date(), preset.days - 1),
              to: new Date()
            })}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-xs">
              {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={(range) => range && setDateRange(range)}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}