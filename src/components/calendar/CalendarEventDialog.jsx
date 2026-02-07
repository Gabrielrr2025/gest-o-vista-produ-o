import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CalendarEventDialog({ event, initialDate, onClose, onSave }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    type: 'Evento Especial',
    impact_percentage: 0,
    sector: 'Todos',
    notes: ''
  });

  const IMPACT_OPTIONS = [
    { label: 'Sem impacto', value: 0 },
    { label: 'Aumentar 30%', value: 30 },
    { label: 'Aumentar 50%', value: 50 },
    { label: 'Reduzir 20%', value: -20 },
    { label: 'Reduzir 50%', value: -50 },
  ];

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || '',
        date: event.date || format(new Date(), 'yyyy-MM-dd'),
        type: event.type || 'Evento Especial',
        impact_percentage: event.impact_percentage || 0,
        sector: event.sector || 'Todos',
        notes: event.notes || ''
      });
    } else if (initialDate) {
      setFormData(prev => ({
        ...prev,
        date: initialDate
      }));
    }
  }, [event, initialDate]);

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.date) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      if (event) {
        await base44.entities.CalendarEvent.update(event.id, formData);
        toast.success("Evento atualizado");
      } else {
        await base44.entities.CalendarEvent.create(formData);
        toast.success("Evento criado");
      }

      // Invalidar queries para atualizar calendário E planejamento
      queryClient.invalidateQueries(['calendarEvents']);
      queryClient.invalidateQueries(['planejamentos']);
      
      // Mostrar aviso se impacto foi configurado
      if (formData.impact_percentage !== 0) {
        toast.info("Planejamentos futuros serão ajustados automaticamente");
      }
      
      onSave();
    } catch (error) {
      toast.error("Erro ao salvar evento");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    
    if (!confirm("Tem certeza que deseja excluir este evento? Planejamentos futuros serão recalculados.")) return;

    try {
      await base44.entities.CalendarEvent.delete(event.id);
      toast.success("Evento excluído");
      
      // Invalidar queries para atualizar calendário E planejamento
      queryClient.invalidateQueries(['calendarEvents']);
      queryClient.invalidateQueries(['planejamentos']);
      
      onClose();
    } catch (error) {
      toast.error("Erro ao excluir evento");
      console.error(error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nome do Evento *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Páscoa, Black Friday, Natal..."
            />
          </div>

          <div>
            <Label>Data *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div>
            <Label>Tipo de Evento</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({...formData, type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Feriado Nacional">🔴 Feriado Nacional</SelectItem>
                <SelectItem value="Feriado Regional">🟠 Feriado Regional/Local</SelectItem>
                <SelectItem value="Evento Especial">🟡 Evento Especial</SelectItem>
                <SelectItem value="Alta Demanda">🔵 Período de Alta Demanda</SelectItem>
                <SelectItem value="Observação">🟢 Observação Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Impacto na Produção</Label>
            <Select 
              value={formData.impact_percentage.toString()} 
              onValueChange={(value) => setFormData({...formData, impact_percentage: parseFloat(value)})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Este valor será usado no cálculo do planejamento
            </p>
          </div>

          <div>
            <Label>Setor Afetado</Label>
            <Select 
              value={formData.sector} 
              onValueChange={(value) => setFormData({...formData, sector: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Setores</SelectItem>
                <SelectItem value="Padaria">Padaria</SelectItem>
                <SelectItem value="Salgados">Salgados</SelectItem>
                <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                <SelectItem value="Minimercado">Minimercado</SelectItem>
                <SelectItem value="Restaurante">Restaurante</SelectItem>
                <SelectItem value="Frios">Frios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Notas adicionais sobre o evento..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {event && (
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {event ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}