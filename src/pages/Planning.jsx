import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Save, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SectorBadge, { SECTORS } from "../components/common/SectorBadge";
import { getWeek, getYear, parseISO, startOfWeek, endOfWeek, format, eachDayOfInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Planning() {
  const currentWeek = getWeek(new Date());
  const currentYear = getYear(new Date());
  
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSector, setSelectedSector] = useState("all");
  const [editedQuantities, setEditedQuantities] = useState({});
  const [manualProducts, setManualProducts] = useState([]);
  const [addProductDialog, setAddProductDialog] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");

  const queryClient = useQueryClient();

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: productionPlans = [] } = useQuery({
    queryKey: ['productionPlans', selectedWeek, selectedYear],
    queryFn: () => base44.entities.ProductionPlan.filter({ 
      week_number: selectedWeek, 
      year: selectedYear 
    })
  });

  const savePlanMutation = useMutation({
    mutationFn: async (plans) => {
      const promises = plans.map(plan => {
        const existing = productionPlans.find(
          p => p.product_name === plan.product_name && p.week_number === plan.week_number
        );
        if (existing) {
          return base44.entities.ProductionPlan.update(existing.id, plan);
        } else {
          return base44.entities.ProductionPlan.create(plan);
        }
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionPlans'] });
      toast.success("Planejamento salvo com sucesso");
      setEditedQuantities({});
    }
  });

  const weekStart = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const suggestions = useMemo(() => {
    const productMap = {};

    // Get last 4 weeks data
    const recentWeeks = [selectedWeek - 3, selectedWeek - 2, selectedWeek - 1, selectedWeek].filter(w => w > 0);
    
    salesRecords
      .filter(r => recentWeeks.includes(r.week_number) && r.year === selectedYear)
      .forEach(record => {
        const key = record.product_name;
        if (!productMap[key]) {
          productMap[key] = { 
            name: key, 
            sector: record.sector, 
            salesHistory: [], 
            lossHistory: [] 
          };
        }
        if (!productMap[key].salesHistory[record.week_number]) {
          productMap[key].salesHistory[record.week_number] = 0;
        }
        productMap[key].salesHistory[record.week_number] += record.quantity || 0;
      });

    lossRecords
      .filter(r => recentWeeks.includes(r.week_number) && r.year === selectedYear)
      .forEach(record => {
        const key = record.product_name;
        if (!productMap[key]) {
          productMap[key] = { 
            name: key, 
            sector: record.sector, 
            salesHistory: [], 
            lossHistory: [] 
          };
        }
        if (!productMap[key].lossHistory[record.week_number]) {
          productMap[key].lossHistory[record.week_number] = 0;
        }
        productMap[key].lossHistory[record.week_number] += record.quantity || 0;
      });

    // Adicionar produtos manuais
    manualProducts.forEach(prodName => {
      if (!productMap[prodName]) {
        const product = products.find(p => p.name === prodName);
        if (product) {
          productMap[prodName] = {
            name: prodName,
            sector: product.sector,
            salesHistory: [],
            lossHistory: []
          };
        }
      }
    });

    return Object.values(productMap)
      .filter(p => selectedSector === "all" || p.sector === selectedSector)
      .map(p => {
        const product = products.find(prod => prod.name === p.name);
        const recipeYield = product?.recipe_yield || 1;

        const salesValues = Object.values(p.salesHistory).filter(v => v > 0);
        const lossValues = Object.values(p.lossHistory).filter(v => v > 0);

        const avgSales = salesValues.length > 0 
          ? salesValues.reduce((a, b) => a + b, 0) / salesValues.length 
          : 0;
        const avgLoss = lossValues.length > 0 
          ? lossValues.reduce((a, b) => a + b, 0) / lossValues.length 
          : 0;

        const maxSales = Math.max(...salesValues, 0);

        // Last week data
        const lastWeekSales = p.salesHistory[selectedWeek - 1] || 0;
        const lastWeekLoss = p.lossHistory[selectedWeek - 1] || 0;
        const prevWeekSales = p.salesHistory[selectedWeek - 2] || 0;
        const prevWeekLoss = p.lossHistory[selectedWeek - 2] || 0;

        // Intelligent logic
        let adjustment = 1;
        if (lastWeekLoss > prevWeekLoss && lastWeekSales <= prevWeekSales) {
          adjustment = 0.9; // Reduce 10%
        } else if (lastWeekSales > prevWeekSales && lastWeekLoss < prevWeekLoss) {
          adjustment = 1.1; // Increase 10%
        }

        const baseSuggestion = (avgSales + avgLoss) * adjustment;
        const productionUnits = Math.ceil(baseSuggestion / recipeYield);

        const productionDays = product?.production_days || [];
        
        // Distribuir sugestão pelos dias de produção
        const dailyPlanned = {};
        weekDays.forEach((day, idx) => {
          const dayName = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][day.getDay()];
          const shouldProduce = productionDays.includes(dayName);
          const key = `${p.name}_${idx}`;
          const dailyQty = shouldProduce ? Math.ceil(productionUnits / productionDays.length) : 0;
          
          // Priorizar: 1) valor editado, 2) quantidade sugerida
          if (editedQuantities.hasOwnProperty(key)) {
            dailyPlanned[idx] = editedQuantities[key];
          } else {
            dailyPlanned[idx] = dailyQty;
          }
        });

        return {
          ...p,
          avgSales: avgSales.toFixed(1),
          avgLoss: avgLoss.toFixed(1),
          maxSales,
          suggested: productionUnits,
          dailyPlanned,
          productionDays,
          recipeYield,
          adjustment: ((adjustment - 1) * 100).toFixed(0)
        };
      })
      .sort((a, b) => b.avgSales - a.avgSales);
  }, [salesRecords, lossRecords, products, selectedWeek, selectedYear, selectedSector, productionPlans, editedQuantities, weekDays]);

  const handleQuantityChange = (productName, day, value) => {
    const key = `${productName}_${day}`;
    setEditedQuantities(prev => ({
      ...prev,
      [key]: parseInt(value) || 0
    }));
  };

  const handleAddProduct = () => {
    if (!selectedProductToAdd) return;
    if (!manualProducts.includes(selectedProductToAdd)) {
      setManualProducts([...manualProducts, selectedProductToAdd]);
    }
    setAddProductDialog(false);
    setSelectedProductToAdd("");
  };

  const handleSave = () => {
    const plans = suggestions.map(s => {
      const totalPlanned = Object.values(s.dailyPlanned).reduce((sum, val) => sum + val, 0);
      return {
        product_name: s.name,
        sector: s.sector,
        week_number: selectedWeek,
        year: selectedYear,
        suggested_quantity: s.suggested,
        planned_quantity: totalPlanned,
        status: "planejado"
      };
    });

    savePlanMutation.mutate(plans);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planejamento Semanal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {format(weekStart, "dd/MM", { locale: ptBR })} - {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                <SelectItem key={week} value={week.toString()}>Semana {week}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={selectedSector === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedSector("all")}
        >
          Todos
        </Button>
        {SECTORS.map(sector => (
          <Button
            key={sector}
            variant={selectedSector === sector ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSector(sector)}
          >
            {sector}
          </Button>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Pedido de Produção - Semana {selectedWeek}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddProductDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Produto
            </Button>
            <Button onClick={handleSave} disabled={savePlanMutation.isPending}>
              <Save className="w-4 h-4 mr-1" /> Salvar Planejamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-lg max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs sticky left-0 bg-slate-50 z-10">Produto</TableHead>
                  <TableHead className="text-xs">Setor</TableHead>
                  <TableHead className="text-xs text-right">Média</TableHead>
                  <TableHead className="text-xs text-center">Ajuste</TableHead>
                  {weekDays.map((day, idx) => (
                    <TableHead key={idx} className="text-xs text-center bg-blue-50">
                      {format(day, "EEE", { locale: ptBR })}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-right bg-green-50">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((item, index) => (
                  <TableRow key={index} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-sm sticky left-0 bg-white z-10">{item.name}</TableCell>
                    <TableCell><SectorBadge sector={item.sector} /></TableCell>
                    <TableCell className="text-right text-sm">{item.avgSales}</TableCell>
                    <TableCell className="text-center">
                      {parseFloat(item.adjustment) > 0 ? (
                        <span className="text-green-600 text-xs">+{item.adjustment}%</span>
                      ) : parseFloat(item.adjustment) < 0 ? (
                        <span className="text-red-600 text-xs">{item.adjustment}%</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    {weekDays.map((day, dayIdx) => {
                      const dayName = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][day.getDay()];
                      const shouldProduce = item.productionDays?.includes(dayName);
                      return (
                        <TableCell key={dayIdx} className={`text-center ${shouldProduce ? 'bg-blue-50' : 'bg-slate-50'}`}>
                          {shouldProduce ? (
                            <Input
                              type="number"
                              min="0"
                              value={item.dailyPlanned[dayIdx] || 0}
                              onChange={(e) => handleQuantityChange(item.name, dayIdx, e.target.value)}
                              className="w-16 text-center text-xs h-8"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right bg-green-50 font-bold">
                      {Object.values(item.dailyPlanned).reduce((sum, val) => sum + val, 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {suggestions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-slate-500 py-8">
                      Nenhum dado disponível para esta semana
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addProductDialog} onOpenChange={setAddProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Produto ao Planejamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto..." />
              </SelectTrigger>
              <SelectContent>
                {products
                  .filter(p => !suggestions.find(s => s.name === p.name))
                  .map(p => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name} ({p.sector})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddProduct} disabled={!selectedProductToAdd}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}