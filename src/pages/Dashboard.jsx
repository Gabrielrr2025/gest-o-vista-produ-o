import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subWeeks, subDays } from "date-fns";
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
import LossAnalysis from "../components/dashboard/LossAnalysis";
import WeekAlerts from "../components/dashboard/WeekAlerts";
import ProductTrendChart from "../components/dashboard/ProductTrendChart";

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSector, setSelectedSector] = useState("all");
  const [dashboardData, setDashboardData] = useState(null);

  // Calcular semana e ano a partir da data selecionada
  const weekInfo = useMemo(() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); // Início da semana (segunda)
    const firstWeek = new Date(d.getFullYear(), 0, 4);
    firstWeek.setHours(0, 0, 0, 0);
    firstWeek.setDate(firstWeek.getDate() - firstWeek.getDay() + (firstWeek.getDay() === 0 ? -6 : 1));
    const weekNumber = Math.ceil((d - firstWeek) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const year = d.getFullYear();
    return { weekNumber, year };
  }, [currentDate]);

  const dateRange = useMemo(() => {
    const bounds = getWeekBounds(currentDate);
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
          
          <SQLDataProvider 
            startDate={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
            endDate={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={setSqlData}
            showLastUpdate={true}
          />
          <SQLDataProvider 
            startDate={previousDateRange.from ? format(previousDateRange.from, 'yyyy-MM-dd') : null}
            endDate={previousDateRange.to ? format(previousDateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={setPreviousPeriodData}
            showLastUpdate={false}
          />
          <SQLDataProvider 
            startDate={historicalDateRange.from ? format(historicalDateRange.from, 'yyyy-MM-dd') : null}
            endDate={historicalDateRange.to ? format(historicalDateRange.to, 'yyyy-MM-dd') : null}
            onDataLoaded={(data) => {
              const combined = [
                ...data.sales.map(s => ({ ...s, type: 'sale' })),
                ...data.losses.map(l => ({ ...l, type: 'loss' }))
              ];
              setHistoricalData(combined);
            }}
            showLastUpdate={false}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopSellingProducts 
          salesData={filteredData.sales} 
          productMap={productMap}
          selectedSector={selectedSector}
        />
        <LossAnalysis 
          salesData={filteredData.sales}
          lossData={filteredData.losses}
          historicalLossData={historicalData}
          productMap={productMap}
        />
      </div>

      <WeekAlerts 
        salesData={filteredData.sales}
        lossData={filteredData.losses}
        historicalLossData={historicalData}
        productionData={filteredData.production}
        productMap={productMap}
        dateRange={dateRange}
      />

      <ProductTrendChart 
        salesData={filteredData.sales}
        lossData={filteredData.losses}
        productMap={productMap}
        selectedSector={selectedSector}
        currentDate={currentDate}
      />
    </div>
  );
}