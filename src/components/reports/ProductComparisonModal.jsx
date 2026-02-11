import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import DateRangePicker from "./DateRangePicker";
import ProductComparisonChart from "./ProductComparisonChart";
import ProductComparisonTable from "./ProductComparisonTable";

export default function ProductComparisonModal({ 
  isOpen, 
  onClose, 
  initialProduct,
  initialDateRange,
  allProducts = [],
  type = 'sales'
}) {
  // Produtos selecionados para comparação (máx 3)
  const [selectedProducts, setSelectedProducts] = useState([]);
  
  // Período compartilhado
  const [dateRange, setDateRange] = useState(initialDateRange);

  // Adicionar produto inicial quando modal abre
  React.useEffect(() => {
    if (isOpen && initialProduct) {
      console.log('📦 Initial Product recebido:', initialProduct);
      setSelectedProducts([initialProduct]);
    } else if (!isOpen) {
      // Limpar quando fecha
      setSelectedProducts([]);
    }
  }, [isOpen, initialProduct]);

  // Buscar dados de comparação
  const productIds = useMemo(() => {
    return selectedProducts
      .map(p => parseInt(p.produto_id))
      .filter(id => !isNaN(id));
  }, [selectedProducts]);

  console.log('🔍 ProductIds para query:', productIds);

  const comparisonQuery = useQuery({
    queryKey: ['productComparison', productIds, dateRange, type],
    queryFn: async () => {
      console.log('🚀 INICIANDO QUERY com:', {
        productIds,
        dateRangeFrom: dateRange?.from,
        dateRangeTo: dateRange?.to,
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        type
      });

      if (productIds.length === 0 || !dateRange?.from || !dateRange?.to) {
        console.log('❌ Query abortada - faltam dados');
        return null;
      }

      try {
        const response = await base44.functions.invoke('getProductComparison', {
          productIds,
          startDate: format(dateRange.from, 'yyyy-MM-dd'),
          endDate: format(dateRange.to, 'yyyy-MM-dd'),
          type
        });
        
        console.log('✅ Resposta recebida:', response.data);
        return response.data;
      } catch (error) {
        console.error('❌ ERRO na query:', error);
        throw error;
      }
    },
    enabled: isOpen && productIds.length > 0 && !!dateRange?.from && !!dateRange?.to
  });

  // Produtos disponíveis para adicionar (excluindo já selecionados)
  const availableProducts = useMemo(() => {
    return allProducts.filter(p => 
      !selectedProducts.some(sp => sp.produto_id === p.produto_id)
    );
  }, [allProducts, selectedProducts]);

  const handleAddProduct = (productId) => {
    if (selectedProducts.length >= 3) {
      toast.error("Máximo de 3 produtos para comparação");
      return;
    }

    const product = allProducts.find(p => p.produto_id === parseInt(productId));
    if (product) {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.produto_id !== productId));
  };

  const handleExportExcel = () => {
    if (!comparisonQuery.data) return;

    try {
      const productsData = comparisonQuery.data.products;

      // Criar dados para Excel
      const excelData = [];

      productsData.forEach(product => {
        excelData.push({
          'Produto': product.produto.nome,
          'Setor': product.produto.setor,
          'Total (R$)': product.stats.totalValor.toFixed(2),
          'Média/Dia (R$)': product.stats.mediaValor.toFixed(2),
          'Pico (R$)': product.stats.pico.valor.toFixed(2),
          'Vale (R$)': product.stats.vale.valor.toFixed(2),
          'Dias c/ Dados': product.stats.diasComDados
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      XLSX.utils.book_append_sheet(wb, ws, 'Comparação');

      const fileName = `Comparacao_Produtos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Excel exportado!");
    } catch (error) {
      toast.error("Erro ao exportar Excel");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <style>{`
          [data-radix-popper-content-wrapper] {
            z-index: 150 !important;
          }
        `}</style>
        <DialogHeader>
          <DialogTitle className="text-xl">
            🔍 Comparação de Produtos - {type === 'sales' ? 'Vendas' : 'Perdas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* DEBUG INFO */}
          <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded font-mono">
            <div>Debug: {selectedProducts.length} produtos</div>
            <div>Período: {dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'NULL'} - {dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'NULL'}</div>
            <div>ProductIds: [{productIds.join(', ')}]</div>
            <div>Query Status: {comparisonQuery.isLoading ? 'Loading...' : comparisonQuery.error ? 'ERROR' : comparisonQuery.data ? 'Data OK' : 'No data'}</div>
            <div>Enabled: {(isOpen && productIds.length > 0 && !!dateRange?.from && !!dateRange?.to).toString()}</div>
            {comparisonQuery.error && (
              <div className="text-red-600">Error: {comparisonQuery.error.message}</div>
            )}
          </div>

          {/* Seleção de Produtos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Produtos Selecionados</Label>
            
            <div className="space-y-3">
              {/* Produtos já selecionados */}
              {selectedProducts.map((product, index) => (
                <div 
                  key={product.produto_id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{product.produto_nome}</div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {product.setor}
                    </Badge>
                  </div>
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.produto_id)}
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Adicionar novo produto */}
              {selectedProducts.length < 3 && (
                <div className="border-2 border-dashed rounded-lg p-3">
                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="+ Adicionar produto para comparar" />
                    </SelectTrigger>
                    <SelectContent className="z-[150]">
                      {availableProducts.length > 0 ? (
                        availableProducts.map(product => (
                          <SelectItem 
                            key={product.produto_id} 
                            value={product.produto_id.toString()}
                          >
                            {product.produto_nome} ({product.setor})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhum produto disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período de Análise</Label>
              <DateRangePicker 
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleExportExcel}
                disabled={!comparisonQuery.data}
                variant="outline"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>

          {/* Conteúdo */}
          {comparisonQuery.isLoading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando dados...
            </div>
          ) : comparisonQuery.data ? (
            <>
              {/* Gráfico */}
              <ProductComparisonChart 
                productsData={comparisonQuery.data.products}
              />

              {/* Tabela */}
              <ProductComparisonTable 
                productsData={comparisonQuery.data.products}
              />
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Selecione um período para visualizar os dados
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
