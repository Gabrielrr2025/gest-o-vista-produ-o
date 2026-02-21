import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function TopSellingProducts({ salesData, productMap, selectedSector }) {
  const topProducts = useMemo(() => {
    // Agrupar vendas por produto
    const productSales = {};
    
    salesData.forEach(sale => {
      const product = productMap.get(sale.product_name);
      if (!product) return;
      
      const key = sale.product_name;
      if (!productSales[key]) {
        productSales[key] = {
          name: sale.product_name,
          quantity: 0,
          unit: product.unit === 'kilo' ? 'KG' : 'UN',
          sector: sale.sector
        };
      }
      productSales[key].quantity += sale.quantity || 0;
    });

    // Calcular total de vendas do setor (ou geral se "Todos")
    const totalSales = Object.values(productSales).reduce((sum, p) => sum + p.quantity, 0);

    // Converter para array e calcular percentuais
    const productsArray = Object.values(productSales).map(p => ({
      ...p,
      percentage: totalSales > 0 ? (p.quantity / totalSales) * 100 : 0
    }));

    // Ordenar e pegar top 5
    return productsArray
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [salesData, productMap]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          <CardTitle className="text-lg">Top 5 Mais Vendidos</CardTitle>
          {selectedSector !== "all" && (
            <span className="text-sm text-slate-500">- {selectedSector}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="w-64">% do Setor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.map((product, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium text-slate-500">{idx + 1}</TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-right font-semibold">
                  {product.unit === 'KG' 
                    ? product.quantity.toFixed(1) 
                    : product.quantity.toLocaleString('pt-BR')} {product.unit}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress value={product.percentage} className="h-2 flex-1" />
                    <span className="text-sm font-medium text-slate-700 w-12 text-right">
                      {product.percentage.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {topProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  Nenhuma venda nesta semana
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
