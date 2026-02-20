import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft, ChevronRight, Plus, Minus, Sparkles
} from "lucide-react";
import {
  format, getYear, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CalendarEventDialog from '../components/calendar/CalendarEventDialog';

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const EVENT_COLORS = {
  "Feriado Nacional": { dot: "bg-red-500",    badge: "bg-red-100 text-red-800 border-red-200"       },
  "Feriado Regional": { dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 border-amber-200" },
  "Evento Especial":  { dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "Alta Demanda":     { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-800 border-blue-200"    },
  "Observação":       { dot: "bg-emerald-500",badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};
const DEFAULT_COLOR = { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 border-slate-200" };

// ─── Fontes das APIs gratuitas ────────────────────────────────────────────────

async function fetchBrasilAPI(year) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(h => ({
      name: h.name,
      date: h.date,
      type: "Feriado Nacional",
      fonte: "BrasilAPI",
    }));
  } catch {
    return [];
  }
}

async function fetchNagerDate(year) {
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(h => ({
      name: h.localName || h.name,
      date: h.date,
      type: "Feriado Nacional",
      fonte: "Nager.Date",
    }));
  } catch {
    return [];
  }
}

async function fetchRegionaisLLM(year) {
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Liste SOMENTE os feriados ESTADUAIS do Rio de Janeiro e MUNICIPAIS de Itaperuna/RJ para o ano ${year}.

NÃO inclua feriados nacionais (Ano Novo, Carnaval, Tiradentes, Dia do Trabalho, Corpus Christi, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República, Natal).

Retorne APENAS feriados estaduais e municipais, sem repetições. Cada feriado deve ter:
- name: nome oficial
- date: data no formato YYYY-MM-DD
- type: "Feriado Regional"`,
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
              }
            }
          }
        }
      }
    });
    return (response.holidays || []).map(h => ({
      name:  h.name,
      date:  h.date,
      type:  "Feriado Regional",
      fonte: "IA (estaduais/municipais)",
    }));
  } catch {
    return [];
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Calendar() {
  const [currentYear, setCurrentYear]     = useState(getYear(new Date()));
  const [zoom, setZoom]                   = useState(0.85);
  const [showDialog, setShowDialog]       = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate]   = useState(null);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const queryClient = useQueryClient();

  const { data: allEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list(),
  });

  // Deduplica por (date + name) no cliente — proteção extra
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

  // ─── Importar feriados ────────────────────────────────────────────────────
  const loadHolidays = async () => {
    try {
      setLoadingHolidays(true);
      toast.info("Consultando APIs de feriados...");

      // Buscar todas as fontes em paralelo
      const [brasilapi, nager, regionais] = await Promise.all([
        fetchBrasilAPI(currentYear),
        fetchNagerDate(currentYear),
        fetchRegionaisLLM(currentYear),
      ]);

      const fontes = {
        BrasilAPI:   brasilapi.length,
        "Nager.Date": nager.length,
        "IA (regionais)": regionais.length,
      };
      console.log("📅 Feriados recebidos:", fontes);

      // Juntar nacionais de ambas as APIs (validação cruzada)
      // Nager.Date cobre datas que BrasilAPI às vezes esquece e vice-versa
      const nacionaisUnidos = [...brasilapi, ...nager];

      // Todos juntos: nacionais + regionais
      const todos = [...nacionaisUnidos, ...regionais];

      // Deduplicar entre as fontes por (date + name normalizado)
      const seenLocal = new Set();
      const uniqueTodos = todos.filter(h => {
        const key = `${h.date}__${h.name.toLowerCase().trim()}`;
        if (seenLocal.has(key)) return false;
        seenLocal.add(key);
        return true;
      });

      // Filtrar apenas o que ainda não existe no banco
      const novos = uniqueTodos.filter(h =>
        !allEvents.some(ev =>
          ev.date === h.date &&
          ev.name.toLowerCase().trim() === h.name.toLowerCase().trim()
        )
      );

      if (novos.length === 0) {
        toast.info("Todos os feriados já estão cadastrados.");
        return;
      }

      // Salvar no banco
      await Promise.all(
        novos.map(h =>
          base44.entities.CalendarEvent.create({
            name:              h.name,
            date:              h.date,
            type:              h.type,
            impact_percentage: 0,
            sectors:           ['Todos'],
            notes:             `Importado via ${h.fonte}`,
          })
        )
      );

      queryClient.invalidateQueries(['calendarEvents']);

      const qtdNac = novos.filter(h => h.type === "Feriado Nacional").length;
      const qtdReg = novos.filter(h => h.type === "Feriado Regional").length;
      const partes = [];
      if (qtdNac > 0) partes.push(`${qtdNac} nacionais (BrasilAPI + Nager.Date)`);
      if (qtdReg > 0) partes.push(`${qtdReg} regionais (IA)`);
      toast.success(`${novos.length} feriado(s) adicionado(s): ${partes.join(', ')}.`);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar feriados.");
    } finally {
      setLoadingHolidays(false);
    }
  };

  const getEventsForDay = useCallback((date) =>
    yearEvents.filter(e => isSameDay(parseISO(e.date), date)),
  [yearEvents]);

  // ─── Render de um mês ──────────────────────────────────────────────────────
  const renderMonth = (monthIndex) => {
    const monthDate   = new Date(currentYear, monthIndex, 1);
    const daysInMonth = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    const emptyDays   = Array(getDay(startOfMonth(monthDate))).fill(null);

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

                      <div className="bg-white divide-y divide-slate-100">
                        {dayEvents.map((ev, i) => {
                          const color   = EVENT_COLORS[ev.type] || DEFAULT_COLOR;
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
                              </div>
                              {ev.notes && !ev.notes.startsWith('Importado via') && (
                                <p className="text-[10px] text-slate-400 italic">{ev.notes}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 text-center">Clique para editar</p>
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
            <p className="text-sm text-slate-500 mt-1">
              Organize eventos, feriados e períodos especiais
            </p>
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
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-600 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(z + 0.15, 1.5))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Importar Feriados */}
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

        {/* Info das fontes */}
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
          <Sparkles className="w-3.5 h-3.5 text-slate-300" />
          <span>
            Feriados nacionais via <strong className="text-slate-500">BrasilAPI</strong> + <strong className="text-slate-500">Nager.Date</strong> (validação cruzada) ·
            Estaduais/municipais via <strong className="text-slate-500">IA</strong>
          </span>
        </div>

        {/* GRID DE MESES */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
        </div>

        {zoom < 1 && <div style={{ height: `${(1 - zoom) * 800}px` }} />}

        {/* LEGENDA */}
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              {Object.entries(EVENT_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <span className="text-slate-700 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
