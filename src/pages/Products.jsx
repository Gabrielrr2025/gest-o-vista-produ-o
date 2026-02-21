import React from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import ProductsManager from "../components/products/Productsmanager";
import UnmappedProductsSuggestion from "../components/products/UnmappedProductsSuggestion";
import * as XLSX from 'xlsx';

export default function Products() {
  const queryClient = useQueryClient();

  // Buscar produtos do Neon via function
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await base44.functions.invoke('Getproducts', {});
      // Base44 pode retornar em response direto ou em response.data
      return response?.data || response;
    },
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  // Buscar dados da VIEW SQL para detectar produtos não mapeados
  const { data: sqlData, error: sqlError, isLoading: sqlLoading } = useQuery({
    queryKey: ['sqlData'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('fetchSQLData', {});

        // Base44 pode retornar em response direto ou em response.data
        const data = response?.data || response || {};

        if (data.error) {
          console.warn('fetchSQLData retornou erro:', data.error);
          return { sales: [], losses: [] };
        }

        const normalized = {
          sales:  data.sales  || data.salesData  || [],
          losses: data.losses || data.lossData   || [],
        };

        console.log(`✅ sqlData carregado: ${normalized.sales.length} vendas, ${normalized.losses.length} perdas`);
        return normalized;
      } catch (err) {
        console.error('Erro ao buscar sqlData:', err);
        return { sales: [], losses: [] };
      }
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const products = productsData?.products || [];

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['sqlData'] });
    await queryClient.refetchQueries({ queryKey: ['products'] });
    await queryClient.refetchQueries({ queryKey: ['sqlData'] });
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

      const colWidths = [
        { wch: 15 }, { wch: 30 }, { wch: 15 },
        { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 8 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      const fileName = `produtos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
    }
  };

  const hasSqlData = sqlData && 
    Array.isArray(sqlData.sales) && 
    Array.isArray(sqlData.losses) && 
    (sqlData.sales.length > 0 || sqlData.losses.length > 0);

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
      {sqlLoading && (
        <div className="text-center py-8 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-2"></div>
          Buscando produtos não mapeados...
        </div>
      )}

      {!sqlLoading && hasSqlData && (
        <UnmappedProductsSuggestion
          sqlData={sqlData}
          products={products}
          onProductCreated={handleRefresh}
        />
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
