import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { format, getYear, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import CalendarEventDialog from '../components/calendar/CalendarEventDialog';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const EVENT_COLORS = {
  "Feriado Nacional": "bg-red-500",
  "Feriado Regional": "bg-orange-500",
  "Evento Especial": "bg-yellow-500",
  "Alta Demanda": "bg-blue-500",
  "Observação": "bg-green-500"
};

export default function Calendar() {
  const [currentYear, setCurrentYear] = useState(getYear(new Date()));
  const [zoom, setZoom] = useState(1); // 0.8, 1, 1.2
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const { data: events = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const yearEvents = events.filter(e => {
    const eventDate = parseISO(e.date);
    return getYear(eventDate) === currentYear;
  });

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 1.4));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.6));

  const getEventsForDay = (date) => {
    return yearEvents.filter(e => isSameDay(parseISO(e.date), date));
  };

  const renderMonth = (monthIndex) => {
    const monthDate = new Date(currentYear, monthIndex, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const firstDayOfWeek = getDay(monthStart);
    const emptyDays = Array(firstDayOfWeek).fill(null);

    return (
      <Card key={monthIndex} className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800">
            {MONTHS[monthIndex]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, idx) => (
              <div key={idx} className="text-xs font-semibold text-slate-500 py-1">
                {day}
              </div>
            ))}
            {emptyDays.map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    aspect-square flex flex-col items-center justify-center text-xs rounded
                    ${hasEvents ? 'font-bold cursor-pointer hover:bg-slate-100' : 'text-slate-600'}
                  `}
                  onClick={() => {
                    if (hasEvents) {
                      setSelectedEvent(dayEvents[0]);
                      setShowDialog(true);
                    }
                  }}
                >
                  <span>{format(day, "d")}</span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full ${EVENT_COLORS[event.type] || 'bg-slate-400'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-sm text-slate-500 mt-1">Organize eventos, feriados e períodos especiais</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setCurrentYear(currentYear - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-bold text-slate-900 min-w-[80px] text-center">
              {currentYear}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setCurrentYear(currentYear + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Controles de Zoom */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleZoomOut}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-600 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleZoomIn}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Novo Evento */}
          <Button onClick={() => {
            setSelectedEvent(null);
            setShowDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      {/* GRID DE MESES */}
      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 origin-top-left"
        style={{ transform: `scale(${zoom})` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(month => renderMonth(month))}
      </div>

      {/* LEGENDA */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-700">Feriado Nacional</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-700">Feriado Regional/Local</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-slate-700">Evento Especial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-700">Período de Alta Demanda</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-700">Observação Personalizada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Evento */}
      {showDialog && (
        <CalendarEventDialog
          event={selectedEvent}
          onClose={() => {
            setShowDialog(false);
            setSelectedEvent(null);
          }}
          onSave={() => {
            setShowDialog(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}