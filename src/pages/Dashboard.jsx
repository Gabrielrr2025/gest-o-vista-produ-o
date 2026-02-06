import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subWeeks } from "date-fns";
import { ShoppingCart, AlertTriangle, Target, BarChart3, Weight, Package, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SQLDataProvider from "../components/import/SQLDataProvider";
import SalesVsLossChart from "../components/dashboard/SalesVsLossChart";
import AssertivityBySectorChart from "../components/dashboard/AssertivityBySectorChart";
import TopProductsBySector from "../components/dashboard/TopProductsBySector";
import AssertivityVsSalesChart from "../components/dashboard/AssertivityVsSalesChart";
import MiniSparkline from "../components/dashboard/MiniSparkline";
import WeekNavigator, { getWeekBounds } from "../components/dashboard/WeekNavigator";
import TopSellingProducts from "../components/dashboard/TopSellingProducts";

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSector, setSelectedSector] = useState("all");
  const [sqlData, setSqlData] = useState({ sales: [], losses: [] });
  const [previousPeriodData, setPreviousPeriodData] = useState({ sales: [], losses: [] });

  const dateRange = useMemo(() => {
    const bounds = getWeekBounds(currentDate);
    return { from: bounds.start, to: bounds.end };
  }, [currentDate]);

  const previousDateRange = useMemo(() => {
    const prevWeekDate = subWeeks(currentDate, 1);
    const bounds = getWeekBounds(prevWeekDate);
    return { from: bounds.start, to: bounds.end };
  }, [currentDate]);

  const productionQuery = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
  });

  const productionRecords = productionQuery.data || [];

  const filteredData = useMemo(() => {
    const filterBySector = (records) => {
      if (selectedSector === "all") return records;
      return records.filter(record => record.sector === selectedSector);
    };

    // Filtrar por data também
    const startTime = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const endTime = dateRange.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : null;

    const filterByDate = (records) => {
      if (!startTime || !endTime) return records;
      return records.filter(record => {
        const recordTime = new Date(record.date).getTime();
        return recordTime >= startTime && recordTime <= endTime;
      });
    };

    return {
      sales: filterByDate(filterBySector(sqlData.sales)),
      losses: filterByDate(filterBySector(sqlData.losses)),
      production: filterBySector(productionRecords)
    };
  }, [sqlData, productionRecords, selectedSector, dateRange]);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const products = productsQuery.data || [];
  const productMap = useMemo(() => new Map(products.map(p => [p.name, p])), [products]);

  const kpis = useMemo(() => {
    // Período atual
    const salesKG = filteredData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit === 'kilo';
    });
    const salesUN = filteredData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit !== 'kilo';
    });
    const lossesKG = filteredData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit === 'kilo';
    });
    const lossesUN = filteredData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      return prod?.unit !== 'kilo';
    });

    const totalSalesKG = salesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalSalesUN = salesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLossesKG = lossesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalLossesUN = lossesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);

    const lossRateKG = totalSalesKG > 0 ? (totalLossesKG / totalSalesKG) * 100 : 0;
    const lossRateUN = totalSalesUN > 0 ? (totalLossesUN / totalSalesUN) * 100 : 0;

    // Período anterior para comparação
    const prevSalesKG = previousPeriodData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      const sectorMatch = selectedSector === "all" || r.sector === selectedSector;
      return prod?.unit === 'kilo' && sectorMatch;
    });
    const prevSalesUN = previousPeriodData.sales.filter(r => {
      const prod = productMap.get(r.product_name);
      const sectorMatch = selectedSector === "all" || r.sector === selectedSector;
      return prod?.unit !== 'kilo' && sectorMatch;
    });
    const prevLossesKG = previousPeriodData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      const sectorMatch = selectedSector === "all" || r.sector === selectedSector;
      return prod?.unit === 'kilo' && sectorMatch;
    });
    const prevLossesUN = previousPeriodData.losses.filter(r => {
      const prod = productMap.get(r.product_name);
      const sectorMatch = selectedSector === "all" || r.sector === selectedSector;
      return prod?.unit !== 'kilo' && sectorMatch;
    });

    const prevTotalSalesKG = prevSalesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const prevTotalSalesUN = prevSalesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const prevTotalLossesKG = prevLossesKG.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const prevTotalLossesUN = prevLossesUN.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const prevLossRateKG = prevTotalSalesKG > 0 ? (prevTotalLossesKG / prevTotalSalesKG) * 100 : 0;
    const prevLossRateUN = prevTotalSalesUN > 0 ? (prevTotalLossesUN / prevTotalSalesUN) * 100 : 0;

    // Calcular variação %
    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Dados últimas 4 semanas (sparkline)
    const getLast4Weeks = (data, isKG) => {
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = subDays(new Date(), (i + 1) * 7);
        const weekEnd = subDays(new Date(), i * 7);
        const weekData = data.filter(r => {
          const prod = productMap.get(r.product_name);
          const matchUnit = isKG ? prod?.unit === 'kilo' : prod?.unit !== 'kilo';
          const recordDate = new Date(r.date);
          const sectorMatch = selectedSector === "all" || r.sector === selectedSector;
          return matchUnit && recordDate >= weekStart && recordDate <= weekEnd && sectorMatch;
        });
        weeks.push({ value: weekData.reduce((sum, r) => sum + (r.quantity || 0), 0) });
      }
      return weeks;
    };

    const productionWithAssertiveness = filteredData.production.filter(p => p.assertiveness !== undefined);
    const avgAssertiveness = productionWithAssertiveness.length > 0
      ? productionWithAssertiveness.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssertiveness.length
      : 0;

    return {
      kg: { 
        sales: totalSalesKG, 
        losses: totalLossesKG, 
        lossRate: lossRateKG,
        salesChange: calcChange(totalSalesKG, prevTotalSalesKG),
        lossesChange: calcChange(totalLossesKG, prevTotalLossesKG),
        lossRateChange: calcChange(lossRateKG, prevLossRateKG),
        salesSparkline: getLast4Weeks(sqlData.sales, true),
        lossesSparkline: getLast4Weeks(sqlData.losses, true)
      },
      un: { 
        sales: totalSalesUN, 
        losses: totalLossesUN, 
        lossRate: lossRateUN,
        salesChange: calcChange(totalSalesUN, prevTotalSalesUN),
        lossesChange: calcChange(totalLossesUN, prevTotalLossesUN),
        lossRateChange: calcChange(lossRateUN, prevLossRateUN),
        salesSparkline: getLast4Weeks(sqlData.sales, false),
        lossesSparkline: getLast4Weeks(sqlData.losses, false)
      },
      avgAssertiveness
    };
  }, [filteredData, productMap, previousPeriodData, selectedSector, sqlData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da operação</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <WeekNavigator currentDate={currentDate} onDateChange={setCurrentDate} />
        
        <div className="flex items-center gap-3">
          <SQLDataProvider 
            startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
            endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={setSqlData}
          />
          <SQLDataProvider 
            startDate={previousDateRange.from ? format(previousDateRange.from, 'yyyy-MM-dd') : null}
            endDate={previousDateRange.to ? format(previousDateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={setPreviousPeriodData}
          />
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Padaria">Padaria</SelectItem>
              <SelectItem value="Confeitaria">Confeitaria</SelectItem>
              <SelectItem value="Salgados">Salgados</SelectItem>
              <SelectItem value="Minimercado">Minimercado</SelectItem>
              <SelectItem value="Restaurante">Restaurante</SelectItem>
              <SelectItem value="Frios">Frios</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs Unidades */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Unidades</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.un.salesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.un.salesChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.un.sales.toLocaleString('pt-BR')} UN</div>
                <p className="text-sm opacity-90 mt-1">Vendas</p>
                <div className="mt-2">
                  <MiniSparkline data={kpis.un.salesSparkline} color="#ffffff" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.un.lossesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.un.lossesChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.un.losses.toLocaleString('pt-BR')} UN</div>
                <p className="text-sm opacity-90 mt-1">Perdas</p>
                <div className="mt-2">
                  <MiniSparkline data={kpis.un.lossesSparkline} color="#ffffff" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.un.lossRateChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.un.lossRateChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.un.lossRate.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Taxa de Perda</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-7 h-7 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{kpis.avgAssertiveness.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Assertividade</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPIs Quilos */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Weight className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Quilos</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.kg.salesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.kg.salesChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.kg.sales.toFixed(1)} KG</div>
                <p className="text-sm opacity-90 mt-1">Vendas</p>
                <div className="mt-2">
                  <MiniSparkline data={kpis.kg.salesSparkline} color="#ffffff" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-400 to-pink-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.kg.lossesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.kg.lossesChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.kg.losses.toFixed(1)} KG</div>
                <p className="text-sm opacity-90 mt-1">Perdas</p>
                <div className="mt-2">
                  <MiniSparkline data={kpis.kg.lossesSparkline} color="#ffffff" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-7 h-7 opacity-80" />
                  <div className="flex items-center gap-1 text-xs">
                    {kpis.kg.lossRateChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(kpis.kg.lossRateChange).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpis.kg.lossRate.toFixed(1)}%</div>
                <p className="text-sm opacity-90 mt-1">Taxa de Perda</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesVsLossChart salesData={filteredData.sales} lossData={filteredData.losses} />
        <AssertivityBySectorChart salesData={filteredData.sales} lossData={filteredData.losses} productionData={filteredData.production} />
      </div>

      <TopProductsBySector 
        salesData={filteredData.sales} 
        lossData={filteredData.losses}
        selectedSector={selectedSector === "all" ? null : selectedSector}
      />

      <AssertivityVsSalesChart 
        salesData={filteredData.sales} 
        lossData={filteredData.losses}
        productionData={filteredData.production}
      />
    </div>
  );
}