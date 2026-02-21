import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { format, addWeeks, subWeeks, startOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// Semana começa na terça-feira e termina na segunda-feira
const getWeekBounds = (date) => {
  const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, 2 = terça...
  
  // Calcular quantos dias voltar para chegar na terça anterior
  let daysToTuesday;
  if (dayOfWeek === 0) { // Domingo
    daysToTuesday = 5;
  } else if (dayOfWeek === 1) { // Segunda
    daysToTuesday = 6;
  } else { // Terça (2) até Sábado (6)
    daysToTuesday = dayOfWeek - 2;
  }
  
  const weekStart = subDays(startOfDay(date), daysToTuesday);
  const weekEnd = addDays(weekStart, 6); // 6 dias depois (terça a segunda)
  
  return { start: weekStart, end: weekEnd };
};

const getWeekNumber = (date) => {
  // Primeira terça do ano
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const firstTuesday = yearStart.getDay() <= 2 
    ? addDays(yearStart, 2 - yearStart.getDay()) 
    : addDays(yearStart, 9 - yearStart.getDay());
  
  const weekBounds = getWeekBounds(date);
  const diffTime = weekBounds.start.getTime() - firstTuesday.getTime();
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  
  return diffWeeks + 1;
};

export default function WeekNavigator({ currentDate, onDateChange }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const weekBounds = getWeekBounds(currentDate);
  const weekNumber = getWeekNumber(currentDate);
  
  const handlePrevWeek = () => {
    onDateChange(subWeeks(currentDate, 1));
  };
  
  const handleNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1));
  };
  
  const handleDateSelect = (date) => {
    onDateChange(date);
    setCalendarOpen(false);
  };
  
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePrevWeek}>
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </Button>
      
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="font-semibold text-slate-900">SEMANA {weekNumber}</div>
          <div className="text-xs text-slate-600">
            {format(weekBounds.start, "dd/MM", { locale: ptBR })} a {format(weekBounds.end, "dd/MM", { locale: ptBR })}
          </div>
        </div>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <CalendarIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={handleDateSelect}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <Button variant="outline" size="sm" onClick={handleNextWeek}>
        Próximo
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export { getWeekBounds };