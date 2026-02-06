import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { format, subDays } from "date-fns";
import ProductsManager from "../components/products/ProductsManager";
import SQLDataProvider from "../components/import/SQLDataProvider";
import UnmappedProductsSuggestion from "../components/products/UnmappedProductsSuggestion";

export default function Products() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [sqlData, setSqlData] = useState({ sales: [], losses: [] });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

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
    const headers = ["Código", "Nome", "Setor", "Rendimento", "Unidade", "Dias de Produção", "Ativo"];
    const rows = products.map(p => [
      p.code || "",
      p.name,
      p.sector,
      p.recipe_yield || 1,
      p.unit || "unidade",
      (p.production_days || []).join(", "),
      p.active !== false ? "Sim" : "Não"
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
          />
          <Button variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto
          </Button>
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
        showAddButton={false}
        externalDialogOpen={showAddDialog}
        setExternalDialogOpen={setShowAddDialog}
      />
    </div>
  );
}