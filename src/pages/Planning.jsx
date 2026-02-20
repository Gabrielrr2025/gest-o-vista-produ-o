import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  X, 
  FileText, 
  FileSpreadsheet,
  Save,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  Lock,
  LockOpen,
  CalendarDays,
  AlertTriangle,
  Info as InfoIcon
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_KEYS = {
  sector:    'planning_selected_sector',
  search:    'planning_search_term',
  quantities: (start) => `planning_quantities_${start}`,
};

function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Função auxiliar para calcular início da semana (TERÇA)
const getWeekBounds = (date) => {
  const start = startOfWeek(date, { weekStartsOn: 2 }); // 2 = Terça
  const end = endOfWeek(date, { weekStartsOn: 2 });
  return { start, end };
};

export default function Planning() {
  const queryClient = useQueryClient();
  
  // Estado: semana começa na PRÓXIMA terça (semana futura para planejamento)
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 2 });
    return addWeeks(currentWeekStart, 1); // Próxima semana
  });
  
  const [selectedSector, setSelectedSector] = useState(() => lsGet(LS_KEYS.sector, 'all'));
  const [searchTerm, setSearchTerm] = useState(() => lsGet(LS_KEYS.search, ''));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [plannedQuantities, setPlannedQuantities] = useState({});
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");

  // Refs para debounce
  const saveTimeoutRef = useRef({});

  // Calcular datas da semana
  const weekBounds = useMemo(() => getWeekBounds(currentDate), [currentDate]);
  const weekDays = useMemo(() => 
    eachDayOfInterval({ start: weekBounds.start, end: weekBounds.end }), 
    [weekBounds]
  );

  const startDate = format(weekBounds.start, 'yyyy-MM-dd');
  const endDate = format(weekBounds.end, 'yyyy-MM-dd');

  // Verificar se a semana é passada ou atual
  const today = new Date();
  const todayWeekStart = startOfWeek(today, { weekStartsOn: 2 });
  const isWeekInPast = currentDate <= todayWeekStart;
  const isWeekLocked = isWeekInPast && !isUnlocked;

  // Buscar código de edição
  const { data: configData } = useQuery({
    queryKey: ['config', 'codigo_edicao_planejamento'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getConfig', {
        chave: 'codigo_edicao_planejamento'
      });
      return response.data;
    }
  });

  const editCode = configData?.valor || '1234';

  // Buscar dados do planejamento via function
  const planningQuery = useQuery({
    queryKey: ['planningData', startDate, endDate],
    queryFn: async () => {
      console.log('📤 Buscando dados de planejamento:', { startDate, endDate });
      const response = await base44.functions.invoke('getPlanningData', {
        startDate,
        endDate,
      });
      console.log('📥 Dados recebidos:', response.data);
      return response.data;
    }
  });

  // Buscar planejamento salvo
  const savedPlanningQuery = useQuery({
    queryKey: ['savedPlanning', startDate, endDate],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPlanning', {
        startDate,
        endDate
      });
      return response.data;
    }
  });

  // Carregar planejamento salvo — banco tem prioridade, localStorage é fallback
  useEffect(() => {
    if (savedPlanningQuery.data?.planejamentos && savedPlanningQuery.data.planejamentos.length > 0) {
      const saved = {};
      savedPlanningQuery.data.planejamentos.forEach(item => {
        const dayIndex = weekDays.findIndex(d =>
          format(d, 'yyyy-MM-dd') === item.data
        );
        if (dayIndex !== -1) {
          saved[`${item.produto_id}-${dayIndex}`] = parseFloat(item.quantidade_planejada);
        }
      });
      setPlannedQuantities(saved);
    } else if (savedPlanningQuery.data && savedPlanningQuery.data.planejamentos?.length === 0) {
      // Banco não tem dados — tentar localStorage como fallback
      const cached = lsGet(LS_KEYS.quantities(startDate));
      if (cached && Object.keys(cached).length > 0) {
        setPlannedQuantities(cached);
        setHasUnsavedChanges(true); // marca para o usuário salvar no banco
      }
    }
  }, [savedPlanningQuery.data, weekDays, startDate]);

  // Mutation para salvar planejamento
  const saveMutation = useMutation({
    mutationFn: async ({ produto_id, data, quantidade_planejada }) => {
      const response = await base44.functions.invoke('savePlanning', {
        produto_id,
        data,
        quantidade_planejada
      });
      return response.data;
    },
    onSuccess: () => {
      // NÃO invalidar queries aqui - causa conflito com estado local
      // A query só será invalidada ao mudar de semana ou recarregar página
      console.log('✅ Quantidade salva no banco');
    }
  });

  const planningData = planningQuery.data?.products || [];

  // Filtrar por setor e busca
  const filteredPlanning = useMemo(() => {
    let filtered = planningData;
    
    if (selectedSector !== "all") {
      filtered = filtered.filter(p => p.setor === selectedSector);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.produto_nome.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [planningData, selectedSector, searchTerm]);

  // Sincronizar selectedProduct com dados atualizados
  useEffect(() => {
    if (selectedProduct && filteredPlanning.length > 0) {
      const updated = filteredPlanning.find(p => p.produto_id === selectedProduct.produto_id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProduct)) {
        console.log('🔄 Atualizando selectedProduct com dados novos');
        setSelectedProduct(updated);
      }
    }
  }, [filteredPlanning]);

  // Navegação de semanas
  const handlePreviousWeek = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
    setSelectedProduct(null);
    setIsUnlocked(false);
    // Recarregar dados da nova semana
    queryClient.invalidateQueries(['savedPlanning']);
    queryClient.invalidateQueries(['planningData']);
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
    setSelectedProduct(null);
    setIsUnlocked(false);
    // Recarregar dados da nova semana
    queryClient.invalidateQueries(['savedPlanning']);
    queryClient.invalidateQueries(['planningData']);
  };

  // Auto-save com debounce
  const saveQuantity = useCallback((productId, dayIndex, quantity) => {
    const dateStr = format(weekDays[dayIndex], 'yyyy-MM-dd');
    const key = `${productId}-${dayIndex}`;

    // Cancelar timeout anterior
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    // Salvar após 1 segundo de inatividade
    saveTimeoutRef.current[key] = setTimeout(() => {
      saveMutation.mutate({
        produto_id: productId,
        data: dateStr,
        quantidade_planejada: quantity
      });
    }, 1000);
  }, [weekDays, saveMutation]);

  // Alterar quantidade planejada
  const handleQuantityChange = (productId, dayIndex, value) => {
    if (isWeekLocked) {
      setShowUnlockDialog(true);
      return;
    }

    const numValue = value === '' ? 0 : parseInt(value);
    if (isNaN(numValue) || numValue < 0) return;

    setPlannedQuantities(prev => ({
      ...prev,
      [`${productId}-${dayIndex}`]: numValue
    }));

    setHasUnsavedChanges(true);
  };


  // Salvar planejamento completo manualmente
  const handleSave = async () => {
    if (isWeekLocked) { setShowUnlockDialog(true); return; }
    setIsSaving(true);
    try {
      const savePromises = [];
      Object.entries(plannedQuantities).forEach(([key, qty]) => {
        const [productId, dayIdx] = key.split('-');
        const dateStr = format(weekDays[parseInt(dayIdx)], 'yyyy-MM-dd');
        savePromises.push(
          base44.functions.invoke('savePlanning', {
            produto_id: productId,
            data: dateStr,
            quantidade_planejada: qty
          })
        );
      });
      await Promise.all(savePromises);
      setHasUnsavedChanges(false);
      lsSet(LS_KEYS.quantities(startDate), plannedQuantities);
      toast.success('✅ Planejamento salvo com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar planejamento');
    } finally {
      setIsSaving(false);
    }
  };
  // Desbloquear com código
  const handleUnlock = () => {
    if (unlockCode === editCode) {
      setIsUnlocked(true);
      setShowUnlockDialog(false);
      setUnlockCode("");
      toast.success("✅ Planejamento desbloqueado para edição");
    } else {
      toast.error("❌ Código incorreto");
    }
  };

  // Recalcular tudo (aplicar sugestões para todos)
  const handleRecalculate = () => {
    if (isWeekLocked) {
      setShowUnlockDialog(true);
      return;
    }

    const newQuantities = {};
    
    filteredPlanning.forEach(product => {
      const productionDays = product.production_days || [];
      const hasProductionDays = productionDays.length > 0;
      
      // Contar dias ativos de produção
      const activeDaysCount = weekDays.filter((day) => {
        const dayOfWeek = day.getDay();
        const dayNameMap = {
          0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
          4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
        };
        return !hasProductionDays || productionDays.includes(dayNameMap[dayOfWeek]);
      }).length || weekDays.length;
      
      // Distribuir apenas nos dias de produção
      const dailyQty = activeDaysCount > 0 
        ? Math.ceil(product.suggested_production / activeDaysCount)
        : 0;
      
      weekDays.forEach((day, idx) => {
        const key = `${product.produto_id}-${idx}`;
        const dayOfWeek = day.getDay();
        const dayNameMap = {
          0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
          4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
        };
        const isProductionDay = !hasProductionDays || productionDays.includes(dayNameMap[dayOfWeek]);
        
        newQuantities[key] = isProductionDay ? dailyQty : 0;
        
        // Salvar cada um
        const dateStr = format(day, 'yyyy-MM-dd');
        saveMutation.mutate({
          produto_id: product.produto_id,
          data: dateStr,
          quantidade_planejada: isProductionDay ? dailyQty : 0
        });
      });
    });

    setPlannedQuantities(newQuantities);
    setHasUnsavedChanges(true);
    toast.success("Sugestões aplicadas! Clique em Salvar para confirmar.");
  };

  // Aplicar sugestão para produto específico
  const handleApplySuggestion = () => {
    if (!selectedProduct) return;
    
    if (isWeekLocked) {
      setShowUnlockDialog(true);
      return;
    }

    const productionDays = selectedProduct.production_days || [];
    const hasProductionDays = productionDays.length > 0;
    
    // Contar quantos dias de produção existem
    const activeDaysCount = weekDays.filter((day) => {
      const dayOfWeek = day.getDay();
      const dayNameMap = {
        0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
        4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
      };
      return !hasProductionDays || productionDays.includes(dayNameMap[dayOfWeek]);
    }).length || weekDays.length;
    
    // Distribuir produção apenas nos dias ativos
    const dailyQty = activeDaysCount > 0 
      ? Math.ceil(selectedProduct.suggested_production / activeDaysCount)
      : 0;
    
    const newQuantities = { ...plannedQuantities };
    
    weekDays.forEach((day, idx) => {
      const key = `${selectedProduct.produto_id}-${idx}`;
      const dayOfWeek = day.getDay();
      const dayNameMap = {
        0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
        4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
      };
      const isProductionDay = !hasProductionDays || productionDays.includes(dayNameMap[dayOfWeek]);
      
      // Só aplicar quantidade nos dias de produção
      newQuantities[key] = isProductionDay ? dailyQty : 0;
      
      // Salvar
      const dateStr = format(day, 'yyyy-MM-dd');
      saveMutation.mutate({
        produto_id: selectedProduct.produto_id,
        data: dateStr,
        quantidade_planejada: isProductionDay ? dailyQty : 0
      });
    });

    setPlannedQuantities(newQuantities);
    toast.success(`Sugestão aplicada para ${selectedProduct.produto_nome}`);
    
    // Fechar painel lateral
    setSelectedProduct(null);
  };

  // Exportar para Excel
  const handleExportExcel = () => {
    try {
      const excelData = filteredPlanning.map(product => {
        const row = {
          'Produto': product.produto_nome,
          'Setor': product.setor,
          'Unidade': product.unidade
        };

        weekDays.forEach((day, idx) => {
          const dayLabel = format(day, 'EEE dd/MM', { locale: ptBR });
          const qty = plannedQuantities[`${product.produto_id}-${idx}`] || 0;
          row[dayLabel] = qty;
        });

        row['Total'] = getProductTotal(product.produto_id);

        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [
        { wch: 30 },
        { wch: 15 },
        { wch: 10 },
        { wch: 12 },
        ...weekDays.map(() => ({ wch: 12 })),
        { wch: 10 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Planejamento');

      const fileName = `Planejamento_${format(weekBounds.start, 'dd-MM-yyyy')}_a_${format(weekBounds.end, 'dd-MM-yyyy')}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast.success("Arquivo Excel exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar arquivo Excel");
    }
  };

  // Exportar para PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape');

      doc.setFontSize(18);
      doc.text('Planejamento de Produção', 14, 20);

      doc.setFontSize(12);
      doc.text(
        `Semana: ${format(weekBounds.start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(weekBounds.end, 'dd/MM/yyyy', { locale: ptBR })}`,
        14,
        28
      );

      if (selectedSector !== 'all') {
        doc.text(`Setor: ${selectedSector}`, 14, 35);
      }

      let yPos = selectedSector !== 'all' ? 40 : 35;
      const startX = 14;
      const rowHeight = 7;
      // Colunas: Produto (maior), Setor, 7 dias (mais espaço), Total
      const colWidths = [60, 25, ...weekDays.map(() => 18), 20];
      
      // Cabeçalhos
      doc.setFillColor(245, 158, 11);
      doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7); // Fonte menor para caber melhor
      doc.setFont('helvetica', 'bold');
      
      let xPos = startX;
      const headers = [
        'Produto',
        'Setor',
        ...weekDays.map(day => format(day, 'EE dd/MM', { locale: ptBR })), // EE = apenas 3 letras
        'Total'
      ];
      
      headers.forEach((header, i) => {
        // Centralizar texto na célula
        const textWidth = doc.getTextWidth(header);
        const centerX = xPos + (colWidths[i] / 2) - (textWidth / 2);
        doc.text(header, centerX, yPos + 4.5);
        xPos += colWidths[i];
      });
      
      yPos += rowHeight;
      
      // Dados
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      filteredPlanning.forEach((product, idx) => {
        if (yPos > 180) {
          doc.addPage('landscape');
          yPos = 20;
        }
        
        // Alternar cor de fundo
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        }
        
        xPos = startX;
        const rowData = [
          product.produto_nome.length > 30 ? product.produto_nome.substring(0, 27) + '...' : product.produto_nome,
          product.setor.substring(0, 12),
          ...weekDays.map((_, i) => {
            const qty = plannedQuantities[`${product.produto_id}-${i}`] || 0;
            return qty > 0 ? qty.toString() : '-';
          }),
          getProductTotal(product.produto_id).toString()
        ];
        
        rowData.forEach((cell, i) => {
          // Primeira coluna: alinhada à esquerda
          // Demais colunas: centralizadas
          if (i === 0) {
            doc.text(cell, xPos + 2, yPos + 4.5);
          } else {
            const textWidth = doc.getTextWidth(cell);
            const centerX = xPos + (colWidths[i] / 2) - (textWidth / 2);
            doc.text(cell, centerX, yPos + 4.5);
          }
          xPos += colWidths[i];
        });
        
        yPos += rowHeight;
      });

      const fileName = `Planejamento_${format(weekBounds.start, 'dd-MM-yyyy')}_a_${format(weekBounds.end, 'dd-MM-yyyy')}.pdf`;

      doc.save(fileName);

      toast.success("Arquivo PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar arquivo PDF");
    }
  };

  // Calcular total planejado para um produto
  const getProductTotal = (productId) => {
    return weekDays.reduce((sum, _, idx) => {
      const qty = plannedQuantities[`${productId}-${idx}`] || 0;
      return sum + qty;
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planejamento de Produção</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize a produção semanal com base em dados históricos
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Navegador de Semanas */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handlePreviousWeek}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg min-w-[200px] justify-center">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-900">
              {format(weekBounds.start, 'dd/MM', { locale: ptBR })} a {format(weekBounds.end, 'dd/MM', { locale: ptBR })}
            </span>
          </div>

          <Button 
            variant="outline" 
            size="icon"
            onClick={handleNextWeek}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {isWeekInPast && (
            <div className="ml-2 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex items-center gap-1">
              {isUnlocked ? (
                <>
                  <LockOpen className="w-3 h-3" />
                  Desbloqueado
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" />
                  Bloqueado
                </>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={planningQuery.isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalcular
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
          >
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving || isWeekLocked}
            className={hasUnsavedChanges ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : hasUnsavedChanges ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar produto..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); lsSet(LS_KEYS.search, e.target.value); }}
          className="sm:w-64"
        />
        
        <Select value={selectedSector} onValueChange={(v) => { setSelectedSector(v); lsSet(LS_KEYS.sector, v); }}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            <SelectItem value="Padaria">Padaria</SelectItem>
            <SelectItem value="Confeitaria">Confeitaria</SelectItem>
            <SelectItem value="Salgados">Salgados</SelectItem>
            <SelectItem value="Frios">Frios</SelectItem>
            <SelectItem value="Restaurante">Restaurante</SelectItem>
            <SelectItem value="Minimercado">Minimercado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Layout: Tabela (70%) + Painel Lateral (30%) */}
      <div className="flex gap-6">
        {/* Tabela de Planejamento */}
        <div className={selectedProduct ? "w-[70%]" : "w-full"}>
          <Card>
            <CardContent className="p-0">
              {planningQuery.isLoading ? (
                <div className="p-8 text-center text-slate-500">
                  Carregando dados...
                </div>
              ) : filteredPlanning.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  Nenhum produto encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10 w-48">Produto</TableHead>
                        <TableHead className="text-center w-20">Setor</TableHead>
                        <TableHead className="text-center w-24">Média</TableHead>
                        {weekDays.map((day, idx) => (
                          <TableHead key={idx} className="text-center w-24">
                            <div className="text-xs font-medium capitalize">
                              {format(day, 'EEE', { locale: ptBR })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format(day, 'dd/MM')}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center w-24">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlanning.map((product) => {
                        const total = getProductTotal(product.produto_id);
                        const isSelected = selectedProduct?.produto_id === product.produto_id;
                        
                        return (
                          <TableRow 
                            key={product.produto_id}
                            className={`cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedProduct(product)}
                          >
                            <TableCell className="sticky left-0 bg-white font-medium">
                              {product.produto_nome}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="px-2 py-1 text-xs rounded-full bg-slate-100">
                                {product.setor}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-sm text-slate-600">
                              {Math.round(product.avg_sales)} {product.unidade}
                            </TableCell>
                            {weekDays.map((day, idx) => {
                             const qty = plannedQuantities[`${product.produto_id}-${idx}`] || 0;

                             const dayOfWeek = day.getDay();
                             const dayNameMap = {
                               0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
                               4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
                             };
                             const dayName = dayNameMap[dayOfWeek];

                             const productionDays = product.production_days || [];
                             const isProductionDay = productionDays.length === 0 || productionDays.includes(dayName);

                             return (
                               <TableCell key={idx} className={`p-1 ${!isProductionDay ? 'bg-slate-50' : ''}`}>
                                 {isProductionDay ? (
                                   <Input
                                     type="number"
                                     min="0"
                                     value={qty || ''}
                                     onChange={(e) => handleQuantityChange(product.produto_id, idx, e.target.value)}
                                     className="w-20 text-center h-9"
                                     disabled={isWeekLocked}
                                     title={isWeekLocked ? 'Semana bloqueada' : ''}
                                   />
                                 ) : (
                                   <div 
                                     className="w-20 h-9 flex items-center justify-center rounded-md bg-slate-100 border border-slate-200"
                                     title={`${product.produto_nome} não é produzido nas ${dayName}s`}
                                   >
                                     <span className="text-slate-400 text-lg font-bold leading-none">—</span>
                                   </div>
                                 )}
                               </TableCell>
                             );
                            })}
                            <TableCell className="text-center font-bold">
                              {total} {product.unidade}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel Lateral */}
        {selectedProduct && (
          <div className="w-[30%]">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{selectedProduct.produto_nome}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedProduct(null)}
                    className="h-6 w-6"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-slate-500">
                  {selectedProduct.setor} · {selectedProduct.unidade}
                </p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* SEÇÃO 1: Semana Atual */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Semana Atual
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Vendas:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {selectedProduct.current_sales} {selectedProduct.unidade}
                        </span>
                        {selectedProduct.sales_trend === 'growing' && (
                          <ArrowUp className="w-3 h-3 text-green-600" />
                        )}
                        {selectedProduct.sales_trend === 'decreasing' && (
                          <ArrowDown className="w-3 h-3 text-red-600" />
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Perdas:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {selectedProduct.current_losses} {selectedProduct.unidade}
                        </span>
                        {selectedProduct.losses_trend === 'growing' && (
                          <ArrowUp className="w-3 h-3 text-red-600" />
                        )}
                        {selectedProduct.losses_trend === 'decreasing' && (
                          <ArrowDown className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t">
                      <span className="text-slate-600">Taxa de Perda:</span>
                      <span className="font-bold text-slate-900">
                        {selectedProduct.current_loss_rate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 2: Média 4 Semanas */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Média Últimas 4 Semanas
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Vendas:</span>
                      <span className="font-medium text-slate-900">
                        {selectedProduct.avg_sales} {selectedProduct.unidade}/semana
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Perdas:</span>
                      <span className="font-medium text-slate-900">
                        {selectedProduct.avg_losses} {selectedProduct.unidade}/semana
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Taxa de Perda:</span>
                      <span className="font-medium text-slate-900">
                        {selectedProduct.avg_loss_rate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO CALENDÁRIO: Eventos que impactam a semana */}
                {((selectedProduct.eventos_semana && selectedProduct.eventos_semana.length > 0) ||
                  (selectedProduct.eventos_semana_info && selectedProduct.eventos_semana_info.length > 0)) && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-purple-500" />
                      Eventos na semana
                    </h4>
                    <div className="space-y-2">
                      {/* Eventos com impacto numérico */}
                      {selectedProduct.eventos_semana?.map((ev, idx) => {
                        const positivo = ev.impacto_pct > 0;
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg px-3 py-2 border text-xs ${
                              positivo
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`font-semibold ${positivo ? 'text-blue-800' : 'text-amber-800'}`}>
                                {ev.nome}
                              </span>
                              <span className={`font-bold text-sm px-1.5 py-0.5 rounded ${
                                positivo
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {positivo ? '+' : ''}{ev.impacto_pct}%
                              </span>
                            </div>
                            <div className={`opacity-70 ${positivo ? 'text-blue-700' : 'text-amber-700'}`}>
                              {format(new Date(ev.data + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
                              {ev.tipo && ` · ${ev.tipo}`}
                            </div>
                            {ev.notas && (
                              <div className={`mt-1 opacity-60 italic ${positivo ? 'text-blue-700' : 'text-amber-700'}`}>
                                {ev.notas}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Eventos apenas informativos (impacto = 0) */}
                      {selectedProduct.eventos_semana_info?.map((ev, idx) => (
                        <div
                          key={`info-${idx}`}
                          className="rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-xs"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-slate-700">{ev.nome}</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <InfoIcon className="w-3 h-3" />
                              Info
                            </span>
                          </div>
                          <div className="text-slate-500">
                            {format(new Date(ev.data + 'T12:00:00'), "EEEE, dd/MM", { locale: ptBR })}
                            {ev.tipo && ` · ${ev.tipo}`}
                          </div>
                        </div>
                      ))}

                      {/* Resumo do impacto total */}
                      {selectedProduct.eventos_semana?.length > 0 && (
                        <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-between ${
                          selectedProduct.multiplicador_calendario >= 1
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <span>Impacto total na sugestão:</span>
                          <span className="font-bold text-sm">
                            {selectedProduct.multiplicador_calendario >= 1 ? '+' : ''}
                            {((selectedProduct.multiplicador_calendario - 1) * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SEÇÃO 3: Tendência e Sugestão */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Tendência
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Vendas:</span>
                      <div className="flex items-center gap-1.5">
                        {selectedProduct.sales_trend === 'growing' && (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-600">Crescendo</span>
                          </>
                        )}
                        {selectedProduct.sales_trend === 'decreasing' && (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-600">Diminuindo</span>
                          </>
                        )}
                        {selectedProduct.sales_trend === 'stable' && (
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
                        {selectedProduct.losses_trend === 'growing' && (
                          <>
                            <TrendingUp className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-600">Crescendo</span>
                          </>
                        )}
                        {selectedProduct.losses_trend === 'decreasing' && (
                          <>
                            <TrendingDown className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-600">Diminuindo</span>
                          </>
                        )}
                        {selectedProduct.losses_trend === 'stable' && (
                          <>
                            <Minus className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-500">Estável</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sugestão */}
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-blue-700">Sugestão de Produção</span>
                      </div>
                      {/* Badge de confiança */}
                      {selectedProduct.confianca && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          selectedProduct.confianca === 'alta'      ? 'bg-green-100 text-green-700' :
                          selectedProduct.confianca === 'media'     ? 'bg-yellow-100 text-yellow-700' :
                          selectedProduct.confianca === 'baixa'     ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedProduct.confianca === 'sem_dados' ? 'Sem histórico' : `Confiança ${selectedProduct.confianca_label ?? selectedProduct.confianca}`}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-blue-800 mb-2 leading-relaxed">
                      {selectedProduct.suggestion}
                    </p>

                    <div className="text-xs text-blue-700 font-bold mb-2">
                      Total sugerido: {selectedProduct.suggested_production} {selectedProduct.unidade}/semana
                    </div>

                    {/* Detalhes do cálculo PCP */}
                    {selectedProduct.calc_details && selectedProduct.semanas_com_dados > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700 space-y-1">
                        <p className="font-semibold text-blue-800">Detalhes do cálculo (PCP):</p>

                        {/* Passo A: MMP */}
                        <div className="space-y-0.5">
                          <p className="opacity-70 font-medium">A — Média Móvel Ponderada</p>
                          <div className="flex justify-between">
                            <span>MMP ({selectedProduct.calc_details.semanas_com_dados} sem.):</span>
                            <span className="font-medium">{selectedProduct.calc_details.mmp_vendas} {selectedProduct.unidade}</span>
                          </div>
                          {selectedProduct.calc_details.multiplicador_calendario !== 1 && (
                            <div className="flex justify-between">
                              <span>× calendário ({selectedProduct.calc_details.multiplicador_calendario >= 1 ? '+' : ''}{((selectedProduct.calc_details.multiplicador_calendario - 1) * 100).toFixed(0)}%):</span>
                              <span className={`font-medium ${selectedProduct.calc_details.multiplicador_calendario >= 1 ? 'text-blue-500' : 'text-amber-500'}`}>
                                {selectedProduct.calc_details.demanda_prevista} {selectedProduct.unidade}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Passo B: Buffer estatístico */}
                        <div className="space-y-0.5 pt-1">
                          <p className="opacity-70 font-medium">B — Buffer estatístico (k × σ)</p>
                          <div className="flex justify-between">
                            <span>σ (desvio padrão):</span>
                            <span className="font-medium">{selectedProduct.calc_details.sigma_demanda} {selectedProduct.unidade}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>k (nível {selectedProduct.calc_details.nivel_servico}):</span>
                            <span className="font-medium">{selectedProduct.calc_details.k_fator}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>→ Buffer = {selectedProduct.calc_details.k_fator} × {selectedProduct.calc_details.sigma_demanda}:</span>
                            <span>+{selectedProduct.calc_details.buffer_valor} {selectedProduct.unidade}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Demanda + buffer:</span>
                            <span className="font-medium">{selectedProduct.calc_details.demanda_com_buffer} {selectedProduct.unidade}</span>
                          </div>
                        </div>

                        {/* Passo C: Taxa de perda */}
                        <div className="space-y-0.5 pt-1">
                          <p className="opacity-70 font-medium">C — Taxa de perda (mediana)</p>
                          <div className="flex justify-between">
                            <span>Taxa histórica:</span>
                            <span className="font-medium">{selectedProduct.calc_details.taxa_perda_pct}%</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>→ Produção (÷ 1−taxa):</span>
                            <span>{selectedProduct.suggested_production} {selectedProduct.unidade}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                      onClick={handleApplySuggestion}
                    >
                      Aplicar Sugestão
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialog de Desbloqueio */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Planejamento Bloqueado</DialogTitle>
            <DialogDescription>
              Esta semana está bloqueada. Digite o código de edição para desbloquear.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Digite o código"
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              className="text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUnlockDialog(false);
              setUnlockCode("");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUnlock}>
              Desbloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}