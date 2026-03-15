import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Pencil, TrendingUp, DollarSign, Filter } from "lucide-react";
import { toast } from "sonner";

const ABC_COLORS = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-red-100 text-red-800 border-red-300',
};

export default function SQLProductsCatalog() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterCurva, setFilterCurva] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [formPricing, setFormPricing] = useState({ custo: '', preco_venda: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['catalogWithPricing'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCatalogWithPricing', {
        startDate: '2026-01-01',
        endDate: '2026-03-31'
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ codigo, custo, preco_venda }) => {
      const res = await base44.functions.invoke('updateProductPricing', { codigo, custo, preco_venda });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Preços atualizados');
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['catalogWithPricing'] });
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar')
  });

  const products = data?.products || [];

  const sectors = useMemo(() => [...new Set(products.map(p => p.setor).filter(Boolean))].sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        (p.nome || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.codigo).includes(search);
      const matchSector = filterSector === 'all' || p.setor === filterSector;
      const matchCurva = filterCurva === 'all' || p.curva_abc === filterCurva;
      return matchSearch && matchSector && matchCurva;
    });
  }, [products, search, filterSector, filterCurva]);

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormPricing({
      custo: product.custo != null ? String(product.custo) : '',
      preco_venda: product.preco_venda != null ? String(product.preco_venda) : ''
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      codigo: editingProduct.codigo,
      custo: formPricing.custo !== '' ? parseFloat(formPricing.custo) : null,
      preco_venda: formPricing.preco_venda !== '' ? parseFloat(formPricing.preco_venda) : null,
    });
  };

  const margemColor = (margem) => {
    if (margem == null) return 'text-slate-400';
    if (margem >= 50) return 'text-green-600 font-semibold';
    if (margem >= 30) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  // Stats resumo
  const stats = useMemo(() => {
    const withPricing = products.filter(p => p.preco_venda && p.custo);
    const avgMargem = withPricing.length > 0
      ? withPricing.reduce((s, p) => s + p.margem, 0) / withPricing.length
      : null;
    const curvaA = products.filter(p => p.curva_abc === 'A').length;
    const semPreco = products.filter(p => !p.preco_venda || !p.custo).length;
    return { total: products.length, avgMargem, curvaA, semPreco };
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-slate-600">Carregando catálogo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Produtos</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 uppercase tracking-wide">Curva A</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{stats.curvaA}</p>
          <p className="text-xs text-green-600">70% do faturamento</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 uppercase tracking-wide">Margem Média</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">
            {stats.avgMargem != null ? `${stats.avgMargem.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 uppercase tracking-wide">Sem Precificação</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{stats.semPreco}</p>
          <p className="text-xs text-amber-600">clique no lápis para editar</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-48">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCurva} onValueChange={setFilterCurva}>
          <SelectTrigger className="w-36">
            <TrendingUp className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Curva ABC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="A">Curva A</SelectItem>
            <SelectItem value="B">Curva B</SelectItem>
            <SelectItem value="C">Curva C</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{filtered.length} produtos</span>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Setor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Curva</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Vendas (período)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Custo (R$)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Preço Venda (R$)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Margem</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Planejamento</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : filtered.map((p, idx) => (
                <tr key={`${p.codigo}-${idx}`} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{p.nome}</div>
                    <div className="text-xs text-slate-400">Cód: {p.codigo}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{p.setor}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {p.curva_abc ? (
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold border ${ABC_COLORS[p.curva_abc]}`}>
                        {p.curva_abc}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {p.total_vendas > 0 ? `R$ ${p.total_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.custo != null ? (
                      <span className="text-slate-700">R$ {parseFloat(p.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-amber-400 text-xs">não informado</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.preco_venda != null ? (
                      <span className="text-slate-700">R$ {parseFloat(p.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-amber-400 text-xs">não informado</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.margem != null ? (
                      <span className={margemColor(p.margem)}>{p.margem.toFixed(1)}%</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {p.no_planejamento ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">✓ Ativo</Badge>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog editar preços */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Precificação</DialogTitle>
            {editingProduct && (
              <div className="text-sm text-slate-600 mt-1">
                <span className="font-medium">{editingProduct.nome}</span>
                {editingProduct.curva_abc && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold border ${ABC_COLORS[editingProduct.curva_abc]}`}>
                    Curva {editingProduct.curva_abc}
                  </span>
                )}
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Custo unitário (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 1.50"
                value={formPricing.custo}
                onChange={(e) => setFormPricing(p => ({ ...p, custo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 3.50"
                value={formPricing.preco_venda}
                onChange={(e) => setFormPricing(p => ({ ...p, preco_venda: e.target.value }))}
              />
            </div>
            {formPricing.custo && formPricing.preco_venda && parseFloat(formPricing.preco_venda) > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <span className="text-slate-600">Margem estimada: </span>
                <span className={margemColor(((parseFloat(formPricing.preco_venda) - parseFloat(formPricing.custo)) / parseFloat(formPricing.preco_venda)) * 100)}>
                  {(((parseFloat(formPricing.preco_venda) - parseFloat(formPricing.custo)) / parseFloat(formPricing.preco_venda)) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}