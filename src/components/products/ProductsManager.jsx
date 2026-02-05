import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Search, Package, X, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import SectorBadge, { SECTORS } from "../common/SectorBadge";
import { toast } from "sonner";

export default function ProductsManager({ products, onRefresh }) {
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleDelete = async (product) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.name}"? Todos os registros relacionados (vendas, perdas, planos) também serão excluídos. Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      // Primeiro, deletar todos os registros relacionados
      const [sales, losses, plans, production] = await Promise.all([
        base44.entities.SalesRecord.filter({ product_id: product.id }),
        base44.entities.LossRecord.filter({ product_id: product.id }),
        base44.entities.ProductionPlan.filter({ product_id: product.id }),
        base44.entities.ProductionRecord.filter({ product_id: product.id })
      ]);

      // Deletar registros relacionados
      await Promise.all([
        ...sales.map(s => base44.entities.SalesRecord.delete(s.id)),
        ...losses.map(l => base44.entities.LossRecord.delete(l.id)),
        ...plans.map(p => base44.entities.ProductionPlan.delete(p.id)),
        ...production.map(p => base44.entities.ProductionRecord.delete(p.id))
      ]);

      // Depois deletar o produto
      await base44.entities.Product.delete(product.id);
      
      toast.success("Produto e registros relacionados excluídos");
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir produto. Tente novamente.");
    }
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Produtos Cadastrados
          </CardTitle>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-1" /> Novo Produto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Setores</SelectItem>
                {SECTORS.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome A-Z</SelectItem>
                <SelectItem value="sector">Setor</SelectItem>
                <SelectItem value="code">Código</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Setor</TableHead>
                  <TableHead className="text-xs text-center">Rendimento</TableHead>
                  <TableHead className="text-xs text-center">Ativo</TableHead>
                  <TableHead className="text-xs text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-500">{product.code || "—"}</TableCell>
                    <TableCell className="font-medium text-sm">{product.name}</TableCell>
                    <TableCell><SectorBadge sector={product.sector} /></TableCell>
                    <TableCell className="text-center text-sm">{product.recipe_yield || 1}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={product.active !== false}
                        onCheckedChange={() => toggleActive(product)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(product)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(product)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
          <div className="text-sm text-slate-500">
            {filteredProducts.length} produto(s)
          </div>
        </CardContent>
      </Card>

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
    </>
  );
}