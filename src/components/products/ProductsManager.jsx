import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Filter } from "lucide-react";
import SectorBadge, { SECTORS } from "../common/SectorBadge";

const DAYS_OF_WEEK = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const UNITS = ["UN", "KG", "kilo", "unidade"];

const emptyForm = {
  name: "",
  code: "",
  sector: "",
  unit: "UN",
  recipe_yield: 1,
  production_days: [],
  active: true,
  manufacturing_time: "",
  sale_time: "",
};

export default function ProductsManager({ products = [], onRefresh, showAddButton = true, isLoading = false }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('Createproduct', data),
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onRefresh?.();
      closeDialog();
    },
    onError: (err) => toast.error("Erro ao criar produto: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('Updateproduct', data),
    onSuccess: () => {
      toast.success("Produto atualizado!");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onRefresh?.();
      closeDialog();
    },
    onError: (err) => toast.error("Erro ao atualizar produto: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('deleteproduct', { id }),
    onSuccess: () => {
      toast.success("Produto excluído.");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onRefresh?.();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  // --- Filtros ---
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.code?.toLowerCase().includes(search.toLowerCase());
      const matchSector = filterSector === "all" || p.sector === filterSector;
      const matchActive =
        filterActive === "all" ||
        (filterActive === "active" ? p.active !== false : p.active === false);
      return matchSearch && matchSector && matchActive;
    });
  }, [products, search, filterSector, filterActive]);

  // --- Dialog helpers ---
  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      code: product.code || "",
      sector: product.sector || "",
      unit: product.unit || "UN",
      recipe_yield: product.recipe_yield || 1,
      production_days: product.production_days || [],
      active: product.active !== false,
      manufacturing_time: product.manufacturing_time || "",
      sale_time: product.sale_time || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      production_days: prev.production_days.includes(day)
        ? prev.production_days.filter((d) => d !== day)
        : [...prev.production_days, day],
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório.");
    if (!form.sector) return toast.error("Setor é obrigatório.");

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="card-glass p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Busca */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-tertiary))]" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 glass border-[hsl(var(--border-medium))]"
            />
          </div>

          {/* Filtro setor */}
          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-44 glass border-[hsl(var(--border-medium))]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-[hsl(var(--text-tertiary))]" />
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro status */}
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-36 glass border-[hsl(var(--border-medium))]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showAddButton && (
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] text-[hsl(var(--bg-void))] font-semibold hover:opacity-90 glow-cyan"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Contador */}
      <p className="text-xs text-[hsl(var(--text-tertiary))] px-1">
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16 text-[hsl(var(--text-tertiary))]">
          <div className="w-8 h-8 border-2 border-[hsl(var(--accent-neon))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Carregando produtos...
        </div>
      )}

      {/* Vazio */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-[hsl(var(--text-tertiary))]">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum produto encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo produto.</p>
        </div>
      )}

      {/* Grid de cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <Card
              key={product.id}
              className="card-futuristic hover:scale-[1.02] transition-transform duration-200 relative"
            >
              <CardContent className="p-4 space-y-3">
                {/* Header do card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[hsl(var(--text-primary))] truncate text-sm leading-tight">
                      {product.name}
                    </p>
                    {product.code && (
                      <p className="text-xs text-[hsl(var(--text-tertiary))] mt-0.5">
                        #{product.code}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`text-xs shrink-0 ${
                      product.active !== false
                        ? "bg-[hsl(var(--success-neon))]/20 text-[hsl(var(--success-neon))] border-[hsl(var(--success-neon))]/30"
                        : "bg-[hsl(var(--error-neon))]/20 text-[hsl(var(--error-neon))] border-[hsl(var(--error-neon))]/30"
                    }`}
                    variant="outline"
                  >
                    {product.active !== false ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Setor e unidade */}
                <div className="flex items-center gap-2 flex-wrap">
                  <SectorBadge sector={product.sector} />
                  <Badge variant="outline" className="text-xs border-[hsl(var(--border-medium))] text-[hsl(var(--text-secondary))]">
                    {product.unit || "UN"}
                  </Badge>
                </div>

                {/* Dias de produção */}
                {product.production_days?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {DAYS_OF_WEEK.map(({ value, label }) => (
                      <span
                        key={value}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          product.production_days.includes(value)
                            ? "bg-[hsl(var(--accent-neon))]/20 text-[hsl(var(--accent-neon))]"
                            : "bg-transparent text-transparent"
                        }`}
                      >
                        {product.production_days.includes(value) ? label : ""}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-1 border-t border-[hsl(var(--border-subtle))]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-8 hover:bg-[hsl(var(--accent-neon))]/10 hover:text-[hsl(var(--accent-neon))]"
                    onClick={() => openEdit(product)}
                  >
                    <Pencil className="w-3 h-3 mr-1.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-8 hover:bg-[hsl(var(--error-neon))]/10 hover:text-[hsl(var(--error-neon))]"
                    onClick={() => setDeleteTarget(product)}
                  >
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Criar / Editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="glass-strong border-[hsl(var(--border-medium))] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[hsl(var(--text-primary))]">
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-[hsl(var(--text-secondary))] text-sm">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pão Francês"
                className="glass border-[hsl(var(--border-medium))]"
              />
            </div>

            {/* Código + Setor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: PAD001"
                  className="glass border-[hsl(var(--border-medium))]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Setor *</Label>
                <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                  <SelectTrigger className="glass border-[hsl(var(--border-medium))]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Unidade + Rendimento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="glass border-[hsl(var(--border-medium))]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Rendimento</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.recipe_yield}
                  onChange={(e) => setForm({ ...form, recipe_yield: parseFloat(e.target.value) || 1 })}
                  className="glass border-[hsl(var(--border-medium))]"
                />
              </div>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Horário Fabricação</Label>
                <Input
                  type="time"
                  value={form.manufacturing_time}
                  onChange={(e) => setForm({ ...form, manufacturing_time: e.target.value })}
                  className="glass border-[hsl(var(--border-medium))]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[hsl(var(--text-secondary))] text-sm">Horário Venda</Label>
                <Input
                  type="time"
                  value={form.sale_time}
                  onChange={(e) => setForm({ ...form, sale_time: e.target.value })}
                  className="glass border-[hsl(var(--border-medium))]"
                />
              </div>
            </div>

            {/* Dias de produção */}
            <div className="space-y-1.5">
              <Label className="text-[hsl(var(--text-secondary))] text-sm">Dias de Produção</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      form.production_days.includes(value)
                        ? "bg-[hsl(var(--accent-neon))]/20 text-[hsl(var(--accent-neon))] border-[hsl(var(--accent-neon))]/50"
                        : "bg-transparent text-[hsl(var(--text-tertiary))] border-[hsl(var(--border-medium))] hover:border-[hsl(var(--accent-neon))]/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status ativo */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-subtle))] glass">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">Produto Ativo</p>
                <p className="text-xs text-[hsl(var(--text-tertiary))]">Produtos inativos não aparecem no planejamento</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeDialog} className="text-[hsl(var(--text-secondary))]">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-gradient-to-r from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] text-[hsl(var(--bg-void))] font-semibold hover:opacity-90"
            >
              {isSaving ? "Salvando..." : editingProduct ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong border-[hsl(var(--border-medium))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[hsl(var(--text-primary))]">
              Excluir produto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(var(--text-secondary))]">
              O produto <strong className="text-[hsl(var(--text-primary))]">{deleteTarget?.name}</strong> será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass border-[hsl(var(--border-medium))]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteTarget?.id)}
              className="bg-[hsl(var(--error-neon))]/80 hover:bg-[hsl(var(--error-neon))] text-white"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
