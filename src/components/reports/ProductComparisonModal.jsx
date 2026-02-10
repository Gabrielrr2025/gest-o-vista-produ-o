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
import Productcomparisontable from "./Productcomparisontable";

export default function ProductComparisonModal({ 
  isOpen, 
  onClose, 
  initialProduct,
  initialDateRange,
  allProducts = [],
  type = 'sales'
}) {
  // Produtos selecionados para comparação (máx 3)
  const [selectedProducts, setSelectedProducts] = useState(
    initialProduct ? [initialProduct] : []
  );
  
  // Período compartilhado
  const [dateRange, setDateRange] = useState(initialDateRange);

  // Buscar dados de comparação
  const productIds = selectedProducts.map(p => p.produto_id);

  const comparisonQuery = useQuery({
    queryKey: ['productComparison', productIds, dateRange, type],
    queryFn: async () => {
      if (productIds.length === 0 || !dateRange?.from || !dateRange?.to) {
        return null;
      }

      const response = await base44.functions.invoke('getProductComparison', {
        productIds,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        type
      });
      return response.data;
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
        <DialogHeader>
          <DialogTitle className="text-xl">
            🔍 Comparação de Produtos - {type === 'sales' ? 'Vendas' : 'Perdas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seleção de Produtos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Produtos Selecionados</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {selectedProducts.map((product, index) => (
                <div 
                  key={product.produto_id}
                  className="flex items-center gap-2 p-3 border rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{product.produto_nome}</div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {product.setor}
                    </Badge>
                  </div>
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.produto_id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Botão Adicionar Produto */}
              {selectedProducts.length < 3 && (
                <div className="border-2 border-dashed rounded-lg p-3 flex items-center justify-center">
                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="+ Adicionar produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map(product => (
                        <SelectItem 
                          key={product.produto_id} 
                          value={product.produto_id.toString()}
                        >
                          {product.produto_nome} ({product.setor})
                        </SelectItem>
                      ))}
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
              <Productcomparisontable 
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