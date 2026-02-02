import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SectorBadge from "../common/SectorBadge";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function TopProductsTable({ salesData, lossData, title = "Top Produtos", limit = 10 }) {
  const tableData = React.useMemo(() => {
    const products = {};
    
    salesData.forEach(record => {
      const key = record.product_name;
      if (!products[key]) {
        products[key] = { name: key, sector: record.sector, vendas: 0, perdas: 0 };
      }
      products[key].vendas += record.quantity || 0;
    });

    lossData.forEach(record => {
      const key = record.product_name;
      if (!products[key]) {
        products[key] = { name: key, sector: record.sector, vendas: 0, perdas: 0 };
      }
      products[key].perdas += record.quantity || 0;
    });

    return Object.values(products)
      .map(p => ({
        ...p,
        lossRate: p.vendas > 0 ? ((p.perdas / (p.vendas + p.perdas)) * 100) : 0
      }))
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, limit);
  }, [salesData, lossData, limit]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs font-medium">Produto</TableHead>
              <TableHead className="text-xs font-medium">Setor</TableHead>
              <TableHead className="text-xs font-medium text-right">Vendas</TableHead>
              <TableHead className="text-xs font-medium text-right">Perdas</TableHead>
              <TableHead className="text-xs font-medium text-right">% Perda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((product, index) => (
              <TableRow key={index} className="hover:bg-slate-50">
                <TableCell className="font-medium text-sm">{product.name}</TableCell>
                <TableCell><SectorBadge sector={product.sector} /></TableCell>
                <TableCell className="text-right text-sm">{product.vendas.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right text-sm text-red-600">{product.perdas.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right">
                  <span className={`text-xs font-medium ${
                    product.lossRate > 10 ? "text-red-600" : 
                    product.lossRate > 5 ? "text-orange-600" : "text-green-600"
                  }`}>
                    {product.lossRate.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {tableData.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  Nenhum dado disponível
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}