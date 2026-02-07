import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, X } from "lucide-react";
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
    sectors: ['Todos'],
    priority: 'media',
    notes: ''
  });

  const IMPACT_OPTIONS = [
    { label: 'Sem impacto', value: 0 },
    { label: 'Aumentar 30%', value: 30 },
    { label: 'Aumentar 50%', value: 50 },
    { label: 'Reduzir 20%', value: -20 },
    { label: 'Reduzir 50%', value: -50 },
  ];

  const SECTORS = ['Padaria', 'Salgados', 'Confeitaria', 'Minimercado', 'Restaurante', 'Frios'];

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || '',
        date: event.date || format(new Date(), 'yyyy-MM-dd'),
        type: event.type || 'Evento Especial',
        impact_percentage: event.impact_percentage || 0,
        sectors: event.sectors || ['Todos'],
        priority: event.priority || 'media',
        notes: event.notes || ''
      });
    } else if (initialDate) {
      setFormData(prev => ({
        ...prev,
        date: initialDate
      }));
    }
  }, [event, initialDate]);

  const handleSectorToggle = (sector) => {
    if (sector === 'Todos') {
      setFormData({...formData, sectors: ['Todos']});
    } else {
      const newSectors = formData.sectors.includes(sector)
        ? formData.sectors.filter(s => s !== sector && s !== 'Todos')
        : [...formData.sectors.filter(s => s !== 'Todos'), sector];
      
      setFormData({...formData, sectors: newSectors.length > 0 ? newSectors : ['Todos']});
    }
  };

  const handleRemoveSector = (sector) => {
    const newSectors = formData.sectors.filter(s => s !== sector);
    setFormData({...formData, sectors: newSectors.length > 0 ? newSectors : ['Todos']});
  };

  const getSelectedSectorsLabel = () => {
    if (formData.sectors.includes('Todos')) return 'Todos os setores';
    if (formData.sectors.length === 0) return 'Selecione setores...';
    if (formData.sectors.length === 1) return formData.sectors[0];
    return `${formData.sectors.length} setores selecionados`;
  };

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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm">Nome do Evento *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Páscoa, Black Friday, Natal..."
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-sm">Impacto na Produção</Label>
              <Select 
                value={formData.impact_percentage.toString()} 
                onValueChange={(value) => setFormData({...formData, impact_percentage: parseFloat(value)})}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  {IMPACT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Tipo de Evento</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({...formData, type: value})}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                <SelectItem value="Feriado Nacional">🔴 Feriado Nacional</SelectItem>
                <SelectItem value="Feriado Regional">🟠 Feriado Regional/Local</SelectItem>
                <SelectItem value="Evento Especial">🟡 Evento Especial</SelectItem>
                <SelectItem value="Alta Demanda">🔵 Período de Alta Demanda</SelectItem>
                <SelectItem value="Observação">🟢 Observação Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Setores Afetados</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between mt-1 h-9"
                >
                  <span className="text-sm">{getSelectedSectorsLabel()}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 z-[10000]" align="start">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSectorToggle('Todos')}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors ${
                      formData.sectors.includes('Todos') ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                      formData.sectors.includes('Todos') ? 'bg-slate-900 border-slate-900' : 'border-slate-300'
                    }`}>
                      {formData.sectors.includes('Todos') && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-medium">Todos os setores</span>
                  </button>
                  
                  <div className="border-t my-1"></div>
                  
                  {SECTORS.map(sector => (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => handleSectorToggle(sector)}
                      disabled={formData.sectors.includes('Todos')}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        formData.sectors.includes(sector) ? 'bg-slate-50' : ''
                      }`}
                    >
                      <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                        formData.sectors.includes(sector) ? 'bg-slate-900 border-slate-900' : 'border-slate-300'
                      }`}>
                        {formData.sectors.includes(sector) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{sector}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Tags dos setores selecionados */}
            {formData.sectors.length > 0 && !formData.sectors.includes('Todos') && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.sectors.map(sector => (
                  <Badge key={sector} variant="secondary" className="gap-1 pr-1">
                    {sector}
                    <button
                      type="button"
                      onClick={() => handleRemoveSector(sector)}
                      className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Prioridade</Label>
              <div className="space-y-1.5 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value="baixa"
                    checked={formData.priority === 'baixa'}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs flex items-center gap-1">
                    🟢 Baixa
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value="media"
                    checked={formData.priority === 'media'}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs flex items-center gap-1">
                    🟡 Média
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value="alta"
                    checked={formData.priority === 'alta'}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs flex items-center gap-1">
                    🔴 Alta
                  </span>
                </label>
              </div>
            </div>
            <div>
              <Label className="text-sm">Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Notas..."
                rows={4}
                className="text-sm mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {event && (
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="bg-white text-slate-700 border-slate-300">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {event ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}