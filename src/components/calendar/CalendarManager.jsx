import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Plus, Trash2, TrendingUp, TrendingDown, CalendarIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SECTORS } from "../common/SectorBadge";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function CalendarManager({ events, onRefresh }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    impact_percentage: 0,
    sector: "Todos",
    notes: ""
  });

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      date: format(date, "yyyy-MM-dd")
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.date) {
      toast.error("Nome e data são obrigatórios");
      return;
    }

    try {
      await base44.entities.CalendarEvent.create(formData);
      toast.success("Evento criado");
      setDialogOpen(false);
      setFormData({ name: "", date: "", impact_percentage: 0, sector: "Todos", notes: "" });
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao criar evento");
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await base44.entities.CalendarEvent.delete(eventId);
      toast.success("Evento removido");
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao remover evento");
    }
  };

  const getEventsForDay = (date) => {
    return events.filter(event => 
      isSameDay(parseISO(event.date), date)
    );
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Calendário Inteligente
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              ←
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array(startOfMonth(currentMonth).getDay()).fill(null).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}
            
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={day.toISOString()}
                  className={`h-20 p-1 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                    isToday ? "border-blue-500 bg-blue-50" : "border-slate-200"
                  }`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-slate-600"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs truncate px-1 rounded ${
                          event.impact_percentage > 0 
                            ? "bg-green-100 text-green-700"
                            : event.impact_percentage < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                        title={`${event.name} (${event.impact_percentage > 0 ? '+' : ''}${event.impact_percentage}%)`}
                      >
                        {event.impact_percentage > 0 ? "↑" : event.impact_percentage < 0 ? "↓" : "•"} {event.name}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-slate-500 px-1">
                        +{dayEvents.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Eventos do Mês</h4>
            <div className="space-y-2 max-h-48 overflow-auto">
              {events
                .filter(event => isSameMonth(parseISO(event.date), currentMonth))
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(event => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {event.impact_percentage > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : event.impact_percentage < 0 ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{event.name}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(event.date), "dd/MM/yyyy")} • {event.sector}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        event.impact_percentage > 0 ? "text-green-600" : 
                        event.impact_percentage < 0 ? "text-red-600" : "text-slate-500"
                      }`}>
                        {event.impact_percentage > 0 ? "+" : ""}{event.impact_percentage}%
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              {events.filter(event => isSameMonth(parseISO(event.date), currentMonth)).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum evento neste mês
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Novo Evento/Feriado
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome do Evento</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Natal, Dia das Mães"
              />
            </div>

            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <Label>Impacto na Produção (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.impact_percentage}
                  onChange={(e) => setFormData({ ...formData, impact_percentage: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 10 para +10%, -20 para -20%"
                />
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  {formData.impact_percentage > 0 ? "Aumento" : formData.impact_percentage < 0 ? "Redução" : "Neutro"}
                </span>
              </div>
            </div>

            <div>
              <Label>Setor Afetado</Label>
              <Select 
                value={formData.sector} 
                onValueChange={(value) => setFormData({ ...formData, sector: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os Setores</SelectItem>
                  {SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}