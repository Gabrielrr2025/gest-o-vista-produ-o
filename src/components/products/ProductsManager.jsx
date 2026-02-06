import React, { useState } from 'react';
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

export default function ProductsManager({ products, onRefresh, showAddButton = true }) {
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
    unit: "unidade",
    production_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    active: true
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
        unit: product.unit || "unidade",
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
        unit: "unidade",
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

    // Verificar produto duplicado por nome
    const duplicateByName = products.find(p => 
      p.name.toLowerCase() === formData.name.toLowerCase() && 
      (!editingProduct || p.id !== editingProduct.id)
    );

    if (duplicateByName) {
      toast.error(`Já existe um produto com o nome "${formData.name}". Use um código único para diferenciar.`);
      return;
    }

    // Verificar produto duplicado por código (se informado)
    if (formData.code && formData.code.trim()) {
      const duplicateByCode = products.find(p => 
        p.code && p.code.toLowerCase() === formData.code.toLowerCase() && 
        (!editingProduct || p.id !== editingProduct.id)
      );

      if (duplicateByCode) {
        toast.error(`Já existe um produto com o código "${formData.code}"`);
        return;
      }
    }

    try {
      if (editingProduct) {
        await base44.entities.Product.update(editingProduct.id, formData);
        toast.success("Produto atualizado");
      } else {
        await base44.entities.Product.create(formData);
        toast.success("Produto criado");
      }
      setDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao salvar produto");
    }
  };

  const toggleActive = async (product) => {
    try {
      await base44.entities.Product.update(product.id, { active: !product.active });
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao atualizar produto");
    }
  };

  const toggleProductionDay = async (product, dayIndex) => {
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const dayName = dayNames[dayIndex];
    const currentDays = product.production_days || [];
    
    const newDays = currentDays.includes(dayName)
      ? currentDays.filter(d => d !== dayName)
      : [...currentDays, dayName];
    
    // Atualização otimista - atualiza UI imediatamente
    const optimisticProducts = products.map(p => 
      p.id === product.id ? { ...p, production_days: newDays } : p
    );
    
    try {
      await base44.entities.Product.update(product.id, { production_days: newDays });
      onRefresh?.();
    } catch (error) {
      toast.error("Erro ao atualizar dias de produção");
      onRefresh?.(); // Reverte para o estado correto
    }
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    try {
      // Primeiro, deletar todos os registros relacionados
      const [sales, losses, plans, production] = await Promise.all([
        base44.entities.SalesRecord.filter({ product_id: productToDelete.id }),
        base44.entities.LossRecord.filter({ product_id: productToDelete.id }),
        base44.entities.ProductionPlan.filter({ product_id: productToDelete.id }),
        base44.entities.ProductionRecord.filter({ product_id: productToDelete.id })
      ]);

      // Deletar registros relacionados
      await Promise.all([
        ...sales.map(s => base44.entities.SalesRecord.delete(s.id)),
        ...losses.map(l => base44.entities.LossRecord.delete(l.id)),
        ...plans.map(p => base44.entities.ProductionPlan.delete(p.id)),
        ...production.map(p => base44.entities.ProductionRecord.delete(p.id))
      ]);

      // Depois deletar o produto
      await base44.entities.Product.delete(productToDelete.id);
      
      toast.success("Produto e registros relacionados excluídos");
      setDeleteDialog(false);
      setProductToDelete(null);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir produto. Tente novamente.");
    }
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
          {showAddButton && (
            <Button onClick={() => handleOpenDialog()} className="bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary-hover))] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Produto
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-700">Produto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Setor</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Rendimento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Unidade Venda</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Dias de Produção</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => {
                const productionDaysIndices = (product.production_days || []).map(day => WEEK_DAYS_MAP[day]);
                
                return (
                  <TableRow key={product.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-sm">{product.name}</TableCell>
                    <TableCell><SectorBadge sector={product.sector} /></TableCell>
                    <TableCell className="text-center text-sm">{product.recipe_yield || 1} Kg</TableCell>
                    <TableCell className="text-center text-sm">{product.unit || "unidade"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {WEEK_DAYS_SHORT.map((day, idx) => (
                          <button
                            key={idx}
                            onClick={() => toggleProductionDay(product, idx)}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-110 ${
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
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Código do Produto (opcional)</Label>
              <Input
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: PFRANCES01"
              />
              <p className="text-xs text-slate-500 mt-1">Código único para identificação</p>
            </div>

            <div>
              <Label>Nome do Produto</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pão Francês"
              />
            </div>

            <div>
              <Label>Setor</Label>
              <Select 
                value={formData.sector} 
                onValueChange={(value) => setFormData({ ...formData, sector: value })}
              >
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rendimento da Receita</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.recipe_yield}
                  onChange={(e) => setFormData({ ...formData, recipe_yield: parseFloat(e.target.value) || 1 })}
                />
              </div>
              
              <div>
                <Label>Unidade</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="pacotes">Pacotes</SelectItem>
                    <SelectItem value="kilo">Kilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Dias de Produção</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map(day => (
                  <div key={day} className="flex items-center gap-1">
                    <Checkbox
                      checked={formData.production_days?.includes(day)}
                      onCheckedChange={(checked) => {
                        const days = formData.production_days || [];
                        setFormData({
                          ...formData,
                          production_days: checked 
                            ? [...days, day]
                            : days.filter(d => d !== day)
                        });
                      }}
                    />
                    <span className="text-sm">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label>Produto ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingProduct ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-900">Excluir Produto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir <strong>"{productToDelete?.name}"</strong>?
          </p>
          <p className="text-sm text-slate-600">
            Todos os registros relacionados (vendas, perdas, planos) também serão excluídos. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}