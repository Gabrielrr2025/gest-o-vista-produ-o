import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Printer, Download, RefreshCw, Save, Filter, FileDown, TrendingUp, TrendingDown, Minus, Lightbulb, ArrowUp, ArrowDown, X, FileText, FileSpreadsheet } from "lucide-react";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, getWeek, getYear, eachDayOfInterval, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import SectorBadge from "../components/common/SectorBadge";
import { toast } from "sonner";
import AutoSQLSync from "../components/import/AutoSQLSync";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Planning() {
  // Inicializar com a próxima semana (futura) - Semana começa na TERÇA
  const [currentWeekStart, setCurrentWeekStart] = useState(addWeeks(startOfWeek(new Date(), { weekStartsOn: 2 }), 1));
  const [selectedSector, setSelectedSector] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [plannedQuantities, setPlannedQuantities] = useState({});
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved'
  const saveTimeoutRef = React.useRef(null);
  const [panelWeekStart, setPanelWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 2 })); // Semana atual por padrão

  const weekNumber = getWeek(currentWeekStart, { weekStartsOn: 2 });
  const year = getYear(currentWeekStart);
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 2 });
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

  const { data: savedPlannings = [] } = useQuery({
    queryKey: ['planejamentos'],
    queryFn: () => base44.entities.Planejamento.list()
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
        const eventSectors = event.sectors || [event.sector || 'Todos'];
        return eventDate >= currentWeekStart && eventDate <= weekEnd &&
               (eventSectors.includes("Todos") || eventSectors.includes(product.sector));
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

  // Verificar se a semana é passada (não incluir semana atual)
  const today = new Date();
  const todayWeekStart = startOfWeek(today, { weekStartsOn: 2 });
  const isWeekInPast = currentWeekStart < todayWeekStart;

  const handleQuantityChange = (productId, dayIndex, value) => {
    // Validação: apenas números inteiros positivos
    const numValue = value === '' ? 0 : parseInt(value);
    if (isNaN(numValue) || numValue < 0) return;

    setPlannedQuantities(prev => ({
      ...prev,
      [`${productId}-${dayIndex}`]: numValue
    }));

    // Auto-save após 2 segundos
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      await savePlanning(productId);
      setSaveStatus('saved');
      setLastUpdate(new Date());
      toast.success("✓ Planejamento salvo");
    }, 2000);
  };

  const savePlanning = async (productId) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      // Coletar quantidades dos 7 dias
      const quantities = weekDays.map((_, idx) => 
        plannedQuantities[`${productId}-${idx}`] ?? 0
      );

      const total = quantities.reduce((sum, q) => sum + q, 0);

      // weekDays agora vai de Terça(idx 0) a Segunda(idx 6)
      const planningData = {
        product_id: productId,
        product_name: product.name,
        week_number: weekNumber,
        year: year,
        quantidade_terca: quantities[0],
        quantidade_quarta: quantities[1],
        quantidade_quinta: quantities[2],
        quantidade_sexta: quantities[3],
        quantidade_sabado: quantities[4],
        quantidade_domingo: quantities[5],
        quantidade_segunda: quantities[6],
        quantidade_total: total,
        data_planejamento: new Date().toISOString()
      };

      // Verificar se já existe planejamento para este produto + semana
      const existing = savedPlannings.find(p => 
        p.product_id === productId && 
        p.week_number === weekNumber && 
        p.year === year
      );

      if (existing) {
        await base44.entities.Planejamento.update(existing.id, planningData);
      } else {
        await base44.entities.Planejamento.create(planningData);
      }
    } catch (error) {
      console.error("Erro ao salvar planejamento:", error);
      toast.error("✗ Erro ao salvar. Tente novamente");
    }
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Buscar nome da empresa das configurações
      let companyName = 'Sistema de Produção';
      try {
        const configData = await base44.entities.SystemConfig.filter({ config_key: 'company_data' });
        if (configData.length > 0) {
          const companyData = JSON.parse(configData[0].config_value);
          companyName = companyData.company_name || 'Sistema de Produção';
        }
      } catch (error) {
        console.log('Configuração não encontrada, usando nome padrão');
      }

      // Cabeçalho
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Planejamento de Produção - Semana ${weekNumber}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(currentWeekStart, 'dd/MM/yyyy', { locale: ptBR })} a ${format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 6;
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 12;

      // Agrupar por setor
      const sectors = ['Padaria', 'Salgados', 'Confeitaria', 'Minimercado', 'Restaurante', 'Frios'];
      const planningWithTotals = planningData.map(p => ({
        ...p,
        totalPlanned: p.projectedByDay.reduce((sum, _, idx) => 
          sum + (plannedQuantities[`${p.product.id}-${idx}`] ?? p.projectedByDay[idx]), 0
        )
      })).filter(p => p.totalPlanned > 0);

      for (const sector of sectors) {
        const sectorProducts = planningWithTotals.filter(p => p.product.sector === sector);
        if (sectorProducts.length === 0) continue;

        // Verificar se precisa de nova página
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }

        // Cabeçalho do setor
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(sector, 15, yPosition);
        yPosition += 7;

        // Cabeçalho da tabela
        doc.setFontSize(8);
        doc.setFillColor(71, 85, 105);
        doc.rect(15, yPosition, 180, 6, 'F');
        doc.setTextColor(255, 255, 255);
        
        const colWidths = [50, 15, 15, 15, 15, 15, 15, 15, 20];
        const headers = ['Produto', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom', 'Seg', 'Total'];
        let xPos = 15;
        headers.forEach((header, i) => {
          doc.text(header, xPos + 2, yPosition + 4);
          xPos += colWidths[i];
        });
        
        yPosition += 6;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        // Linhas de produtos
        sectorProducts.forEach((item, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }

          if (index % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, yPosition, 180, 6, 'F');
          }

          xPos = 15;
          const productName = item.product.name.length > 30 ? item.product.name.substring(0, 27) + '...' : item.product.name;
          doc.text(productName, xPos + 2, yPosition + 4);
          xPos += colWidths[0];
          
          item.projectedByDay.forEach((projQty, idx) => {
            const qty = plannedQuantities[`${item.product.id}-${idx}`] ?? projQty;
            const value = qty > 0 ? qty.toFixed(0) : '-';
            doc.text(value, xPos + 2, yPosition + 4);
            xPos += colWidths[idx + 1];
          });
          
          doc.setFont('helvetica', 'bold');
          doc.text(item.totalPlanned.toFixed(0), xPos + 2, yPosition + 4);
          doc.setFont('helvetica', 'normal');

          yPosition += 6;
        });

        yPosition += 8;
      }

      // Rodapé em todas as páginas
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(companyName, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`planejamento_semana_${weekNumber}.pdf`);
      toast.success("✓ PDF exportado com sucesso!");
    } catch (error) {
      toast.error("✗ Erro ao exportar. Tente novamente");
      console.error(error);
    }
  };

  const handleRecalculate = () => {
    console.log("🔄 Iniciando recálculo de planejamento");
    
    const newPlannedQuantities = {};
    
    filteredPlanning.forEach(item => {
      const productName = item.product.name;
      
      // Dados da semana atual
      const currentWeekSales = salesRecords.filter(s => 
        s.product_name === productName && 
        s.week_number === weekNumber &&
        s.year === year
      ).reduce((sum, s) => sum + (s.quantity || 0), 0);
      
      const currentWeekLosses = lossRecords.filter(l => 
        l.product_name === productName && 
        l.week_number === weekNumber &&
        l.year === year
      ).reduce((sum, l) => sum + (l.quantity || 0), 0);

      // Última 4 semanas (anteriores à semana de planejamento)
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

      // APLICAR CENÁRIOS
      let suggestedProduction = 0;

      // CENÁRIO 1: Perda subiu E venda NÃO subiu
      if (currentWeekLosses > avgLosses && currentWeekSales <= avgSales) {
        suggestedProduction = avgSales + avgLosses;
        console.log(`  ${productName} - Cenário 1: Perda↑ Venda≤`);
      }
      // CENÁRIO 2: Venda subiu E perda subiu
      else if (currentWeekSales > avgSales && currentWeekLosses > avgLosses) {
        suggestedProduction = avgSales + avgLosses;
        console.log(`  ${productName} - Cenário 2: Venda↑ Perda↑`);
      }
      // CENÁRIO 3: Venda subiu E perda caiu (MELHOR CENÁRIO!)
      else if (currentWeekSales > avgSales && currentWeekLosses <= avgLosses) {
        suggestedProduction = avgSales + (avgSales * 0.10) + avgLosses;
        console.log(`  ${productName} - Cenário 3: Venda↑ Perda↓ (+10%)`);
      }
      // CENÁRIO 4: Outros casos
      else {
        suggestedProduction = avgSales + avgLosses;
        console.log(`  ${productName} - Cenário 4: Casos outros`);
      }

      // AJUSTE POR TIPO DE SEMANA
      const weekEvents = calendarEvents.filter(event => {
        const eventDate = parseISO(event.date);
        const eventSectors = event.sectors || [event.sector || 'Todos'];
        return eventDate >= currentWeekStart && eventDate <= weekEnd &&
               (eventSectors.includes("Todos") || eventSectors.includes(item.product.sector));
      });
      
      if (weekEvents.length > 0) {
        suggestedProduction = suggestedProduction * 1.30;
        console.log(`  ${productName} - Ajuste por evento: +30%`);
      }

      suggestedProduction = Math.round(suggestedProduction);

      // DISTRIBUIR NOS DIAS DE PRODUÇÃO
      const productionDays = item.product.production_days || [];
      const daysCount = productionDays.length;
      const dailyProduction = daysCount > 0 ? Math.ceil(suggestedProduction / daysCount) : 0;

      // Aplicar nos dias de produção
      weekDays.forEach((day, idx) => {
        const dayOfWeek = day.getDay();
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayName = dayNames[dayOfWeek];
        
        if (productionDays.includes(dayName)) {
          newPlannedQuantities[`${item.product.id}-${idx}`] = dailyProduction;
        }
      });

      console.log(`  ${productName}: Produção=${suggestedProduction} UN/semana, ${dailyProduction} UN/dia`);
    });

    setPlannedQuantities(newPlannedQuantities);
    setLastUpdate(new Date());
    
    // Salvar automaticamente
    filteredPlanning.forEach(item => {
      setTimeout(() => savePlanning(item.product.id), 500);
    });

    toast.success("✓ Sugestões recalculadas com base na lógica de cenários");
  };

  const handleProductClick = (item) => {
    setSelectedProduct(item);
    setPanelWeekStart(startOfWeek(new Date(), { weekStartsOn: 2 })); // Reset para semana atual
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

  // Análise do produto selecionado (usa panelWeekStart para a semana do painel)
  const productAnalysis = useMemo(() => {
    if (!selectedProduct) return null;

    const productName = selectedProduct.product.name;
    const panelWeekNumber = getWeek(panelWeekStart, { weekStartsOn: 2 });
    const panelYear = getYear(panelWeekStart);
    const panelWeekEnd = endOfWeek(panelWeekStart, { weekStartsOn: 2 });

    // Tentar buscar dados do banco de dados SQL (vw_movimentacoes)
    let currentSales = 0;
    let currentLosses = 0;
    let currentLossRate = 0;

    // Fallback: buscar do banco local
    const currentWeekSales = salesRecords.filter(s => 
      s.product_name === productName && 
      s.week_number === panelWeekNumber &&
      s.year === panelYear
    );
    const currentWeekLosses = lossRecords.filter(l => 
      l.product_name === productName && 
      l.week_number === panelWeekNumber &&
      l.year === panelYear
    );

    currentSales = currentWeekSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    currentLosses = currentWeekLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    currentLossRate = currentSales > 0 ? ((currentLosses / currentSales) * 100) : 0;
    
    console.log(`📊 Painel - ${productName} Semana ${panelWeekNumber}: Vendas=${currentSales}, Perdas=${currentLosses}`);

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

    // Tendência (baseada nas últimas 4 semanas antes da semana do painel)
    const weeklySales = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(panelWeekStart, i + 1);
      const weekSales = salesRecords.filter(s => 
        s.product_name === productName && 
        new Date(s.date) >= weekStart &&
        new Date(s.date) < addWeeks(weekStart, 1)
      ).reduce((sum, s) => sum + (s.quantity || 0), 0);
      weeklySales.push(weekSales);
    }

    const weeklyLosses = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = subWeeks(panelWeekStart, i + 1);
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
    
    // Verificar se há evento ou feriado na semana do painel
    const weekEvents = calendarEvents.filter(event => {
      const eventDate = parseISO(event.date);
      const eventSectors = event.sectors || [event.sector || 'Todos'];
      return eventDate >= panelWeekStart && eventDate <= panelWeekEnd &&
             (eventSectors.includes("Todos") || eventSectors.includes(selectedProduct.product.sector));
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
      dailyProduction,
      panelWeekNumber,
      panelYear
    };
  }, [selectedProduct, salesRecords, lossRecords, panelWeekStart, calendarEvents]);

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      
      // Preparar dados para exportação
      const headers = ["Produto", "Setor", ...DIAS_SEMANA, "Total"];
      const rows = filteredPlanning.map(p => {
        const quantities = p.projectedByDay.map((qty, idx) => 
          plannedQuantities[`${p.product.id}-${idx}`] ?? qty
        );
        const total = quantities.reduce((sum, q) => sum + q, 0);
        
        return [
          p.product.name,
          p.product.sector,
          ...quantities,
          total
        ];
      });

      // Criar worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Semana ${weekNumber}`);
      
      // Gerar e baixar
      const fileName = `planejamento_semana_${weekNumber}_${format(new Date(), 'ddMMyyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success("✓ Excel exportado com sucesso!");
    } catch (error) {
      toast.error("✗ Erro ao exportar. Tente novamente");
      console.error(error);
    }
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportPDF}
            className="border-red-200 hover:bg-red-50 text-red-700"
          >
            <FileText className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar Excel
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

                {/* Alerta se semana passada */}
                {isWeekInPast && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded text-sm">
                    ⚠️ Semana passada - apenas visualização
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
                        const isDisabled = isWeekInPast || !isProductionDay;
                        
                        return (
                          <TableCell key={idx} className="text-center p-1">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
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
                          <span>{totalPlanned} {item.product.unit?.toUpperCase()}</span>
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
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between mb-2">
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
                </div>
                
                {/* Navegação de Semana do Painel */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setPanelWeekStart(subWeeks(panelWeekStart, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-700">
                      Semana {productAnalysis?.panelWeekNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(panelWeekStart, "dd/MM", { locale: ptBR })} - {format(endOfWeek(panelWeekStart, { weekStartsOn: 2 }), "dd/MM", { locale: ptBR })}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPanelWeekStart(addWeeks(panelWeekStart, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* SEÇÃO 1: SEMANA ATUAL */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Dados da Semana {productAnalysis.panelWeekNumber}
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
                      disabled={isWeekInPast}
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