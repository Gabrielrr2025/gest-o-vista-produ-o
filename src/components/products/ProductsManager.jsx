import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Search, Package, X, Trash2, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import SectorBadge, { SECTORS } from "../common/SectorBadge";
import { toast } from "sonner";

export default function ProductsManager({ products, onRefresh, showAddButton = false, isLoading = false }) {
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    sector: "Padaria",
    recipe_yield: 1,
    unit: "UN",
    production_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    active: true
  });

  // Mutation para criar produto
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('Createproduct', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Produto criado");
      setDialogOpen(false);
      onRefresh?.();
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error.message || "Erro ao criar produto";
      toast.error(message);
    }
  });

  // Mutation para atualizar produto
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await base44.functions.invoke('Updateproduct', { id, ...data });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Produto atualizado");
      setDialogOpen(false);
      onRefresh?.();
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error.message || "Erro ao atualizar produto";
      toast.error(message);
    }
  });

  // Mutation para deletar produto
  const deleteMutation = useMutation({
    mutationFn: async ({ id, soft }) => {
      const response = await base44.functions.invoke('deleteproduct', { id, soft });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Produto removido");
      setDeleteDialog(false);
      setProductToDelete(null);
      onRefresh?.();
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error.message || "Erro ao remover produto";
      toast.error(message);
    }
  });

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                        (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
    const matchSector = filterSector === "all" || p.sector === filterSector;
    return matchSearch && matchSector;
  }).sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "sector") {
      return a.sector.localeCompare(b.sector);
    } else if (sortBy === "code") {
      return (a.code || "").localeCompare(b.code || "");
    }
    return 0;
  });

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code || "",
        name: product.name,
        sector: product.sector,
        recipe_yield: product.recipe_yield || 1,
        unit: product.unit || "UN",
        production_days: product.production_days || ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
        active: product.active !== false
      });
    } else {
      setEditingProduct(null);
      setFormData({
        code: "",
        name: "",
        sector: "Padaria",
        recipe_yield: 1,
        unit: "UN",
        production_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
        active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = async (product) => {
    updateMutation.mutate({ 
      id: product.id, 
      active: !product.active 
    });
  };

  const toggleProductionDay = async (product, dayIndex) => {
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const dayName = dayNames[dayIndex];
    const currentDays = product.production_days || [];
    
    const newDays = currentDays.includes(dayName)
      ? currentDays.filter(d => d !== dayName)
      : [...currentDays, dayName];
    
    updateMutation.mutate({
      id: product.id,
      production_days: newDays
    });
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    // Soft delete (desativa o produto)
    deleteMutation.mutate({ 
      id: productToDelete.id, 
      soft: true 
    });
  };

  const WEEK_DAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
  const WEEK_DAYS_MAP = {
    "Domingo": 0,
    "Segunda": 1,
    "Terça": 2,
    "Quarta": 3,
    "Quinta": 4,
    "Sexta": 5,
    "Sábado": 6
  };

  const toggleDayInForm = (day) => {
    const currentDays = formData.production_days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setFormData({ ...formData, production_days: newDays });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {SECTORS.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-700">Produto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Setor</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Rendimento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Unidade</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Dias de Produção</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Carregando produtos...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map(product => {
                  const productionDaysIndices = (product.production_days || []).map(day => WEEK_DAYS_MAP[day]);
                  
                  return (
                    <TableRow key={product.id} className={`hover:bg-slate-50 ${!product.active ? 'opacity-50' : ''}`}>
                      <TableCell className="font-medium text-sm">{product.name}</TableCell>
                      <TableCell><SectorBadge sector={product.sector} /></TableCell>
                      <TableCell className="text-center text-sm">{product.recipe_yield || 1}</TableCell>
                      <TableCell className="text-center text-sm">{product.unit || "UN"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {WEEK_DAYS_SHORT.map((day, idx) => (
                            <button
                              key={idx}
                              onClick={() => toggleProductionDay(product, idx)}
                              disabled={!product.active}
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium transition-all ${
                                product.active ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'
                              } ${
                                productionDaysIndices.includes(idx)
                                  ? "bg-slate-700 text-white hover:bg-slate-600"
                                  : "bg-slate-200 text-slate-400 hover:bg-slate-300"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={product.active}
                          onCheckedChange={() => toggleActive(product)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenDialog(product)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteClick(product)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pão Francês"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: PF001"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sector">Setor</Label>
                <Select value={formData.sector} onValueChange={(value) => setFormData({ ...formData, sector: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(sector => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade</SelectItem>
                    <SelectItem value="KG">Quilograma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yield">Rendimento</Label>
                <Input
                  id="yield"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.recipe_yield}
                  onChange={(e) => setFormData({ ...formData, recipe_yield: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias de Produção</Label>
              <div className="flex gap-2 flex-wrap">
                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map(day => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={formData.production_days?.includes(day)}
                      onCheckedChange={() => toggleDayInForm(day)}
                    />
                    <Label htmlFor={`day-${day}`} className="cursor-pointer text-sm">
                      {day}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Produto ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editingProduct ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Desativação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Tem certeza que deseja desativar o produto <strong>{productToDelete?.name}</strong>?
            <br /><br />
            O produto será desativado mas manterá todo o histórico de vendas e perdas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialog(false);
              setProductToDelete(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isLoading ? 'Desativando...' : 'Desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
