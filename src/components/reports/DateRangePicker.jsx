import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    label: 'Hoje',
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    }
  },
  {
    label: 'Ontem',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    }
  },
  {
    label: 'Esta Semana',
    getValue: () => {
      const today = new Date();
      return {
        from: startOfWeek(today, { weekStartsOn: 2 }), // Terça
        to: today
      };
    }
  },
  {
    label: 'Semana Passada',
    getValue: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 2 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 2 })
      };
    }
  },
  {
    label: 'Este Mês',
    getValue: () => {
      const today = new Date();
      return {
        from: startOfMonth(today),
        to: today
      };
    }
  },
  {
    label: 'Mês Passado',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth)
      };
    }
  },
  {
    label: 'Últimos 7 dias',
    getValue: () => {
      const today = new Date();
      return {
        from: subDays(today, 7),
        to: today
      };
    }
  },
  {
    label: 'Últimos 30 dias',
    getValue: () => {
      const today = new Date();
      return {
        from: subDays(today, 30),
        to: today
      };
    }
  }
];

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState(value);

  const handlePresetClick = (preset) => {
    const range = preset.getValue();
    setTempRange(range);
    onChange(range);
    setOpen(false);
  };

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onChange(tempRange);
      setOpen(false);
    }
  };

  const handleCancel = () => {
    setTempRange(value);
    setOpen(false);
  };

  const formatDateRange = () => {
    if (!value?.from) return "Selecione o período";
    
    const from = format(value.from, 'dd/MM/yyyy', { locale: ptBR });
    const to = value.to ? format(value.to, 'dd/MM/yyyy', { locale: ptBR }) : from;
    
    return `${from} - ${to}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          {/* Atalhos */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Atalhos Rápidos:</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Calendários */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Ou escolha as datas:</p>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={2}
              locale={ptBR}
              className="border rounded-md"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              size="sm" 
              onClick={handleApply}
              disabled={!tempRange?.from || !tempRange?.to}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
