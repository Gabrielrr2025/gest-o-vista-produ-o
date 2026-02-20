import React, { useState, useMemo } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Filter } from "lucide-react";
import SectorBadge, { SECTORS } from "../common/SectorBadge";

const DAYS_OF_WEEK = [
  { value: "seg", label: "S" },
  { value: "ter", label: "T" },
  { value: "qua", label: "Q" },
  { value: "qui", label: "Q" },
  { value: "sex", label: "S" },
  { value: "sab", label: "S" },
  { value: "dom", label: "D" },
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Filtros ---
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.code?.toLowerCase().includes(search.toLowerCase());
      const matchSector = filterSector === "all" || p.sector === filterSector;
      return matchSearch && matchSector;
    });
  }, [products, search, filterSector]);

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

  // --- Salvar (criar ou editar) ---
  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório.");
    if (!form.sector) return toast.error("Setor é obrigatório.");

    setIsSaving(true);
    try {
      if (editingProduct) {
        await base44.functions.invoke('Updateproduct', { id: editingProduct.id, ...form });
        toast.success("Produto atualizado!");
      } else {
        await base44.functions.invoke('Createproduct', form);
        toast.success("Produto criado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onRefresh?.();
      closeDialog();
    } catch (err) {
      toast.error("Erro ao salvar produto: " + (err.message || "Tente novamente."));
    } finally {
      setIsSaving(false);
    }
  };

  // --- Excluir ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await base44.functions.invoke('deleteproduct', {
        id: deleteTarget.id,
        soft: true,
      });

      const data = response?.data;

      if (data?.success) {
        if (data.deleted) {
          toast.success("Produto excluído permanentemente.");
        } else {
          toast.success("Produto desativado (possui registros vinculados).");
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        onRefresh?.();
        setDeleteTarget(null);
      } else {
        toast.error(data?.error || "Erro ao excluir produto.");
      }
    } catch (err) {
      toast.error("Erro ao excluir: " + (err.message || "Tente novamente."));
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Render dias de produção como badges ---
  const renderDays = (days = []) => (
    <div className="flex gap-1">
      {DAYS_OF_WEEK.map(({ value, label }) => (
        <span
          key={value}
          className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${
            days.includes(value)
              ? "bg-slate-700 text-white"
              : "bg-slate-100 text-slate-300"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-44">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showAddButton && (
          <Button onClick={openCreate} className="bg-slate-900 hover:bg-slate-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
              Carregando produtos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum produto encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo produto.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Produto</TableHead>
                    <TableHead className="w-32">Setor</TableHead>
                    <TableHead className="w-28 text-center">Rendimento</TableHead>
                    <TableHead className="w-28 text-center">Unidade Venda</TableHead>
                    <TableHead>Dias de Produção</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow
                      key={product.id}
                      className={product.active === false ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                          {product.code && (
                            <p className="text-xs text-slate-400">#{product.code}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SectorBadge sector={product.sector} />
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-600">
                        {product.recipe_yield || 1} {product.unit === "kilo" || product.unit === "KG" ? "Kg" : "Un"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-600">
                        {product.unit || "UN"}
                      </TableCell>
                      <TableCell>
                        {renderDays(product.production_days || [])}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 px-1">
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Dialog Criar / Editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pão Francês"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: PAD001"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Setor *</Label>
                <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
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
                <Label className="text-sm">Rendimento</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.recipe_yield}
                  onChange={(e) => setForm({ ...form, recipe_yield: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Horário Fabricação</Label>
                <Input
                  type="time"
                  value={form.manufacturing_time}
                  onChange={(e) => setForm({ ...form, manufacturing_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Horário Venda</Label>
                <Input
                  type="time"
                  value={form.sale_time}
                  onChange={(e) => setForm({ ...form, sale_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Dias de Produção</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "seg", label: "Seg" },
                  { value: "ter", label: "Ter" },
                  { value: "qua", label: "Qua" },
                  { value: "qui", label: "Qui" },
                  { value: "sex", label: "Sex" },
                  { value: "sab", label: "Sáb" },
                  { value: "dom", label: "Dom" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      form.production_days.includes(value)
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Produto Ativo</p>
                <p className="text-xs text-slate-400">Produtos inativos não aparecem no planejamento</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-slate-900 hover:bg-slate-700 text-white">
              {isSaving ? "Salvando..." : editingProduct ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>{deleteTarget?.name}</strong> será excluído. Se houver registros vinculados (vendas, perdas), ele será apenas desativado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
