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
  const { data: sqlData, error: sqlError, isLoading: sqlLoading } = useQuery({
    queryKey: ['sqlData'],
    queryFn: async () => {
      console.log('🔍 Buscando dados da VIEW SQL...');
      try {
        const response = await base44.functions.invoke('fetchSQLData', {});
        console.log('📊 Resposta COMPLETA fetchSQLData:', response);
        console.log('📦 response.data:', response.data);
        console.log('📦 response.error:', response.error);
        
        if (response.error) {
          console.error('❌ Erro na response:', response.error);
          return { sales: [], losses: [] };
        }
        
        const data = response.data || {};
        
        // Normalizar: aceitar tanto sales/losses quanto salesData/lossData
        const normalized = {
          sales: data.sales || data.salesData || [],
          losses: data.losses || data.lossData || []
        };
        
        console.log('✅ Dados normalizados:', normalized);
        
        return normalized;
      } catch (err) {
        console.error('❌ Erro ao chamar fetchSQLData:', err);
        return { sales: [], losses: [] };
      }
    },
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  const products = productsData?.products || [];

  console.log('🛒 Produtos cadastrados:', products.length);
  console.log('📊 SQL Data:', sqlData);
  console.log('❌ SQL Error:', sqlError);
  console.log('⏳ SQL Loading:', sqlLoading);
  
  // Debug: verificar se vai renderizar o componente
  const shouldRender = !sqlLoading && sqlData && sqlData.sales && sqlData.losses;
  console.log('🎨 Deve renderizar UnmappedProducts?', shouldRender);
  if (shouldRender) {
    console.log('📊 Vai passar para componente:', {
      salesLength: sqlData.sales.length,
      lossesLength: sqlData.losses.length,
      productsLength: products.length
    });
  }

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['sqlData'] });
    await queryClient.refetchQueries({ queryKey: ['products'] });
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
      {!sqlLoading && sqlData && sqlData.sales && sqlData.losses && (
        <UnmappedProductsSuggestion
          sqlData={sqlData}
          products={products}
          onProductCreated={handleRefresh}
        />
      )}

      {sqlLoading && (
        <div className="text-center py-8 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-2"></div>
          Buscando produtos não mapeados...
        </div>
      )}

      {sqlError && (
        <div className="text-center py-8 text-red-500">
          Erro ao buscar produtos não mapeados: {sqlError.message}
        </div>
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