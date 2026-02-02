import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Download, Calculator } from "lucide-react";
import SectorBadge, { SECTORS } from "../common/SectorBadge";
import { format, isWithinInterval, parseISO } from "date-fns";

export default function ProductionSuggestion({ 
  salesData, 
  lossData, 
  products, 
  calendarEvents,
  dateRange,
  selectedSector 
}) {
  const suggestions = useMemo(() => {
    const productMap = {};
    
    // Aggregate sales
    salesData.forEach(record => {
      const key = record.product_name;
      if (!productMap[key]) {
        productMap[key] = {
          name: key,
          sector: record.sector,
          totalSales: 0,
          totalLoss: 0,
          daysCount: new Set()
        };
      }
      productMap[key].totalSales += record.quantity || 0;
      productMap[key].daysCount.add(record.date);
    });

    // Aggregate losses
    lossData.forEach(record => {
      const key = record.product_name;
      if (!productMap[key]) {
        productMap[key] = {
          name: key,
          sector: record.sector,
          totalSales: 0,
          totalLoss: 0,
          daysCount: new Set()
        };
      }
      productMap[key].totalLoss += record.quantity || 0;
      productMap[key].daysCount.add(record.date);
    });

    // Calculate calendar impact
    const relevantEvents = calendarEvents.filter(event => {
      const eventDate = parseISO(event.date);
      return isWithinInterval(eventDate, { start: dateRange.from, end: dateRange.to });
    });

    const totalImpact = relevantEvents.reduce((sum, event) => sum + (event.impact_percentage || 0), 0);
    const impactMultiplier = 1 + (totalImpact / 100);

    return Object.values(productMap)
      .filter(p => !selectedSector || p.sector === selectedSector)
      .map(p => {
        const product = products.find(prod => prod.name === p.name);
        const recipeYield = product?.recipe_yield || 1;
        const days = p.daysCount.size || 1;
        
        const avgDailySales = p.totalSales / days;
        const avgDailyLoss = p.totalLoss / days;
        const baseSuggestion = avgDailySales + avgDailyLoss;
        const adjustedSuggestion = baseSuggestion * impactMultiplier;
        const productionUnits = Math.ceil(adjustedSuggestion / recipeYield);

        return {
          ...p,
          avgDailySales: avgDailySales.toFixed(1),
          avgDailyLoss: avgDailyLoss.toFixed(1),
          baseSuggestion: baseSuggestion.toFixed(1),
          adjustedSuggestion: adjustedSuggestion.toFixed(1),
          productionUnits,
          recipeYield,
          lossRate: p.totalSales > 0 
            ? ((p.totalLoss / (p.totalSales + p.totalLoss)) * 100).toFixed(1)
            : 0
        };
      })
      .sort((a, b) => parseFloat(b.adjustedSuggestion) - parseFloat(a.adjustedSuggestion));
  }, [salesData, lossData, products, calendarEvents, dateRange, selectedSector]);

  const exportToCSV = () => {
    const headers = ["Produto", "Setor", "Média Vendas/Dia", "Média Perdas/Dia", "Sugestão Base", "Sugestão Ajustada", "Unidades Produção"];
    const rows = suggestions.map(s => [
      s.name,
      s.sector,
      s.avgDailySales,
      s.avgDailyLoss,
      s.baseSuggestion,
      s.adjustedSuggestion,
      s.productionUnits
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sugestao_producao_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Sugestão de Produção
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-1" /> Exportar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs">Setor</TableHead>
                <TableHead className="text-xs text-right">Média Vendas/Dia</TableHead>
                <TableHead className="text-xs text-right">Média Perdas/Dia</TableHead>
                <TableHead className="text-xs text-right">% Perda</TableHead>
                <TableHead className="text-xs text-right">Rendimento</TableHead>
                <TableHead className="text-xs text-right font-semibold bg-blue-50">Produzir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((item, index) => (
                <TableRow key={index} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                  <TableCell><SectorBadge sector={item.sector} /></TableCell>
                  <TableCell className="text-right text-sm">{item.avgDailySales}</TableCell>
                  <TableCell className="text-right text-sm text-red-600">{item.avgDailyLoss}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs font-medium ${
                      parseFloat(item.lossRate) > 10 ? "text-red-600" : 
                      parseFloat(item.lossRate) > 5 ? "text-orange-600" : "text-green-600"
                    }`}>
                      {item.lossRate}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-500">{item.recipeYield}</TableCell>
                  <TableCell className="text-right font-bold text-blue-600 bg-blue-50">
                    {item.productionUnits}
                  </TableCell>
                </TableRow>
              ))}
              {suggestions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Nenhum dado para gerar sugestões
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Calculator className="w-4 h-4" />
          Cálculo: (Média Vendas + Média Perdas) × Ajuste Calendário ÷ Rendimento
        </div>
      </CardContent>
    </Card>
  );
}