import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Printer, Download, RefreshCw, Save, Filter, FileDown, TrendingUp, TrendingDown, Minus, Lightbulb, ArrowUp, ArrowDown, X } from "lucide-react";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, getWeek, getYear, eachDayOfInterval, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import SectorBadge from "../components/common/SectorBadge";
import { toast } from "sonner";
import AutoSQLSync from "../components/import/AutoSQLSync";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Planning() {
  // Inicializar com a próxima semana (futura)
  const [currentWeekStart, setCurrentWeekStart] = useState(addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), 1));
  const [selectedSector, setSelectedSector] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [plannedQuantities, setPlannedQuantities] = useState({});
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved'
  const saveTimeoutRef = React.useRef(null);

  const weekNumber = getWeek(currentWeekStart);
  const year = getYear(currentWeekStart);
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const salesQuery = useQuery({
    queryKey: ['salesRecords'],
    queryFn: () => base44.entities.SalesRecord.list()
  });

  const lossQuery = useQuery({
    queryKey: ['lossRecords'],
    queryFn: () => base44.entities.LossRecord.list()
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const salesRecords = salesQuery.data || [];
  const lossRecords = lossQuery.data || [];

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

      // Aplicar impacto dos eventos e verificar se o produto é produzido neste dia
      const projectedByDay = weekDays.map((day, idx) => {
        const dayOfWeek = day.getDay();
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayName = dayNames[dayOfWeek];
        
        // Verificar se o produto é produzido neste dia
        const productionDays = product.production_days || [];
        if (!productionDays.includes(dayName)) {
          return 0; // Não produzir neste dia
        }
        
        let baseQty = avgByWeekday[dayOfWeek];
        
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
    let filtered = planningData;
    
    // Filtrar por setor
    if (selectedSector !== "all") {
      filtered = filtered.filter(p => p.product.sector === selectedSector);
    }
    
    // Filtrar por busca
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.product.name.toLowerCase().includes(search) ||
        p.product.code?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [planningData, selectedSector, searchTerm]);

  // Verificar se a semana é passada ou atual
  const today = new Date();
  const isWeekInPast = currentWeekStart < startOfWeek(today, { weekStartsOn: 0 });
  const isCurrentWeek = format(currentWeekStart, 'yyyy-MM-dd') === format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');

  const handleQuantityChange = (productId, dayIndex, value) => {
    setPlannedQuantities(prev => ({
      ...prev,
      [`${productId}-${dayIndex}`]: parseInt(value) || 0
    }));

    // Auto-save após 2 segundos
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      setLastUpdate(new Date());
    }, 2000);
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('l', 'mm', 'a4');
      
      // Título
      doc.setFontSize(18);
      doc.text(`Planejamento de Produção - Semana ${weekNumber}`, 15, 15);
      doc.setFontSize(10);
      doc.text(`${format(currentWeekStart, "dd/MM", { locale: ptBR })} a ${format(weekEnd, "dd/MM", { locale: ptBR })}`, 15, 22);
      
      let y = 35;
      const sectors = ["Padaria", "Salgados", "Confeitaria", "Minimercado", "Restaurante", "Frios"];
      
      sectors.forEach(sector => {
        const sectorProducts = filteredPlanning.filter(p => p.product.sector === sector);
        if (sectorProducts.length === 0) return;
        
        // Verificar se precisa de nova página
        if (y > 160) {
          doc.addPage();
          y = 20;
        }
        
        // Título do setor
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(sector, 15, y);
        y += 8;
        
        // Headers
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const headers = ["Produto", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom", "Seg", "Total"];
        let x = 15;
        const colWidths = [60, 18, 18, 18, 18, 18, 18, 18, 20];
        
        headers.forEach((header, idx) => {
          doc.text(header, x, y);
          x += colWidths[idx];
        });
        y += 6;
        
        // Produtos do setor
        sectorProducts.forEach(item => {
          if (y > 180) {
            doc.addPage();
            y = 20;
          }
          
          const totalPlanned = item.projectedByDay.reduce((sum, _, idx) => 
            sum + (plannedQuantities[`${item.product.id}-${idx}`] || item.projectedByDay[idx]), 0
          );
          
          // Mostrar apenas se total > 0
          if (totalPlanned === 0) return;
          
          x = 15;
          doc.text(item.product.name.substring(0, 28), x, y);
          x += colWidths[0];
          
          // Dias (Ter a Seg)
          const dayOrder = [2, 3, 4, 5, 6, 0, 1]; // Terça a Segunda
          dayOrder.forEach(dayIdx => {
            const qty = plannedQuantities[`${item.product.id}-${dayIdx}`] ?? item.projectedByDay[dayIdx];
            doc.text(qty > 0 ? qty.toString() : '-', x, y);
            x += colWidths[dayOrder.indexOf(dayIdx) + 1];
          });
          
          doc.setFont(undefined, 'bold');
          doc.text(totalPlanned.toString(), x, y);
          doc.setFont(undefined, 'normal');
          
          y += 5;
        });
        
        y += 8; // Espaço entre setores
      });
      
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 15, 200);
        doc.text(`Página ${i} de ${pageCount}`, 260, 200);
      }
      
      doc.save(`planejamento_semana${weekNumber}_${year}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
      console.error(error);
    }
  };

  const handleRecalculate = () => {
    setPlannedQuantities({});
    setLastUpdate(new Date());
    toast.success("Valores recalculados");
  };

  const handleProductClick = (item) => {
    setSelectedProduct(item);
  };

  const handleClosePanel = () => {
    setSelectedProduct(null);
  };

  const handleApplySuggestion = () => {
    if (!selectedProduct || !productAnalysis) return;

    const productionDays = selectedProduct.product.production_days || [];
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    // Aplicar a produção diária sugerida nos dias de produção
    weekDays.forEach((day, idx) => {
      const dayOfWeek = day.getDay();
      const dayName = dayNames[dayOfWeek];
      
      if (productionDays.includes(dayName)) {
        setPlannedQuantities(prev => ({
          ...prev,
          [`${selectedProduct.product.id}-${idx}`]: productAnalysis.dailyProduction
        }));
      }
    });

    toast.success("Sugestão aplicada ao planejamento");
  };

  // Análise do produto selecionado
  const productAnalysis = useMemo(() => {
    if (!selectedProduct) return null;

    const productName = selectedProduct.product.name;

    // Semana atual (a semana em visualização)
    const currentWeekSales = salesRecords.filter(s => 
      s.product_name === productName && 
      s.week_number === weekNumber &&
      s.year === year
    );
    const currentWeekLosses = lossRecords.filter(l => 
      l.product_name === productName && 
      l.week_number === weekNumber &&
      l.year === year
    );

    const currentSales = currentWeekSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const currentLosses = currentWeekLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const currentLossRate = currentSales > 0 ? ((currentLosses / currentSales) * 100) : 0;

    // Últimas 4 semanas (anteriores à semana atual)
    const last4WeeksStart = subWeeks(currentWeekStart, 4);
    const last4WeeksSales = salesRecords.filter(s => 
      s.product_name === productName && 
      new Date(s.date) >= last4WeeksStart &&
      new Date(s.date) < currentWeekStart
    );
    const last4WeeksLosses = lossRecords.filter(l => 
      l.product_name === productName && 
      new Date(l.date) >= last4WeeksStart &&
      new Date(l.date) < currentWeekStart
    );

    const avgSales = last4WeeksSales.reduce((sum, s) => sum + (s.quantity || 0), 0) / 4;
    const avgLosses = last4WeeksLosses.reduce((sum, l) => sum + (l.quantity || 0), 0) / 4;
    const avgLossRate = avgSales > 0 ? ((avgLosses / avgSales) * 100) : 0;

    // Variação percentual
    const salesChange = avgSales > 0 ? (((currentSales - avgSales) / avgSales) * 100) : 0;
    const lossesChange = avgLosses > 0 ? (((currentLosses - avgLosses) / avgLosses) * 100) : 0;

    // Tendência (baseada nas últimas 4 semanas)
    const weeklySales = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(currentWeekStart, i + 1);
      const weekSales = salesRecords.filter(s => 
        s.product_name === productName && 
        new Date(s.date) >= weekStart &&
        new Date(s.date) < addWeeks(weekStart, 1)
      ).reduce((sum, s) => sum + (s.quantity || 0), 0);
      weeklySales.push(weekSales);
    }

    const weeklyLosses = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(currentWeekStart, i + 1);
      const weekLosses = lossRecords.filter(l => 
        l.product_name === productName && 
        new Date(l.date) >= weekStart &&
        new Date(l.date) < addWeeks(weekStart, 1)
      ).reduce((sum, l) => sum + (l.quantity || 0), 0);
      weeklyLosses.push(weekLosses);
    }

    // Calcular tendência (comparar primeiras 2 semanas com últimas 2)
    const firstHalfSales = (weeklySales[0] + weeklySales[1]) / 2;
    const secondHalfSales = (weeklySales[2] + weeklySales[3]) / 2;
    const salesTrendChange = firstHalfSales > 0 ? (((secondHalfSales - firstHalfSales) / firstHalfSales) * 100) : 0;

    const firstHalfLosses = (weeklyLosses[0] + weeklyLosses[1]) / 2;
    const secondHalfLosses = (weeklyLosses[2] + weeklyLosses[3]) / 2;
    const lossesTrendChange = firstHalfLosses > 0 ? (((secondHalfLosses - firstHalfLosses) / firstHalfLosses) * 100) : 0;

    const salesTrend = salesTrendChange > 10 ? 'growing' : salesTrendChange < -10 ? 'decreasing' : 'stable';
    const lossesTrend = lossesTrendChange > 10 ? 'growing' : lossesTrendChange < -10 ? 'decreasing' : 'stable';

    // ========== CÁLCULO DA SUGESTÃO DE PRODUÇÃO ==========
    
    // Verificar se há evento ou feriado na semana
    const weekEvents = calendarEvents.filter(event => {
      const eventDate = parseISO(event.date);
      return eventDate >= currentWeekStart && eventDate <= weekEnd &&
             (event.sector === "Todos" || event.sector === selectedProduct.product.sector);
    });
    const hasEvent = weekEvents.length > 0;

    let suggestedProduction = 0;
    let suggestion = '';

    // CENÁRIO 1: Perda aumentou e venda não aumentou
    if (currentLosses > avgLosses && currentSales <= avgSales) {
      suggestedProduction = avgSales + avgLosses;
      suggestion = 'Manter produção';
    }
    // CENÁRIO 2: Venda subiu e perda subiu
    else if (currentSales > avgSales && currentLosses > avgLosses) {
      suggestedProduction = avgSales + avgLosses;
      suggestion = 'Manter produção';
    }
    // CENÁRIO 3: Venda subiu e perda caiu
    else if (currentSales > avgSales && currentLosses <= avgLosses) {
      suggestedProduction = avgSales + (avgSales * 0.10) + avgLosses;
      suggestion = 'Aumentar produção';
    }
    // CENÁRIO 4: Demais casos (venda e perda estáveis ou caindo)
    else {
      suggestedProduction = avgSales + avgLosses;
      suggestion = 'Manter ou reduzir produção';
    }

    // AJUSTE POR TIPO DE SEMANA
    if (hasEvent) {
      suggestedProduction = suggestedProduction * 1.30; // +30%
      suggestion = suggestion + ' (ajustado +30% por evento)';
    }

    suggestedProduction = Math.round(suggestedProduction);

    // DISTRIBUIÇÃO NOS DIAS
    const productionDays = selectedProduct.product.production_days || [];
    const daysCount = productionDays.length;
    const dailyProduction = daysCount > 0 ? Math.ceil(suggestedProduction / daysCount) : 0;

    return {
      currentSales: Math.round(currentSales),
      currentLosses: Math.round(currentLosses),
      currentLossRate: currentLossRate.toFixed(1),
      avgSales: Math.round(avgSales),
      avgLosses: Math.round(avgLosses),
      avgLossRate: avgLossRate.toFixed(1),
      salesChange: salesChange.toFixed(1),
      lossesChange: lossesChange.toFixed(1),
      salesTrend,
      lossesTrend,
      suggestion,
      suggestedProduction,
      dailyProduction
    };
  }, [selectedProduct, salesRecords, lossRecords, weekNumber, year, currentWeekStart, calendarEvents, weekEnd]);

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
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planejamento de Produção</h1>
          <p className="text-sm text-slate-500 mt-1">Planeje a produção semanal por produto</p>
          <p className="text-xs text-slate-400 mt-1">
            Última atualização: {format(lastUpdate, "HH:mm")}
          </p>
        </div>
        
        <div className="flex items-center gap-2 no-print">
          {saveStatus === 'saving' ? (
            <span className="text-xs text-slate-500 mr-2">Salvando...</span>
          ) : (
            <span className="text-xs text-green-600 mr-2">Salvo ✓</span>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecalculate}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recalcular
          </Button>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL: 70% Tabela + 30% Painel Lateral */}
      <div className="flex gap-4" id="planning-print-area">
        {/* TABELA PRINCIPAL - 70% */}
        <div className={`transition-all duration-300 ${selectedProduct ? 'w-[70%]' : 'w-full'}`}>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              {/* NAVEGAÇÃO DE SEMANA */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <div className="text-lg font-bold text-slate-900">Semana {weekNumber} - {year}</div>
                    <div className="text-sm text-slate-500">
                      {format(currentWeekStart, "dd/MM", { locale: ptBR })} - {format(weekEnd, "dd/MM", { locale: ptBR })}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Alerta se semana passada/atual */}
                {(isWeekInPast || isCurrentWeek) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded text-sm">
                    {isWeekInPast ? "⚠️ Semana passada - Edição bloqueada" : "⚠️ Semana atual - Edição bloqueada"}
                  </div>
                )}
              </div>

              {/* FILTROS */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
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
                    <TableRow 
                      key={item.product.id} 
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedProduct?.product.id === item.product.id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleProductClick(item)}
                    >
                      <TableCell className="font-medium text-sm sticky left-0 bg-white z-10 hover:text-blue-600 transition-colors">
                        {item.product.name}
                      </TableCell>
                      <TableCell>
                        <SectorBadge sector={item.product.sector} />
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600">
                        {item.product.recipe_yield > 1 ? `${item.product.recipe_yield}/dia` : `1 ${item.product.unit}`}
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-700">
                        {Math.round(item.avgByWeekday / 7)}/dia
                      </TableCell>
                      {item.projectedByDay.map((qty, idx) => {
                        const dayOfWeek = weekDays[idx].getDay();
                        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                        const dayName = dayNames[dayOfWeek];
                        const isProductionDay = (item.product.production_days || []).includes(dayName);
                        const isDisabled = isWeekInPast || isCurrentWeek || !isProductionDay;
                        
                        return (
                          <TableCell key={idx} className="text-center p-1">
                            <Input
                              type="number"
                              min="0"
                              value={plannedQuantities[`${item.product.id}-${idx}`] ?? qty}
                              onChange={(e) => handleQuantityChange(item.product.id, idx, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              disabled={isDisabled}
                              className={`h-8 text-center text-sm w-full ${isDisabled ? 'bg-slate-100 cursor-not-allowed text-slate-400' : 'bg-white'}`}
                            />
                          </TableCell>
                        );
                      })}
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

        {/* PAINEL LATERAL - 30% */}
        {selectedProduct && productAnalysis && (
          <div className="w-[30%] animate-in slide-in-from-right duration-300" id="planning-sidebar-panel">
            <Card className="border-0 shadow-lg h-full overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {selectedProduct.product.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <SectorBadge sector={selectedProduct.product.sector} />
                    <span className="text-xs text-slate-500">
                      {selectedProduct.product.recipe_yield} {selectedProduct.product.unit}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleClosePanel}
                  className="h-8 w-8 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* SEÇÃO 1: SEMANA ATUAL */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Semana Atual (Semana {weekNumber})
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Vendas:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {productAnalysis.currentSales} UN
                        </span>
                        {parseFloat(productAnalysis.salesChange) !== 0 && (
                          <span className={`flex items-center text-xs font-medium ${
                            parseFloat(productAnalysis.salesChange) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {parseFloat(productAnalysis.salesChange) > 0 ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )}
                            {Math.abs(parseFloat(productAnalysis.salesChange))}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Perdas:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {productAnalysis.currentLosses} UN
                        </span>
                        {parseFloat(productAnalysis.lossesChange) !== 0 && (
                          <span className={`flex items-center text-xs font-medium ${
                            parseFloat(productAnalysis.lossesChange) > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {parseFloat(productAnalysis.lossesChange) > 0 ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )}
                            {Math.abs(parseFloat(productAnalysis.lossesChange))}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t">
                      <span className="text-sm text-slate-600">Taxa de Perda:</span>
                      <span className="font-bold text-slate-900">
                        {productAnalysis.currentLossRate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 2: MÉDIA 4 SEMANAS */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Média Últimas 4 Semanas
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Vendas:</span>
                      <span className="font-medium text-slate-900">
                        {productAnalysis.avgSales} UN/semana
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Perdas:</span>
                      <span className="font-medium text-slate-900">
                        {productAnalysis.avgLosses} UN/semana
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Taxa de Perda:</span>
                      <span className="font-medium text-slate-900">
                        {productAnalysis.avgLossRate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 3: TENDÊNCIA E SUGESTÃO */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Tendência
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Vendas:</span>
                      <div className="flex items-center gap-1.5">
                        {productAnalysis.salesTrend === 'growing' && (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-600">Crescendo</span>
                          </>
                        )}
                        {productAnalysis.salesTrend === 'decreasing' && (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-600">Diminuindo</span>
                          </>
                        )}
                        {productAnalysis.salesTrend === 'stable' && (
                          <>
                            <Minus className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-500">Estável</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Perdas:</span>
                      <div className="flex items-center gap-1.5">
                        {productAnalysis.lossesTrend === 'growing' && (
                          <>
                            <TrendingUp className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-600">Crescendo</span>
                          </>
                        )}
                        {productAnalysis.lossesTrend === 'decreasing' && (
                          <>
                            <TrendingDown className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-600">Diminuindo</span>
                          </>
                        )}
                        {productAnalysis.lossesTrend === 'stable' && (
                          <>
                            <Minus className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-500">Estável</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-blue-700 block mb-1">
                          Sugestão de Produção
                        </span>
                        <span className="text-sm font-medium text-blue-900 block mb-1">
                          {productAnalysis.suggestion}
                        </span>
                        <div className="text-xs text-blue-700 space-y-0.5">
                          <div>Total semanal: <span className="font-bold">{productAnalysis.suggestedProduction} UN</span></div>
                          <div>Por dia de produção: <span className="font-bold">{productAnalysis.dailyProduction} UN</span></div>
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
                      onClick={handleApplySuggestion}
                      disabled={isWeekInPast || isCurrentWeek}
                    >
                      Aplicar Sugestão
                    </Button>
                  </div>
                </div>

                {/* Planejamento por Dia */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Planejamento Diário</h4>
                  <div className="space-y-1.5">
                    {weekDays.map((day, idx) => {
                      const qty = selectedProduct.projectedByDay[idx];
                      const planned = plannedQuantities[`${selectedProduct.product.id}-${idx}`] ?? qty;
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {format(day, "EEE dd/MM", { locale: ptBR })}:
                          </span>
                          <span className={`font-medium ${planned !== qty ? 'text-blue-600' : 'text-slate-900'}`}>
                            {planned}
                            {planned !== qty && (
                              <span className="text-xs text-slate-500 ml-1">
                                (era {qty})
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}