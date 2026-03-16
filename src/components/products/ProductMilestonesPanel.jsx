import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Flag, Trash2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ProductMilestonesPanel({ productId, productName }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), title: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', productId],
    queryFn: () => base44.entities.ProductMilestone.filter({ product_id: productId }, '-date', 50),
    enabled: !!productId,
  });

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Informe o título do marco.');
    if (!form.date) return toast.error('Informe a data.');
    setSaving(true);
    try {
      await base44.entities.ProductMilestone.create({
        product_id: productId,
        product_name: productName,
        date: form.date,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
      });
      toast.success('Marco salvo!');
      setForm({ date: format(new Date(), 'yyyy-MM-dd'), title: '', notes: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['milestones', productId] });
    } catch (err) {
      toast.error('Erro ao salvar marco.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.ProductMilestone.delete(id);
      toast.success('Marco removido.');
      queryClient.invalidateQueries({ queryKey: ['milestones', productId] });
    } catch {
      toast.error('Erro ao remover marco.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">Marcos Temporais</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="text-xs h-7 px-2">
          <Plus className="w-3 h-3 mr-1" />
          Novo marco
        </Button>
      </div>

      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Mudei a embalagem"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Detalhes..."
              className="h-8 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-7 text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-400 text-center py-2">Carregando...</p>
      ) : milestones.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2 italic">Nenhum marco registrado ainda.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {milestones.map(m => (
            <div key={m.id} className="flex items-start justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <div className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">{m.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {format(parseISO(m.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {m.notes && <p className="text-[11px] text-slate-500 mt-0.5">{m.notes}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(m.id)} className="text-slate-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}