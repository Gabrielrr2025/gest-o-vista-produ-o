import React, { useState, useMemo } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Filter } from "lucide-react";
import SectorBadge, { SECTORS } from "../common/SectorBadge";

const DAYS = [
  { value: "Segunda",  short: "S", full: "Seg" },
  { value: "Terça",   short: "T", full: "Ter" },
  { value: "Quarta",  short: "Q", full: "Qua" },
  { value: "Quinta",  short: "Q", full: "Qui" },
  { value: "Sexta",   short: "S", full: "Sex" },
  { value: "Sábado",  short: "S", full: "Sáb" },
  { value: "Domingo", short: "D", full: "Dom" },
];

// Unidades conforme solicitado
const UNITS = ["UN", "KG", "PCT"];

const emptyForm = {
  name: "",
  code: "",
  sector: "",
  unit: "UN",
  recipe_yield: 1,
  production_days: [],
  active: true,
  manufacturing_time: "",   // horário de fabricação (time)
  sale_time: "",            // horário de venda (time)
  production_time: "",      // tempo de preparo em minutos
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

  // --- Abrir criar ---
  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  // --- Abrir editar ---
  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      code: product.code || "",
      sector: product.sector || "",
      unit: product.unit || "UN",
      recipe_yield: product.recipe_yield || 1,
      production_days: Array.isArray(product.production_days) ? [...product.production_days] : [],
      active: product.active !== false,
      manufacturing_time: product.manufacturing_time || "",
      sale_time: product.sale_time || "",
      production_time: product.production_time || "",
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

  // --- Salvar ---
  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório.");
    if (!form.sector) return toast.error("Setor é obrigatório.");

    setIsSaving(true);
    try {
      if (editingProduct) {
        // response.data é o retorno do backend
        const data = await base44.functions.invoke('Updateproduct', {
          id: editingProduct.id,
          name: form.name,
          code: form.code,
          sector: form.sector,
          unit: form.unit,
          recipe_yield: form.recipe_yield,
          production_days: form.production_days,
          active: form.active,
          manufacturing_time: form.manufacturing_time || null,
          sale_time: form.sale_time || null,
        });
        if (data?.error) throw new Error(data.error);
        toast.success("Produto atualizado!");
      } else {
        const data = await base44.functions.invoke('Createproduct', {
          name: form.name,
          code: form.code,
          sector: form.sector,
          unit: form.unit,
          recipe_yield: form.recipe_yield,
          production_days: form.production_days,
          active: form.active,
          manufacturing_time: form.manufacturing_time || null,
          sale_time: form.sale_time || null,
        });
        if (data?.error) throw new Error(data.error);
        toast.success("Produto criado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['planningData'] });
      queryClient.invalidateQueries({ queryKey: ['sqlData'] });
      queryClient.invalidateQueries({ queryKey: ['savedPlanning'] });
      onRefresh?.();
      closeDialog();
    } catch (err) {
      toast.error("Erro ao salvar: " + (err.message || "Verifique sua conexão."));
    } finally {
      setIsSaving(false);
    }
  };

  // --- Excluir ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await base44.functions.invoke('Deleteproduct', {
        id: deleteTarget.id,
        soft: false,
      });
      // Base44 pode retornar em response direto ou em response.data
      const data = response?.data || response;
      
      if (data?.success || data?.deleted) {
        toast.success(`"${deleteTarget.name}" excluído com sucesso!`);
        // Invalidar e forçar refetch de TODAS as queries relevantes
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['planningData'] });
        await queryClient.invalidateQueries({ queryKey: ['sqlData'] });
        await queryClient.invalidateQueries({ queryKey: ['savedPlanning'] });
        await queryClient.refetchQueries({ queryKey: ['products'] });
        await queryClient.refetchQueries({ queryKey: ['sqlData'] });
        onRefresh?.();
        setDeleteTarget(null);
      } else {
        const errorMsg = data?.error || "Erro ao excluir produto.";
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("Erro ao excluir: " + (err.message || "Verifique sua conexão."));
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Badges dias ---
  const renderDays = (days = []) => (
    <div className="flex gap-1">
      {DAYS.map(({ value, short }) => (
        <span
          key={value}
          className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${
            days.includes(value) ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          {short}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Controles */}
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
            <SelectContent className="z-[10000]">
              <SelectItem value="all">Todos os setores</SelectItem>
              {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                    <TableRow key={product.id} className={product.active === false ? "opacity-40" : ""}>
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                        {product.code && <p className="text-xs text-slate-400">#{product.code}</p>}
                      </TableCell>
                      <TableCell><SectorBadge sector={product.sector} /></TableCell>
                      <TableCell className="text-center text-sm text-slate-700">
                        {product.recipe_yield || 1} {product.unit === "KG" || product.unit === "kilo" ? "Kg" : "Un"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-700">
                        {product.unit || "UN"}
                      </TableCell>
                      <TableCell>{renderDays(product.production_days || [])}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(product)}
                            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded hover:bg-slate-100"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50"
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

      {/* ===== DIALOG CRIAR / EDITAR ===== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? `Editando: ${editingProduct.name}` : "Preencha os dados do novo produto."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pão Francês"
              />
            </div>

            {/* Código + Setor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: PAD001"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Setor *</Label>
                <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Unidade + Rendimento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Rendimento</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.recipe_yield}
                  onChange={(e) => setForm({ ...form, recipe_yield: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Horário Fabricação + Tempo de Preparo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Horário de Fabricação</Label>
                <Input
                  type="time"
                  value={form.manufacturing_time}
                  onChange={(e) => setForm({ ...form, manufacturing_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tempo de Preparo (min)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.production_time}
                  onChange={(e) => setForm({ ...form, production_time: e.target.value })}
                  placeholder="Ex: 45"
                />
              </div>
            </div>

            {/* Horário de Venda */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Horário de Venda</Label>
              <Input
                type="time"
                value={form.sale_time}
                onChange={(e) => setForm({ ...form, sale_time: e.target.value })}
                className="w-1/2"
              />
            </div>

            {/* Dias de Produção */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Dias de Produção</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(({ value, full }) => (
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
                    {full}
                  </button>
                ))}
              </div>
            </div>

            {/* Produto Ativo */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
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

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-slate-900 hover:bg-slate-700 text-white"
            >
              {isSaving ? "Salvando..." : editingProduct ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG EXCLUIR ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>{deleteTarget?.name}</strong> será excluído permanentemente do sistema.
              Ele voltará a aparecer como "não mapeado" caso ainda exista nos registros de vendas ou perdas.
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
