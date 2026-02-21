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

  // Calcular range de datas da semana
  const dateRange = useMemo(() => {
    const bounds = getWeekBounds(currentDate);
    const startDate = bounds.start instanceof Date ? format(bounds.start, 'yyyy-MM-dd') : bounds.start;
    const endDate = bounds.end instanceof Date ? format(bounds.end, 'yyyy-MM-dd') : bounds.end;
    
    return { 
      from: startDate, 
      to: endDate 
    };
  }, [currentDate]);

  // Buscar dados do dashboard via função backend
  const dashboardQuery = useQuery({
    queryKey: ['dashboardData', dateRange.from, dateRange.to, selectedSector],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardData', {
        startDate: dateRange.from,
        endDate: dateRange.to,
        sector: selectedSector
      });
      return response.data;
    },
    onError: (error) => {
      console.error('❌ ERRO COMPLETO:', error);
      console.error('❌ Resposta:', error.response?.data);
      console.error('❌ Message:', error.message);
    }
  });

  const productionQuery = useQuery({
    queryKey: ['productionRecords'],
    queryFn: () => base44.entities.ProductionRecord.list()
  });

  const productionRecords = productionQuery.data || [];

  // ✅ Processar dados do dashboard (CORRIGIDO)
  const filteredData = useMemo(() => {
    if (!dashboardQuery.data) return { sales: [], losses: [], production: [] };
    
    const salesData = dashboardQuery.data.topSales?.map(item => ({
      product_name: item.produto,
      quantity: parseFloat(item.total_vendas),
      sector: item.setor  // ✅ CORRIGIDO: agora mapeia o setor corretamente
    })) || [];

    const lossesData = dashboardQuery.data.lossAnalysis?.map(item => ({
      product_name: item.produto,
      quantity: parseFloat(item.perda),
      sales_quantity: parseFloat(item.venda),
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

    const totalSalesKG = salesKG.reduce((sum, r) => sum + (parseFloat(r.total_vendas) || 0), 0);
    const totalSalesUN = salesUN.reduce((sum, r) => sum + (parseFloat(r.total_vendas) || 0), 0);
    const totalLossesKG = lossesKG.reduce((sum, r) => sum + (parseFloat(r.perda) || 0), 0);
    const totalLossesUN = lossesUN.reduce((sum, r) => sum + (parseFloat(r.perda) || 0), 0);

    const lossRateKG = totalSalesKG > 0 ? (totalLossesKG / totalSalesKG) * 100 : 0;
    const lossRateUN = totalSalesUN > 0 ? (totalLossesUN / totalSalesUN) * 100 : 0;

    const productionWithAssertiveness = filteredData.production.filter(p => p.assertiveness !== undefined);
    const avgAssertiveness = productionWithAssertiveness.length > 0
      ? productionWithAssertiveness.reduce((sum, p) => sum + (p.assertiveness || 0), 0) / productionWithAssertiveness.length
      : 0;

    return {
      kg: { 
        sales: totalSalesKG, 
        losses: totalLossesKG, 
        lossRate: lossRateKG
      },
      un: { 
        sales: totalSalesUN, 
        losses: totalLossesUN, 
        lossRate: lossRateUN
      },
      avgAssertiveness
    };
  }, [dashboardQuery.data, filteredData.production, productMap]);

  return (
    <div className="space-y-6 fade-in">
      {/* Header com Gradient e Animação */}
      <div className="relative overflow-hidden card-glass p-6 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--accent-neon))]/10 via-[hsl(var(--accent-purple))]/10 to-transparent"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gradient flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] flex items-center justify-center glow-cyan">
                <BarChart3 className="w-5 h-5 text-[hsl(var(--bg-void))]" strokeWidth={2.5} />
              </div>
              Dashboard Analytics
            </h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--success-neon))] animate-pulse"></div>
              Visão geral em tempo real da operação
            </p>
          </div>
        </div>
      </div>

      {/* Controles com Design Futurista */}
      <div className="card-glass p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
         <WeekNavigator currentDate={currentDate} onDateChange={setCurrentDate} />

         <div className="flex items-center gap-3">
           <Select value={selectedSector} onValueChange={setSelectedSector}>
             <SelectTrigger className="w-48 glass border-[hsl(var(--border-medium))] hover:border-[hsl(var(--accent-neon))] transition-all">
               <SelectValue placeholder="Setor" />
             </SelectTrigger>
             <SelectContent className="glass-strong border-[hsl(var(--border-medium))]">
               <SelectItem value="all">🌐 Todos os Setores</SelectItem>
               <SelectItem value="Padaria">🍞 Padaria</SelectItem>
               <SelectItem value="Confeitaria">🎂 Confeitaria</SelectItem>
               <SelectItem value="Salgados">🥐 Salgados</SelectItem>
               <SelectItem value="Minimercado">🛒 Minimercado</SelectItem>
               <SelectItem value="Restaurante">🍽️ Restaurante</SelectItem>
               <SelectItem value="Frios">🧊 Frios</SelectItem>
             </SelectContent>
           </Select>

           {dashboardQuery.isLoading && (
             <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-tertiary))] badge-cyan px-3 py-1.5 rounded-lg">
               <div className="w-2 h-2 rounded-full bg-[hsl(var(--accent-neon))] animate-pulse"></div>
               Carregando...
             </div>
           )}
           
           {dashboardQuery.isError && (
             <div className="flex items-center gap-2 text-xs badge-error px-3 py-1.5 rounded-lg">
               <AlertTriangle className="w-3 h-3" />
               Erro ao carregar
             </div>
           )}
         </div>
       </div>

      {/* Grid Principal com Cards Melhorados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 slide-in-up">
        <div className="card-futuristic hover:scale-[1.02] transition-transform duration-300">
          <TopSellingProducts 
            salesData={filteredData.sales} 
            productMap={productMap}
            selectedSector={selectedSector}
          />
        </div>
        <div className="card-futuristic hover:scale-[1.02] transition-transform duration-300">
          <LossAnalysis 
            lossData={filteredData.losses}
            productMap={productMap}
          />
        </div>
      </div>

      {/* Alertas com Destaque Visual */}
      <div className="card-futuristic">
        <WeekAlerts 
          salesData={filteredData.sales}
          lossData={filteredData.losses}
          historicalLossData={historicalDataForLimits}
          productionData={filteredData.production}
          productMap={productMap}
          dateRange={dateRange}
        />
      </div>

      {/* Gráfico de Tendências */}
      <div className="card-futuristic">
        <ProductTrendChart 
          salesData={filteredData.sales}
          lossData={filteredData.losses}
          productMap={productMap}
          selectedSector={selectedSector}
          currentDate={currentDate}
        />
      </div>
    </div>
  );
}