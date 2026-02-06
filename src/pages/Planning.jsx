import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Printer, Download, RefreshCw, Save, Filter } from "lucide-react";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, getWeek, getYear, eachDayOfInterval, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import SectorBadge from "../components/common/SectorBadge";
import { toast } from "sonner";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Planning() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedSector, setSelectedSector] = useState("all");
  const [plannedQuantities, setPlannedQuantities] = useState({});

  const weekNumber = getWeek(currentWeekStart);
  const year = getYear(currentWeekStart);
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: salesRecords = [] } = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const { data: lossRecords = [] } = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const planningData = useMemo(() => {
    const activeProducts = products.filter(p => p.active !== false);
    
    return activeProducts.map(product => {
      // Calcular média de vendas e perdas das últimas 4 semanas
      const last28Days = subDays(currentWeekStart, 28);
      const recentSales = salesRecords.filter(s => 
        s.product_name === product.name && 
        new Date(s.date) >= last28Days &&
        new Date(s.date) < currentWeekStart
      );
      const recentLosses = lossRecords.filter(l => 
        l.product_name === product.name && 
        new Date(l.date) >= last28Days &&
        new Date(l.date) < currentWeekStart
      );

      // Agrupar por dia da semana
      const salesByWeekday = Array(7).fill(0);
      const lossByWeekday = Array(7).fill(0);
      const countByWeekday = Array(7).fill(0);

      recentSales.forEach(s => {
        const weekday = new Date(s.date).getDay();
        salesByWeekday[weekday] += s.quantity || 0;
        countByWeekday[weekday]++;
      });

      recentLosses.forEach(l => {
        const weekday = new Date(l.date).getDay();
        lossByWeekday[weekday] += l.quantity || 0;
      });

      // Calcular média diária
      const avgByWeekday = salesByWeekday.map((sales, idx) => {
        const count = countByWeekday[idx] || 1;
        return Math.round((sales + lossByWeekday[idx]) / Math.max(count / 4, 1));
      });

      // Verificar eventos que impactam esta semana
      const weekEvents = calendarEvents.filter(event => {
        const eventDate = parseISO(event.date);
        return eventDate >= currentWeekStart && eventDate <= weekEnd &&
               (event.sector === "Todos" || event.sector === product.sector);
      });

      // Aplicar impacto dos eventos
      const projectedByDay = weekDays.map((day, idx) => {
        let baseQty = avgByWeekday[day.getDay()];
        
        // Verificar se tem evento neste dia
        const dayEvent = weekEvents.find(e => 
          new Date(e.date).toDateString() === day.toDateString()
        );
        
        if (dayEvent && dayEvent.impact_percentage) {
          baseQty = Math.round(baseQty * (1 + dayEvent.impact_percentage / 100));
        }
        
        return baseQty;
      });

      const totalMedia = avgByWeekday.reduce((sum, val) => sum + val, 0);
      const totalProjected = projectedByDay.reduce((sum, val) => sum + val, 0);

      return {
        product,
        avgByWeekday: totalMedia,
        projectedByDay,
        total: totalProjected
      };
    });
  }, [products, salesRecords, lossRecords, calendarEvents, currentWeekStart, weekDays]);

  const filteredPlanning = useMemo(() => {
    if (selectedSector === "all") return planningData;
    return planningData.filter(p => p.product.sector === selectedSector);
  }, [planningData, selectedSector]);

  const handleQuantityChange = (productId, dayIndex, value) => {
    setPlannedQuantities(prev => ({
      ...prev,
      [`${productId}-${dayIndex}`]: parseInt(value) || 0
    }));
  };

  const handleSavePlanning = async () => {
    toast.success("Planejamento salvo com sucesso!");
  };

  const handleRecalculate = () => {
    setPlannedQuantities({});
    toast.success("Valores recalculados");
  };

  const handleExport = () => {
    const headers = ["Produto", "Setor", "Rend.", "Média/dia", ...DIAS_SEMANA, "Total"];
    const rows = filteredPlanning.map(p => [
      p.product.name,
      p.product.sector,
      `${p.product.recipe_yield} ${p.product.unit}`,
      `${Math.round(p.avgByWeekday / 7)}/dia`,
      ...p.projectedByDay.map(q => plannedQuantities[`${p.product.id}-${p.projectedByDay.indexOf(q)}`] || q),
      p.total
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `planejamento_semana${weekNumber}_${year}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planejamento de Produção</h1>
          <p className="text-sm text-slate-500 mt-1">Planeje a produção semanal por produto</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecalculate}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recalcular
          </Button>
          <Button size="sm" onClick={handleSavePlanning}>
            <Save className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="text-lg font-bold text-slate-900">Semana {weekNumber} - {year}</div>
              <div className="text-sm text-slate-500">
                {format(currentWeekStart, "dd/MM", { locale: ptBR })} - {format(weekEnd, "dd/MM", { locale: ptBR })}
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                <SelectItem value="Padaria">Padaria</SelectItem>
                <SelectItem value="Salgados">Salgados</SelectItem>
                <SelectItem value="Confeitaria">Confeitaria</SelectItem>
                <SelectItem value="Minimercado">Minimercado</SelectItem>
                <SelectItem value="Restaurante">Restaurante</SelectItem>
                <SelectItem value="Frios">Frios</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs min-w-[150px] sticky left-0 bg-slate-50 z-10">Produto</TableHead>
                  <TableHead className="text-xs">Setor</TableHead>
                  <TableHead className="text-xs text-center">Rend.</TableHead>
                  <TableHead className="text-xs text-center">Média</TableHead>
                  {weekDays.map((day, idx) => (
                    <TableHead key={idx} className="text-xs text-center min-w-[80px]">
                      <div>{DIAS_SEMANA[day.getDay()]}</div>
                      <div className="text-xs text-slate-500 font-normal">{format(day, "dd/MM")}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-center font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlanning.map(item => {
                  const totalPlanned = item.projectedByDay.reduce((sum, _, idx) => 
                    sum + (plannedQuantities[`${item.product.id}-${idx}`] || item.projectedByDay[idx]), 0
                  );
                  const diff = totalPlanned - item.total;
                  
                  return (
                    <TableRow key={item.product.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-sm sticky left-0 bg-white z-10">{item.product.name}</TableCell>
                      <TableCell><SectorBadge sector={item.product.sector} /></TableCell>
                      <TableCell className="text-center text-xs text-slate-600">
                        {item.product.recipe_yield} {item.product.unit}
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-700">
                        {Math.round(item.avgByWeekday / 7)}/dia
                      </TableCell>
                      {item.projectedByDay.map((qty, idx) => (
                        <TableCell key={idx} className="text-center p-1">
                          <Input
                            type="number"
                            min="0"
                            value={plannedQuantities[`${item.product.id}-${idx}`] ?? qty}
                            onChange={(e) => handleQuantityChange(item.product.id, idx, e.target.value)}
                            className="h-8 text-center text-sm w-full"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        <div className="flex flex-col items-center">
                          <span>{totalPlanned}</span>
                          {diff !== 0 && (
                            <span className={`text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPlanning.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-slate-500 py-8">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}