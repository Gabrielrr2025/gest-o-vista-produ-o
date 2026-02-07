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

  // Buscar dados do dashboard via função backend
  const dashboardQuery = useQuery({
    queryKey: ['dashboardData', weekInfo.weekNumber, weekInfo.year, selectedSector],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardData', {
        weekNumber: weekInfo.weekNumber,
        year: weekInfo.year,
        sector: selectedSector
      });
      return response.data;
    }
  });

  const productionQuery = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
  });

  const productionRecords = productionQuery.data || [];

  // Processar dados do dashboard
  const filteredData = useMemo(() => {
    if (!dashboardQuery.data) return { sales: [], losses: [], production: [] };
    
    // Construir dados de vendas e perdas a partir da resposta
    const salesData = dashboardQuery.data.topSales?.map(item => ({
      product_name: item.produto,
      quantity: item.total_vendas,
      value: item.total_valor
    })) || [];

    const lossesData = dashboardQuery.data.lossAnalysis?.map(item => ({
      product_name: item.produto,
      quantity: item.perda,
      sector: item.setor
    })) || [];

    return {
      sales: salesData,
      losses: lossesData,
      production: productionRecords.filter(p => {
        if (selectedSector === "all") return true;
        return p.sector === selectedSector;
      })
    };
  }, [dashboardQuery.data, productionRecords, selectedSector]);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const products = productsQuery.data || [];
  const productMap = useMemo(() => new Map(products.map(p => [p.name, p])), [products]);

  // Preparar dados históricos para cálculos de limite
  const historicalDataForLimits = useMemo(() => {
    if (!dashboardQuery.data?.previousWeeksAvg) return [];
    return dashboardQuery.data.previousWeeksAvg.map(item => ({
      product_name: item.produto,
      type: item.total_perda > 0 ? 'loss' : 'sale',
      quantity: item.total_perda > 0 ? item.total_perda : item.total_venda,
      sector: item.setor
    }));
  }, [dashboardQuery.data?.previousWeeksAvg]);

  const kpis = useMemo(() => {
    if (!dashboardQuery.data) return { kg: {}, un: {}, avgAssertiveness: 0 };

    const salesData = dashboardQuery.data.topSales || [];
    const lossesData = dashboardQuery.data.lossAnalysis || [];
    const trendData = dashboardQuery.data.trendData || [];

    const salesKG = salesData.filter(r => {
      const prod = productMap.get(r.produto);
      return prod?.unit === 'kilo';
    });
    const salesUN = salesData.filter(r => {
      const prod = productMap.get(r.produto);
      return prod?.unit !== 'kilo';
    });
    const lossesKG = lossesData.filter(r => {
      const prod = productMap.get(r.produto);
      return prod?.unit === 'kilo';
    });
    const lossesUN = lossesData.filter(r => {
      const prod = productMap.get(r.produto);
      return prod?.unit !== 'kilo';
    });

    const totalSalesKG = salesKG.reduce((sum, r) => sum + (r.total_vendas || 0), 0);
    const totalSalesUN = salesUN.reduce((sum, r) => sum + (r.total_vendas || 0), 0);
    const totalLossesKG = lossesKG.reduce((sum, r) => sum + (r.perda || 0), 0);
    const totalLossesUN = lossesUN.reduce((sum, r) => sum + (r.perda || 0), 0);

    const lossRateKG = totalSalesKG > 0 ? (totalLossesKG / totalSalesKG) * 100 : 0;
    const lossRateUN = totalSalesUN > 0 ? (totalLossesUN / totalSalesUN) * 100 : 0;

    // Sparkline das 6 semanas anteriores
    const sparkline = trendData.map(item => ({
      value: item.vendas_qtd || 0
    }));

    const productionWithAssertiveness = filteredData.production.filter(p => p.assertiveness !== undefined);
    const avgAssertiveness = productionWithAssertiveness.length > 0
      ? productionWithAssertiveness.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssertiveness.length
      : 0;

    return {
      kg: { 
        sales: totalSalesKG, 
        losses: totalLossesKG, 
        lossRate: lossRateKG,
        salesSparkline: sparkline,
        lossesSparkline: sparkline
      },
      un: { 
        sales: totalSalesUN, 
        losses: totalLossesUN, 
        lossRate: lossRateUN,
        salesSparkline: sparkline,
        lossesSparkline: sparkline
      },
      avgAssertiveness
    };
  }, [dashboardQuery.data, filteredData.production, productMap]);

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