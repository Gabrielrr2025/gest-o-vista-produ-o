import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft, ChevronRight, Plus, Minus, CalendarDays,
  Trash2, AlertTriangle, RefreshCw, Sparkles
} from "lucide-react";
import { format, getYear, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CalendarEventDialog from '../components/calendar/CalendarEventDialog';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const EVENT_COLORS = {
  "Feriado Nacional": { dot: "bg-red-500",    badge: "bg-red-100 text-red-800 border-red-200"    },
  "Feriado Regional": { dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 border-amber-200" },
  "Evento Especial":  { dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "Alta Demanda":     { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-800 border-blue-200"  },
  "Observação":       { dot: "bg-emerald-500",badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};
const DEFAULT_COLOR = { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-200" };

export default function Calendar() {
  const [currentYear, setCurrentYear]   = useState(getYear(new Date()));
  const [zoom, setZoom]                 = useState(0.85);
  const [showDialog, setShowDialog]     = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [cleaningDups, setCleaningDups] = useState(false);

  const queryClient = useQueryClient();
  // ─── NOTA: removido useEffect que carregava feriados automaticamente.
  // Era a causa das duplicatas (chamado a cada troca de ano).

  const { data: allEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list(),
  });

  // Deduplica os eventos por (date + name) ainda no cliente,
  // garantindo que mesmo duplicatas já no banco não apareçam no UI
  const events = React.useMemo(() => {
    const seen = new Set();
    return allEvents.filter(ev => {
      const key = `${ev.date}__${ev.name.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allEvents]);

  const yearEvents = events.filter(e => getYear(parseISO(e.date)) === currentYear);

  // ─── Carregar feriados (manual, não automático) ────────────────────────────
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
                  name:             { type: "string" },
                  date:             { type: "string" },
                  type:             { type: "string" },
                  impact_percentage:{ type: "number" },
                }
              }
            }
          }
        }
      });

      const holidays = response.holidays || [];

      // 1. Deduplicar a resposta da LLM (pode vir com repetições)
      const uniqueHolidays = [];
      const seenLLM = new Set();
      for (const h of holidays) {
        const key = `${h.date}__${h.name.toLowerCase().trim()}`;
        if (!seenLLM.has(key)) { seenLLM.add(key); uniqueHolidays.push(h); }
      }

      // 2. Filtrar os que já existem no banco (usamos allEvents não dedupados p/ comparação completa)
      const newHolidays = uniqueHolidays.filter(h =>
        !allEvents.some(ev =>
          ev.date === h.date &&
          ev.name.toLowerCase().trim() === h.name.toLowerCase().trim()
        )
      );

      if (newHolidays.length === 0) {
        toast.info("Todos os feriados já estão cadastrados.");
        return;
      }

      await Promise.all(
        newHolidays.map(h =>
          base44.entities.CalendarEvent.create({
            name:             h.name,
            date:             h.date,
            type:             h.type,
            impact_percentage:h.impact_percentage || 0,
            sectors:          ['Todos'],
            notes:            'Feriado carregado automaticamente',
          })
        )
      );

      queryClient.invalidateQueries(['calendarEvents']);
      toast.success(`${newHolidays.length} feriado(s) adicionado(s).`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar feriados.");
    } finally {
      setLoadingHolidays(false);
    }
  };

  // ─── Limpar duplicatas do banco ────────────────────────────────────────────
  const cleanDuplicates = async () => {
    try {
      setCleaningDups(true);
      // Agrupar allEvents por chave (date + name)
      const groups = {};
      for (const ev of allEvents) {
        const key = `${ev.date}__${ev.name.toLowerCase().trim()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(ev);
      }

      // Para cada grupo com mais de 1 evento, apagar os excedentes
      const toDelete = [];
      for (const group of Object.values(groups)) {
        if (group.length > 1) {
          // Mantém o primeiro (ou o que tem mais dados), apaga o resto
          const keep = group.sort((a, b) =>
            (b.notes?.length || 0) - (a.notes?.length || 0)
          )[0];
          group.filter(ev => ev.id !== keep.id).forEach(ev => toDelete.push(ev.id));
        }
      }

      if (toDelete.length === 0) {
        toast.info("Nenhuma duplicata encontrada.");
        return;
      }

      await Promise.all(toDelete.map(id => base44.entities.CalendarEvent.delete(id)));
      queryClient.invalidateQueries(['calendarEvents']);
      toast.success(`${toDelete.length} evento(s) duplicado(s) removido(s).`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar duplicatas.");
    } finally {
      setCleaningDups(false);
    }
  };

  const getEventsForDay = useCallback((date) =>
    yearEvents.filter(e => isSameDay(parseISO(e.date), date)),
  [yearEvents]);

  const hasDuplicates = React.useMemo(() =>
    allEvents.length !== events.length,
  [allEvents, events]);

  // ─── Render de um mês ──────────────────────────────────────────────────────
  const renderMonth = (monthIndex) => {
    const monthDate  = new Date(currentYear, monthIndex, 1);
    const daysInMonth = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    const emptyDays  = Array(getDay(startOfMonth(monthDate))).fill(null);

    return (
      <Card key={monthIndex} className="border-slate-200">
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-sm font-bold text-slate-800">
            {MONTHS[monthIndex]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["D","S","T","Q","Q","S","S"].map((d, i) => (
              <div key={i} className="text-[10px] font-semibold text-slate-400 py-0.5">{d}</div>
            ))}
            {emptyDays.map((_, i) => <div key={`e${i}`} className="w-6 h-6" />)}

            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const hasEvents = dayEvents.length > 0;
              // Cor dominante = tipo do primeiro evento
              const dominantColor = hasEvents
                ? (EVENT_COLORS[dayEvents[0].type] || DEFAULT_COLOR)
                : null;

              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        relative w-6 h-6 flex flex-col items-center justify-center
                        text-[11px] rounded cursor-pointer transition-all duration-100
                        ${hasEvents
                          ? 'font-bold hover:scale-110 hover:shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                        }
                      `}
                      onClick={() => {
                        if (hasEvents) {
                          setSelectedEvent(dayEvents[0]);
                          setSelectedDate(null);
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
                          {dayEvents.slice(0, 3).map((ev, i) => (
                            <div
                              key={i}
                              className={`w-1 h-1 rounded-full ${(EVENT_COLORS[ev.type] || DEFAULT_COLOR).dot}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>

                  {hasEvents && (
                    <TooltipContent
                      side="top"
                      className="p-0 border-0 shadow-2xl rounded-xl overflow-hidden max-w-[240px]"
                    >
                      {/* Cabeçalho do tooltip */}
                      <div className="bg-slate-800 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-200">
                          {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                        {dayEvents.length > 1 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {dayEvents.length} eventos
                          </p>
                        )}
                      </div>

                      {/* Lista de eventos */}
                      <div className="bg-white divide-y divide-slate-100">
                        {dayEvents.map((ev, i) => {
                          const color = EVENT_COLORS[ev.type] || DEFAULT_COLOR;
                          const impacto = parseFloat(ev.impact_percentage ?? 0);
                          return (
                            <div key={i} className="px-3 py-2 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-xs text-slate-800 leading-tight">
                                  {ev.name}
                                </p>
                                {impacto !== 0 && (
                                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color.badge}`}>
                                    {impacto > 0 ? '+' : ''}{impacto}%
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                <span className="text-[10px] text-slate-500">{ev.type}</span>
                                {ev.priority && ev.priority !== 'media' && (
                                  <span className={`text-[10px] font-medium ${
                                    ev.priority === 'alta' ? 'text-red-500' : 'text-emerald-500'
                                  }`}>
                                    · {ev.priority === 'alta' ? 'Alta prioridade' : 'Baixa prioridade'}
                                  </span>
                                )}
                              </div>

                              {ev.sectors && !ev.sectors.includes?.('Todos') && ev.sectors.length > 0 && (
                                <p className="text-[10px] text-slate-400">
                                  Setores: {Array.isArray(ev.sectors) ? ev.sectors.join(', ') : ev.sectors}
                                </p>
                              )}

                              {ev.notes && ev.notes !== 'Feriado carregado automaticamente' && (
                                <p className="text-[10px] text-slate-400 italic">{ev.notes}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Rodapé: dica de clique */}
                      <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 text-center">
                          Clique para editar
                        </p>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">

        {/* CABEÇALHO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
            <p className="text-sm text-slate-500 mt-1">Organize eventos, feriados e períodos especiais</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Ano */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-bold text-slate-900 min-w-[80px] text-center">
                {currentYear}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-600 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.15, 1.5))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Limpar duplicatas (só aparece se houver) */}
            {hasDuplicates && (
              <Button
                variant="outline"
                size="sm"
                onClick={cleanDuplicates}
                disabled={cleaningDups}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {cleaningDups ? 'Limpando...' : `Limpar duplicatas (${allEvents.length - events.length})`}
              </Button>
            )}

            {/* Carregar Feriados (manual) */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadHolidays}
              disabled={loadingHolidays}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loadingHolidays ? 'Buscando...' : 'Importar Feriados'}
            </Button>

            {/* Novo Evento */}
            <Button
              onClick={() => { setSelectedEvent(null); setSelectedDate(null); setShowDialog(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Evento
            </Button>
          </div>
        </div>

        {/* Aviso se há duplicatas */}
        {hasDuplicates && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Foram encontrados <strong>{allEvents.length - events.length} evento(s) duplicado(s)</strong> no banco.
              O calendário já exibe apenas os únicos, mas recomendamos limpar para manter o banco organizado.
            </span>
          </div>
        )}

        {/* GRID DE MESES */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 origin-top-left"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
        </div>

        {/* Espaçamento extra quando zoom < 1 para o conteúdo abaixo não colidir */}
        {zoom < 1 && (
          <div style={{ height: `${(1 - zoom) * 800}px` }} />
        )}

        {/* LEGENDA */}
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(EVENT_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <span className="text-slate-700 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dialog de Evento */}
        {showDialog && (
          <CalendarEventDialog
            event={selectedEvent}
            initialDate={selectedDate}
            onClose={() => { setShowDialog(false); setSelectedEvent(null); setSelectedDate(null); }}
            onSave={()  => { setShowDialog(false); setSelectedEvent(null); setSelectedDate(null); }}
          />
        )}

      </div>
    </TooltipProvider>
  );
}
