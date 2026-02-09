import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, subDays } from "date-fns";
import ProductsManager from "../components/products/ProductsManager";
import SQLDataProvider from "../components/import/SQLDataProvider";
import UnmappedProductsSuggestion from "../components/products/UnmappedProductsSuggestion";
import * as XLSX from 'xlsx';

export default function Products() {
  const queryClient = useQueryClient();
  const [sqlData, setSqlData] = useState({ sales: [], losses: [] });

  // Buscar produtos do Neon via function
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getProducts', {});
      return response.data;
    }
  });

  const products = productsData?.products || [];

  // Enriquecer produtos com dados da VIEW SQL
  const enrichedProducts = products.map(product => {
    const productSales = sqlData.sales.filter(s => s.product_id === product.id);
    const productLosses = sqlData.losses.filter(l => l.product_id === product.id);
    
    const totalSales = productSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalLosses = productLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    
    return {
      ...product,
      sql_sales: totalSales,
      sql_losses: totalLosses,
      sql_has_data: totalSales > 0 || totalLosses > 0
    };
  });

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
          <SQLDataProvider 
            startDate={format(subDays(new Date(), 90), 'yyyy-MM-dd')}
            endDate={format(new Date(), 'yyyy-MM-dd')}
            onDataLoaded={setSqlData}
            showLastUpdate={false}
          />
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

      <UnmappedProductsSuggestion 
        sqlData={sqlData}
        products={products}
        onProductCreated={handleRefresh}
      />

      <ProductsManager 
        products={enrichedProducts} 
        onRefresh={handleRefresh}
        showAddButton={true}
        isLoading={isLoading}
      />
    </div>
  );
}
