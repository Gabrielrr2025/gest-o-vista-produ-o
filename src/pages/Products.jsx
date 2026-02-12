import React from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import ProductsManager from "../components/products/ProductsManager";
import UnmappedProductsSuggestion from "../components/products/UnmappedProductsSuggestion";
import * as XLSX from 'xlsx';

export default function Products() {
  const queryClient = useQueryClient();

  // Buscar produtos do Neon via function
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getProducts', {});
      return response.data;
    }
  });

  // Buscar dados da VIEW SQL para detectar produtos não mapeados
  const { data: sqlData } = useQuery({
    queryKey: ['sqlData'],
    queryFn: async () => {
      console.log('🔍 Buscando dados da VIEW SQL...');
      const response = await base44.functions.invoke('fetchSQLData', {});
      console.log('📊 Resposta fetchSQLData:', response);
      console.log('📦 Data:', response.data);
      return response.data || { sales: [], losses: [] };
    },
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  const products = productsData?.products || [];

  console.log('🛒 Produtos cadastrados:', products.length);
  console.log('📊 SQL Data:', sqlData);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const handleExportExcel = () => {
    try {
      const excelData = products.map(p => ({
        'Código': p.code || '',
        'Nome': p.name,
        'Setor': p.sector,
        'Rendimento': p.recipe_yield || 1,
        'Unidade': p.unit || 'UN',
        'Dias de Produção': (p.production_days || []).join(', '),
        'Ativo': p.active ? 'Sim' : 'Não'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 15 }, // Código
        { wch: 30 }, // Nome
        { wch: 15 }, // Setor
        { wch: 12 }, // Rendimento
        { wch: 10 }, // Unidade
        { wch: 40 }, // Dias
        { wch: 8 }   // Ativo
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

      const fileName = `produtos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      console.log('✅ Excel exportado');
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie o catálogo de produtos por setor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Produtos não mapeados da VIEW SQL */}
      {sqlData && (
        <UnmappedProductsSuggestion
          sqlData={sqlData}
          products={products}
          onProductCreated={handleRefresh}
        />
      )}

      <ProductsManager 
        products={products} 
        onRefresh={handleRefresh}
        showAddButton={true}
        isLoading={isLoading}
      />
    </div>
  );
}
