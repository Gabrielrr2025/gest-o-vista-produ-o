import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus, Minus, Calendar as CalendarIcon } from "lucide-react";
import { format, getYear, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, getWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CalendarEventDialog from '../components/calendar/CalendarEventDialog';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const EVENT_COLORS = {
  "Feriado Nacional": "bg-[#DC2626]",
  "Feriado Regional": "bg-[#F59E0B]",
  "Evento Especial": "bg-[#FBBF24]",
  "Alta Demanda": "bg-[#3B82F6]",
  "Observação": "bg-[#10B981]"
};

export default function Calendar() {
  const [currentYear, setCurrentYear] = useState(getYear(new Date()));
  const [zoom, setZoom] = useState(0.85);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const queryClient = useQueryClient();
  
  // Carregar feriados automaticamente ao mudar de ano
  React.useEffect(() => {
    loadHolidays();
  }, [currentYear]);

  const { data: events = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const loadHolidays = async () => {

  const removeDuplicates = async () => {
    try {
      // Agrupar eventos por data + nome (case insensitive)
      const eventMap = new Map();
      events.forEach(event => {
        const key = `${event.date}-${event.name.toLowerCase()}`;
        if (!eventMap.has(key)) {
          eventMap.set(key, []);
        }
        eventMap.get(key).push(event);
      });

      // Encontrar duplicados (grupos com mais de 1 evento)
      const duplicates = Array.from(eventMap.values())
        .filter(group => group.length > 1)
        .flat();

      if (duplicates.length === 0) {
        toast.info("Nenhum evento duplicado encontrado");
        return;
      }

      // Para cada grupo de duplicados, manter só o primeiro
      const toDelete = [];
      eventMap.forEach((group) => {
        if (group.length > 1) {
          // Ordenar por ID (manter o mais antigo)
          group.sort((a, b) => a.id - b.id);
          // Deletar todos exceto o primeiro
          toDelete.push(...group.slice(1));
        }
      });

      if (toDelete.length === 0) {
        toast.info("Nenhum evento duplicado encontrado");
        return;
      }

      const confirmDelete = confirm(`Encontrados ${toDelete.length} eventos duplicados. Deseja removê-los?`);
      if (!confirmDelete) return;

      // Deletar duplicados
      await Promise.all(
        toDelete.map(event => base44.entities.CalendarEvent.delete(event.id))
      );

      queryClient.invalidateQueries(['calendarEvents']);
      toast.success(`${toDelete.length} eventos duplicados removidos`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover duplicados");
    }
  };

  const loadHolidays = async () => {
    try {
      setLoadingHolidays(true);
      toast.info("Buscando feriados...");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Liste TODOS os feriados brasileiros (nacionais, estaduais do RJ e municipais de Itaperuna/RJ) para o ano ${currentYear}. 
        
        Para cada feriado, retorne:
        - name: nome do feriado
        - date: data no formato YYYY-MM-DD
        - type: "Feriado Nacional" para feriados nacionais, "Feriado Regional" para estaduais/municipais
        - impact_percentage: 0 (será ajustado pelo usuário depois)
        
        IMPORTANTE: Retorne a data exata. Carnaval e Corpus Christi são móveis, calcule as datas corretas para ${currentYear}.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            holidays: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  date: { type: "string" },
                  type: { type: "string" },
                  impact_percentage: { type: "number" }
                }
              }
            }
          }
        }
      });

      const holidays = response.holidays || [];
      
      // Filtrar feriados que já existem no banco (por nome E data)
      const newHolidays = holidays.filter(holiday => {
        const exists = events.some(event => 
          event.date === holiday.date && 
          event.name.toLowerCase() === holiday.name.toLowerCase()
        );
        return !exists;
      });

      if (newHolidays.length === 0) {
        toast.info("Todos os feriados já estão cadastrados");
        return;
      }

      console.log(`📅 Adicionando ${newHolidays.length} novos feriados:`, newHolidays.map(h => `${h.name} (${h.date})`));

      // Criar os novos feriados
      await Promise.all(
        newHolidays.map(holiday => 
          base44.entities.CalendarEvent.create({
            name: holiday.name,
            date: holiday.date,
            type: holiday.type,
            impact_percentage: holiday.impact_percentage || 0,
            sector: 'Todos',
            notes: 'Feriado carregado automaticamente'
          })
        )
      );

      queryClient.invalidateQueries(['calendarEvents']);
      toast.success(`${newHolidays.length} feriados adicionados ao calendário`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar feriados");
    } finally {
      setLoadingHolidays(false);
    }
  };

  const yearEvents = events.filter(e => {
    const eventDate = parseISO(e.date);
    return getYear(eventDate) === currentYear;
  });

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.15, 1.5));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.15, 0.5));

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
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            {MONTHS[monthIndex]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, idx) => (
              <div key={idx} className="text-[10px] font-semibold text-slate-500 py-0.5">
                {day}
              </div>
            ))}
            {emptyDays.map((_, idx) => (
              <div key={`empty-${idx}`} className="w-6 h-6" />
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <TooltipProvider key={day.toISOString()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          w-6 h-6 flex flex-col items-center justify-center text-[11px] rounded cursor-pointer
                          transition-all duration-100
                          ${hasEvents 
                            ? 'font-bold bg-slate-50 hover:bg-slate-200 hover:ring-2 hover:ring-slate-300' 
                            : 'text-slate-600 hover:bg-slate-100'
                          }
                        `}
                        onClick={() => {
                          if (hasEvents) {
                            setSelectedEvent(dayEvents[0]);
                          } else {
                            setSelectedEvent(null);
                            setSelectedDate(format(day, 'yyyy-MM-dd'));
                          }
                          setShowDialog(true);
                        }}
                      >
                        <span className="leading-none">{format(day, "d")}</span>
                        {hasEvents && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 2).map((event, idx) => (
                              <div
                                key={idx}
                                className={`w-1 h-1 rounded-full ${EVENT_COLORS[event.type] || 'bg-slate-400'}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    {hasEvents && (
                     <TooltipContent 
                       side="top" 
                       className="max-w-xs bg-slate-800 text-white border-0 shadow-xl px-3 py-2"
                     >
                       <div className="space-y-2">
                         {dayEvents.map((event, idx) => (
                           <div key={idx} className="space-y-0.5">
                             <p className="font-semibold text-sm">{event.name}</p>
                             <p className="text-xs text-slate-300">{event.type}</p>
                             {event.impact_percentage !== 0 && (
                               <p className="text-xs text-slate-300">
                                 Impacto: {event.impact_percentage > 0 ? '+' : ''}{event.impact_percentage}%
                               </p>
                             )}
                             {event.notes && (
                               <p className="text-xs text-slate-400 border-t border-slate-600 pt-1 mt-1">{event.notes}</p>
                             )}
                           </div>
                         ))}
                       </div>
                     </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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
            setSelectedDate(null);
            setShowDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Evento
          </Button>

          {/* Remover Duplicados */}
          <Button 
            variant="outline"
            onClick={removeDuplicates}
            title="Remove eventos duplicados (mesmo nome e data)"
          >
            🗑️ Limpar Duplicados
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
              <div className="w-3 h-3 rounded-full bg-[#DC2626]" />
              <span className="text-slate-700">Feriado Nacional</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <span className="text-slate-700">Feriado Regional/Local</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FBBF24]" />
              <span className="text-slate-700">Evento Especial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
              <span className="text-slate-700">Período de Alta Demanda</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981]" />
              <span className="text-slate-700">Observação Personalizada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Evento */}
      {showDialog && (
        <CalendarEventDialog
          event={selectedEvent}
          initialDate={selectedDate}
          onClose={() => {
            setShowDialog(false);
            setSelectedEvent(null);
            setSelectedDate(null);
          }}
          onSave={() => {
            setShowDialog(false);
            setSelectedEvent(null);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
}
